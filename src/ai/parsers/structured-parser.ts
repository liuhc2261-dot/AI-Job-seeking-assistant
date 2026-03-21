import type { ZodSchema } from "zod";

export function parseStructuredResponse<T>(
  rawContent: string,
  schema: ZodSchema<T>,
) {
  const parsedJson = JSON.parse(rawContent) as unknown;
  return schema.parse(parsedJson);
}

