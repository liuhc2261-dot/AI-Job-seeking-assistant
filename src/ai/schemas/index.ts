import { z } from "zod";

import { resumeDiagnoserResultSchema } from "@/ai/schemas/resume-diagnoser";

export const resumeContentSchema = z.object({
  basic: z.object({
    name: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    city: z.string().optional(),
    targetRole: z.string().optional(),
  }),
  education: z.array(z.record(z.string(), z.string())),
  projects: z.array(z.record(z.string(), z.unknown())),
  experiences: z.array(z.record(z.string(), z.unknown())).optional(),
  awards: z.array(z.record(z.string(), z.unknown())).optional(),
  skills: z.array(z.string()),
});

export const jdAnalysisSchema = z.object({
  parsedKeywords: z.array(z.string()),
  responsibilities: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  matchGaps: z.array(z.string()),
});

export const diagnosisSchema = resumeDiagnoserResultSchema;
