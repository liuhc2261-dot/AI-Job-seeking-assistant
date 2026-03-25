import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const helpersDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(helpersDirectory, "..", "..");

export function toProjectFileUrl(relativePath) {
  return pathToFileURL(path.join(projectRoot, relativePath)).href;
}

export function toTestFileUrl(relativePath) {
  return pathToFileURL(path.join(projectRoot, "test", relativePath)).href;
}

export async function importFreshModule(relativePath) {
  const cacheBust = `test=${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return import(`${toProjectFileUrl(relativePath)}?${cacheBust}`);
}

export function setModuleMocks(entries) {
  globalThis.__testModuleMocks = new Map(entries);
}

export function resetTestState() {
  globalThis.__testModuleMocks = new Map();
  delete globalThis.__testPrisma;
  delete globalThis.__testResumeDocument;
  delete globalThis.__testProfileService;
  delete globalThis.__testResumeGeneratorAgent;
  delete globalThis.__testLibApiResume;
  delete globalThis.__testExportService;
  delete globalThis.__testExportStorage;
  delete globalThis.__testResumeService;
  delete globalThis.__testCommercialAccessService;
  delete globalThis.__testLibApiCommercial;
}
