import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type SupportedExportStorageType = "PDF";
type ExportStorageDriver = "local" | "s3" | "r2";

type ExportStorageTarget = {
  exportId: string;
  exportType: SupportedExportStorageType;
};

type WriteExportBinaryInput = ExportStorageTarget & {
  content: Buffer;
  contentType: string;
};

type ExportStorageConfig = {
  driver: ExportStorageDriver;
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  forcePathStyle: boolean;
};

const localExportStorageDir = path.join(process.cwd(), ".tmp", "exports");

let cachedS3Client: S3Client | null = null;
let cachedS3ClientKey: string | null = null;

export class ExportStorageError extends Error {
  constructor(
    public readonly code:
      | "EXPORT_STORAGE_MISCONFIGURED"
      | "EXPORT_OBJECT_MISSING",
    message: string,
  ) {
    super(message);
  }
}

function normalizeExportStorageDriver(value: string | undefined): ExportStorageDriver {
  switch (value?.trim().toLowerCase()) {
    case "s3":
      return "s3";
    case "r2":
      return "r2";
    default:
      return "local";
  }
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getExportStorageConfig(): ExportStorageConfig {
  const driver = normalizeExportStorageDriver(process.env.EXPORT_STORAGE_DRIVER);
  const normalizedPrefix =
    process.env.EXPORT_STORAGE_PREFIX?.trim().replace(/^\/+|\/+$/g, "") ?? "";

  return {
    driver,
    bucket: process.env.EXPORT_STORAGE_BUCKET?.trim() ?? "",
    region:
      process.env.EXPORT_STORAGE_REGION?.trim() || (driver === "r2" ? "auto" : ""),
    endpoint: process.env.EXPORT_STORAGE_ENDPOINT?.trim() ?? "",
    accessKeyId: process.env.EXPORT_STORAGE_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey:
      process.env.EXPORT_STORAGE_SECRET_ACCESS_KEY?.trim() ?? "",
    prefix: normalizedPrefix || "resume-exports",
    forcePathStyle: parseBoolean(
      process.env.EXPORT_STORAGE_FORCE_PATH_STYLE,
      false,
    ),
  };
}

function getFileExtension(exportType: SupportedExportStorageType) {
  switch (exportType) {
    case "PDF":
    default:
      return "pdf";
  }
}

function getLocalExportPath(target: ExportStorageTarget) {
  return path.join(
    localExportStorageDir,
    `export-${target.exportId}.${getFileExtension(target.exportType)}`,
  );
}

function getObjectKey(target: ExportStorageTarget, prefix: string) {
  const fileName = `export-${target.exportId}.${getFileExtension(target.exportType)}`;

  return prefix ? `${prefix}/${fileName}` : fileName;
}

function isObjectMissingError(error: unknown) {
  return (
    error instanceof Error &&
    ["NoSuchKey", "NotFound", "ENOENT"].includes(error.name)
  );
}

async function readStreamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function readSdkBodyToBuffer(body: unknown) {
  if (!body) {
    throw new ExportStorageError(
      "EXPORT_OBJECT_MISSING",
      "Stored export body is empty.",
    );
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  if (
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  if (body instanceof Readable) {
    return readStreamToBuffer(body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in body
  ) {
    return readStreamToBuffer(Readable.from(body as AsyncIterable<Uint8Array>));
  }

  throw new Error("Unsupported export storage body type.");
}

function assertS3CompatibleConfig(config: ExportStorageConfig) {
  const missingFields = [
    !config.bucket ? "EXPORT_STORAGE_BUCKET" : null,
    !config.region ? "EXPORT_STORAGE_REGION" : null,
    !config.accessKeyId ? "EXPORT_STORAGE_ACCESS_KEY_ID" : null,
    !config.secretAccessKey ? "EXPORT_STORAGE_SECRET_ACCESS_KEY" : null,
    config.driver === "r2" && !config.endpoint
      ? "EXPORT_STORAGE_ENDPOINT"
      : null,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new ExportStorageError(
      "EXPORT_STORAGE_MISCONFIGURED",
      `Missing export storage environment variables: ${missingFields.join(", ")}`,
    );
  }
}

function getS3CompatibleClient(config: ExportStorageConfig) {
  assertS3CompatibleConfig(config);

  const cacheKey = JSON.stringify({
    region: config.region,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    bucket: config.bucket,
    forcePathStyle: config.forcePathStyle,
  });

  if (!cachedS3Client || cachedS3ClientKey !== cacheKey) {
    cachedS3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedS3ClientKey = cacheKey;
  }

  return cachedS3Client;
}

class ExportFileStorage {
  async write(input: WriteExportBinaryInput) {
    const config = getExportStorageConfig();

    if (config.driver === "local") {
      await mkdir(localExportStorageDir, {
        recursive: true,
      });
      await writeFile(getLocalExportPath(input), input.content);
      return;
    }

    const client = getS3CompatibleClient(config);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: getObjectKey(input, config.prefix),
        Body: input.content,
        ContentType: input.contentType,
      }),
    );
  }

  async read(input: ExportStorageTarget) {
    const config = getExportStorageConfig();

    if (config.driver === "local") {
      try {
        return await readFile(getLocalExportPath(input));
      } catch (error) {
        if (isObjectMissingError(error)) {
          throw new ExportStorageError(
            "EXPORT_OBJECT_MISSING",
            "Stored export file was not found on local disk.",
          );
        }

        throw error;
      }
    }

    const client = getS3CompatibleClient(config);

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: getObjectKey(input, config.prefix),
        }),
      );

      return await readSdkBodyToBuffer(response.Body);
    } catch (error) {
      if (isObjectMissingError(error)) {
        throw new ExportStorageError(
          "EXPORT_OBJECT_MISSING",
          "Stored export object was not found in object storage.",
        );
      }

      throw error;
    }
  }

  async remove(input: ExportStorageTarget) {
    const config = getExportStorageConfig();

    if (config.driver === "local") {
      await rm(getLocalExportPath(input), {
        force: true,
      });
      return;
    }

    const client = getS3CompatibleClient(config);

    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: getObjectKey(input, config.prefix),
      }),
    );
  }
}

export const exportFileStorage = new ExportFileStorage();
