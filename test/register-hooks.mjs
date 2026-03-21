import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks, stripTypeScriptTypes } from "node:module";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");
const moduleExtensions = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

function resolveExistingPath(basePath) {
  if (path.extname(basePath)) {
    return existsSync(basePath) ? basePath : null;
  }

  for (const extension of moduleExtensions) {
    const directCandidate = `${basePath}${extension}`;

    if (existsSync(directCandidate)) {
      return directCandidate;
    }
  }

  for (const extension of moduleExtensions) {
    const indexCandidate = path.join(basePath, `index${extension}`);

    if (existsSync(indexCandidate)) {
      return indexCandidate;
    }
  }

  return null;
}

function resolveProjectAlias(specifier) {
  const subpath = specifier.slice(2);
  const candidates = [
    path.join(projectRoot, "src", subpath),
    path.join(projectRoot, subpath),
  ];

  for (const candidate of candidates) {
    const resolvedPath = resolveExistingPath(candidate);

    if (resolvedPath) {
      return resolvedPath;
    }
  }

  return null;
}

function resolveRelativeImport(specifier, parentUrl) {
  if (!parentUrl?.startsWith("file:")) {
    return null;
  }

  const parentPath = fileURLToPath(new URL(parentUrl));

  return resolveExistingPath(path.resolve(path.dirname(parentPath), specifier));
}

function getMockRegistry() {
  return globalThis.__testModuleMocks instanceof Map
    ? globalThis.__testModuleMocks
    : null;
}

registerHooks({
  resolve(specifier, context, defaultResolve) {
    const mockRegistry = getMockRegistry();

    if (mockRegistry?.has(specifier)) {
      return {
        url: mockRegistry.get(specifier),
        shortCircuit: true,
      };
    }

    if (specifier.startsWith("@/")) {
      const resolvedPath = resolveProjectAlias(specifier);

      if (resolvedPath) {
        return {
          url: pathToFileURL(resolvedPath).href,
          shortCircuit: true,
        };
      }
    }

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolvedPath = resolveRelativeImport(specifier, context.parentURL);

      if (resolvedPath) {
        return {
          url: pathToFileURL(resolvedPath).href,
          shortCircuit: true,
        };
      }
    }

    return defaultResolve(specifier, context, defaultResolve);
  },
  load(url, context, defaultLoad) {
    if (!url.startsWith("file:")) {
      return defaultLoad(url, context, defaultLoad);
    }

    const parsedUrl = new URL(url);
    parsedUrl.search = "";
    parsedUrl.hash = "";

    const filePath = fileURLToPath(parsedUrl);

    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      const source = readFileSync(filePath, "utf8");
      const transformedSource = stripTypeScriptTypes(source, {
        mode: "transform",
        sourceUrl: filePath,
      });

      return {
        format: "module",
        source: transformedSource,
        shortCircuit: true,
      };
    }

    return defaultLoad(url, context, defaultLoad);
  },
});
