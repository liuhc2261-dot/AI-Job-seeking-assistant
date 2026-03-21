import { z } from "zod";

export const jdParserResultSchema = z.object({
  jobTitle: z.string().trim().max(120).default(""),
  companyName: z.string().trim().max(120).default(""),
  parsedKeywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  responsibilities: z
    .array(z.string().trim().min(1).max(240))
    .max(8)
    .default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
});
