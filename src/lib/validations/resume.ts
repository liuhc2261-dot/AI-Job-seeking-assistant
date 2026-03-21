import { z } from "zod";

import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { resumeGenerationStyles } from "@/types/resume";

export const resumeGenerationRequestSchema = z.object({
  style: z.enum(resumeGenerationStyles),
});

export const resumeManualSaveSchema = z.object({
  contentJson: resumeContentJsonSchema,
});

export const resumeVersionRenameSchema = z.object({
  versionName: z.string().trim().min(1).max(120),
});

export const jdParseRequestSchema = z.object({
  resumeId: z.string().uuid(),
  resumeVersionId: z.string().uuid(),
  jdText: z.string().trim().min(40).max(12_000),
});

export const resumeOptimizeRequestSchema = z.object({
  analysisId: z.string().uuid(),
});

export const resumeDiagnoseRequestSchema = z.object({
  analysisId: z.string().uuid().optional(),
});

export const diagnosisApplyRequestSchema = z.object({
  resumeId: z.string().uuid(),
  resumeVersionId: z.string().uuid(),
  reportId: z.string().uuid(),
  suggestionIds: z.array(z.string().trim().min(1)).min(1).max(10),
});

export type ResumeGenerationRequest = z.infer<
  typeof resumeGenerationRequestSchema
>;
export type ResumeManualSaveInput = z.infer<typeof resumeManualSaveSchema>;
export type ResumeVersionRenameInput = z.infer<typeof resumeVersionRenameSchema>;
export type JdParseRequest = z.infer<typeof jdParseRequestSchema>;
export type ResumeOptimizeRequest = z.infer<typeof resumeOptimizeRequestSchema>;
export type ResumeDiagnoseRequest = z.infer<typeof resumeDiagnoseRequestSchema>;
export type DiagnosisApplyRequest = z.infer<typeof diagnosisApplyRequestSchema>;
