import { buildResumeDiagnoserPrompts } from "@/ai/prompts/resume-diagnoser";
import {
  type ResumeDiagnoserStructuredResult,
  resumeDiagnoserResultSchema,
} from "@/ai/schemas/resume-diagnoser";
import { buildDiagnosisScoreOverview } from "@/services/resume-diagnosis-rules";
import { aiService } from "@/services/ai-service";
import type { JDAnalysisRecord } from "@/types/jd";
import type { DiagnosisRuleResult } from "@/types/diagnosis";
import type { ResumeContentJson } from "@/types/resume";

type ResumeDiagnoserAgentInput = {
  sourceResume: ResumeContentJson;
  jdAnalysis: JDAnalysisRecord | null;
  ruleDiagnosis: DiagnosisRuleResult;
};

export type ResumeDiagnoserAgentResult = ResumeDiagnoserStructuredResult & {
  meta: {
    provider: string;
    model: string;
    usedFallback: boolean;
  };
};

function dedupeIssues(result: ResumeDiagnoserStructuredResult) {
  const seen = new Set<string>();

  return result.issues.filter((issue) => {
    const key = `${issue.category}:${issue.title}:${issue.evidence}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeSuggestions(result: ResumeDiagnoserStructuredResult) {
  const seen = new Set<string>();

  return result.suggestions.filter((suggestion) => {
    const key = `${suggestion.category}:${suggestion.title}:${suggestion.actionText}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

class ResumeDiagnoserAgent {
  async diagnose({
    sourceResume,
    jdAnalysis,
    ruleDiagnosis,
  }: ResumeDiagnoserAgentInput): Promise<ResumeDiagnoserAgentResult> {
    const prompts = buildResumeDiagnoserPrompts({
      sourceResume,
      jdAnalysis,
      ruleDiagnosis,
    });
    const aiResult = await aiService.generateStructuredData({
      taskType: "resume_diagnose",
      schema: resumeDiagnoserResultSchema,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      fallback: () => ruleDiagnosis,
    });
    const issues = dedupeIssues(aiResult.data);
    const suggestions = dedupeSuggestions(aiResult.data);

    return {
      scoreOverview: buildDiagnosisScoreOverview(issues),
      issues,
      suggestions,
      meta: {
        provider: aiResult.meta.provider,
        model: aiResult.meta.model,
        usedFallback: aiResult.meta.usedFallback,
      },
    };
  }
}

export const resumeDiagnoserAgent = new ResumeDiagnoserAgent();
