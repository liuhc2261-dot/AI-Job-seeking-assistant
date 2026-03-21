export const diagnosisCategories = [
  "content",
  "expression",
  "structure",
  "match",
  "ats",
] as const;

export type DiagnosisCategory = (typeof diagnosisCategories)[number];

export const diagnosisSeverities = ["high", "medium", "low"] as const;

export type DiagnosisSeverity = (typeof diagnosisSeverities)[number];

export type DiagnosisIssueSource = "rule" | "llm";

export type DiagnosisSuggestionPatch =
  | {
      actionType: "rewrite_summary";
      summary: string;
    }
  | {
      actionType: "set_target_role";
      targetRole: string;
    }
  | {
      actionType: "append_skill_keywords";
      category: string;
      skills: string[];
    };

export type DiagnosisIssueRecord = {
  id: string;
  source: DiagnosisIssueSource;
  category: DiagnosisCategory;
  issueType: string;
  severity: DiagnosisSeverity;
  title: string;
  evidence: string;
  suggestion: string;
};

export type DiagnosisSuggestionRecord = {
  id: string;
  category: DiagnosisCategory;
  title: string;
  rationale: string;
  actionText: string;
  canAutoApply: boolean;
  requiresUserConfirmation: boolean;
  issueIds: string[];
  patch?: DiagnosisSuggestionPatch;
};

export type DiagnosisScoreOverview = {
  overall: number;
  content: number;
  expression: number;
  structure: number;
  match: number;
  ats: number;
  summary: string;
};

export type DiagnosisReportRecord = {
  id: string;
  resumeVersionId: string;
  inputJdAnalysisId: string | null;
  scoreOverview: DiagnosisScoreOverview;
  issues: DiagnosisIssueRecord[];
  suggestions: DiagnosisSuggestionRecord[];
  modelName: string | null;
  createdAt: string;
};

export type DiagnosisRuleResult = {
  issues: DiagnosisIssueRecord[];
  suggestions: DiagnosisSuggestionRecord[];
  scoreOverview: DiagnosisScoreOverview;
};

export type DiagnosisApplyResult = {
  report: DiagnosisReportRecord;
  appliedSuggestionIds: string[];
};
