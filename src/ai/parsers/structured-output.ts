import { z } from "zod";

function extractCandidateFromCodeFence(input: string) {
  const match = input.match(/```(?:json)?\s*([\s\S]*?)```/i);

  return match?.[1]?.trim() ?? null;
}

function extractCandidateFromJsonBlock(input: string) {
  const firstObjectIndex = input.indexOf("{");
  const firstArrayIndex = input.indexOf("[");
  const startIndexCandidates = [firstObjectIndex, firstArrayIndex].filter(
    (index) => index >= 0,
  );

  if (startIndexCandidates.length === 0) {
    return null;
  }

  const startIndex = Math.min(...startIndexCandidates);
  const objectEndIndex = input.lastIndexOf("}");
  const arrayEndIndex = input.lastIndexOf("]");
  const endIndex = Math.max(objectEndIndex, arrayEndIndex);

  if (endIndex <= startIndex) {
    return null;
  }

  return input.slice(startIndex, endIndex + 1).trim();
}

export function parseStructuredOutput<T>(
  rawOutput: string,
  schema: z.ZodType<T>,
) {
  const candidates = [
    rawOutput.trim(),
    extractCandidateFromCodeFence(rawOutput),
    extractCandidateFromJsonBlock(rawOutput),
  ].filter((candidate, index, array): candidate is string => {
    return Boolean(candidate) && array.indexOf(candidate) === index;
  });

  for (const candidate of candidates) {
    try {
      return schema.parse(JSON.parse(candidate));
    } catch {
      continue;
    }
  }

  throw new Error("STRUCTURED_OUTPUT_PARSE_FAILED");
}
