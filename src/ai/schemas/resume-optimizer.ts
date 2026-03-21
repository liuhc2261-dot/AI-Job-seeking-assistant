import { z } from "zod";

import {
  resumeChangeSummarySchema,
  resumeContentJsonSchema,
} from "@/ai/schemas/resume-generator";

export const resumeOptimizerResultSchema = z.object({
  contentJson: resumeContentJsonSchema,
  contentMarkdown: z.string().trim().min(1).max(12000),
  generationSummary: z.string().trim().min(1).max(400),
  changeSummary: z.array(resumeChangeSummarySchema).min(1).max(20),
  warnings: z.array(z.string().trim().min(1).max(240)).default([]),
});

export type ResumeOptimizerStructuredResult = z.infer<
  typeof resumeOptimizerResultSchema
>;
