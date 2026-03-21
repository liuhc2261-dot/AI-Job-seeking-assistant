import { z } from "zod";

export const diagnosisCategorySchema = z.enum([
  "content",
  "expression",
  "structure",
  "match",
  "ats",
]);

export const diagnosisSeveritySchema = z.enum(["high", "medium", "low"]);

export const diagnosisIssueSchema = z.object({
  id: z.string().trim().min(1).max(80),
  source: z.enum(["rule", "llm"]),
  category: diagnosisCategorySchema,
  issueType: z.string().trim().min(1).max(80),
  severity: diagnosisSeveritySchema,
  title: z.string().trim().min(1).max(120),
  evidence: z.string().trim().min(1).max(400),
  suggestion: z.string().trim().min(1).max(240),
});

export const rewriteSummaryPatchSchema = z.object({
  actionType: z.literal("rewrite_summary"),
  summary: z.string().trim().min(1).max(600),
});

export const setTargetRolePatchSchema = z.object({
  actionType: z.literal("set_target_role"),
  targetRole: z.string().trim().min(1).max(120),
});

export const appendSkillKeywordsPatchSchema = z.object({
  actionType: z.literal("append_skill_keywords"),
  category: z.string().trim().min(1).max(60),
  skills: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
});

export const diagnosisSuggestionPatchSchema = z.discriminatedUnion("actionType", [
  rewriteSummaryPatchSchema,
  setTargetRolePatchSchema,
  appendSkillKeywordsPatchSchema,
]);

export const diagnosisSuggestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  category: diagnosisCategorySchema,
  title: z.string().trim().min(1).max(120),
  rationale: z.string().trim().min(1).max(320),
  actionText: z.string().trim().min(1).max(80),
  canAutoApply: z.boolean().default(false),
  requiresUserConfirmation: z.boolean().default(false),
  issueIds: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  patch: diagnosisSuggestionPatchSchema.optional(),
});

export const diagnosisScoreOverviewSchema = z.object({
  overall: z.number().int().min(0).max(100),
  content: z.number().int().min(0).max(100),
  expression: z.number().int().min(0).max(100),
  structure: z.number().int().min(0).max(100),
  match: z.number().int().min(0).max(100),
  ats: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(400),
});

export const resumeDiagnoserResultSchema = z.object({
  scoreOverview: diagnosisScoreOverviewSchema,
  issues: z.array(diagnosisIssueSchema).max(30).default([]),
  suggestions: z.array(diagnosisSuggestionSchema).max(20).default([]),
});

export type ResumeDiagnoserStructuredResult = z.infer<
  typeof resumeDiagnoserResultSchema
>;
