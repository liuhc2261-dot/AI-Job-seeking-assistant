import type { Prisma } from "@prisma/client";

import {
  diagnosisScoreOverviewSchema,
  diagnosisSuggestionSchema,
  diagnosisIssueSchema,
} from "@/ai/schemas/resume-diagnoser";
import { resumeDiagnoserAgent } from "@/ai/orchestrators/resume-diagnoser-agent";
import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { renderResumeMarkdown } from "@/lib/resume-document";
import { prisma } from "@/lib/db";
import { guardrailService } from "@/services/guardrail-service";
import {
  buildDiagnosisScoreOverview,
  runRuleDiagnosis,
} from "@/services/resume-diagnosis-rules";
import { resumeService } from "@/services/resume-service";
import type { JDAnalysisRecord } from "@/types/jd";
import type {
  DiagnosisIssueRecord,
  DiagnosisReportRecord,
  DiagnosisSuggestionRecord,
  DiagnosisSuggestionPatch,
} from "@/types/diagnosis";
import type {
  ResumeChangeSummary,
  ResumeContentJson,
  ResumeVersionNotes,
  ResumeWorkspace,
} from "@/types/resume";

type DiagnoseVersionInput = {
  userId: string;
  resumeId: string;
  resumeVersionId: string;
  analysisId?: string;
};

type ApplySuggestionsInput = {
  userId: string;
  resumeId: string;
  resumeVersionId: string;
  reportId: string;
  suggestionIds: string[];
};

type DiagnosisApplyServiceResult = {
  workspace: ResumeWorkspace;
  appliedSuggestionIds: string[];
};

type DiagnosisReportDbRecord = {
  id: string;
  resumeVersionId: string;
  inputJdAnalysisId: string | null;
  scoreOverview: unknown;
  issues: unknown;
  suggestions: unknown;
  modelName: string | null;
  createdAt: Date;
};

export class ResumeDiagnosisServiceError extends Error {
  constructor(
    public readonly code:
      | "RESUME_NOT_FOUND"
      | "VERSION_NOT_FOUND"
      | "JD_ANALYSIS_NOT_FOUND"
      | "DIAGNOSIS_NOT_FOUND"
      | "NO_APPLICABLE_SUGGESTION"
      | "DIAGNOSIS_APPLY_BLOCKED",
    public readonly details?: string[],
  ) {
    super(code);
  }
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseResumeContent(rawValue: unknown): ResumeContentJson {
  return resumeContentJsonSchema.parse(rawValue);
}

function parseDiagnosisIssues(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => diagnosisIssueSchema.safeParse(item))
        .filter((item) => item.success)
        .map((item) => item.data)
    : [];
}

function parseDiagnosisSuggestions(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => diagnosisSuggestionSchema.safeParse(item))
        .filter((item) => item.success)
        .map((item) => item.data)
    : [];
}

function parseDiagnosisScoreOverview(value: unknown, issues: DiagnosisIssueRecord[]) {
  const parsedValue = diagnosisScoreOverviewSchema.safeParse(value);

  return parsedValue.success ? parsedValue.data : buildDiagnosisScoreOverview(issues);
}

function mapDiagnosisReport(report: DiagnosisReportDbRecord): DiagnosisReportRecord {
  const issues = parseDiagnosisIssues(report.issues);

  return {
    id: report.id,
    resumeVersionId: report.resumeVersionId,
    inputJdAnalysisId: report.inputJdAnalysisId,
    scoreOverview: parseDiagnosisScoreOverview(report.scoreOverview, issues),
    issues,
    suggestions: parseDiagnosisSuggestions(report.suggestions),
    modelName: report.modelName,
    createdAt: report.createdAt.toISOString(),
  };
}

function buildDiagnosisVersionName(index: number) {
  return `诊断应用 v${index}`;
}

function sortIssues(issues: DiagnosisIssueRecord[]) {
  const severityRank = {
    high: 0,
    medium: 1,
    low: 2,
  } as const;

  return [...issues].sort((left, right) => {
    const severityDelta =
      severityRank[left.severity] - severityRank[right.severity];

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.category.localeCompare(right.category);
  });
}

function mergeIssues(ruleIssues: DiagnosisIssueRecord[], aiIssues: DiagnosisIssueRecord[]) {
  const merged = [...ruleIssues];
  const seen = new Set(
    merged.map((issue) => `${issue.category}:${issue.title}:${issue.evidence}`),
  );

  aiIssues.forEach((issue) => {
    const key = `${issue.category}:${issue.title}:${issue.evidence}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(issue);
  });

  return sortIssues(merged);
}

function mergeSuggestions(
  ruleSuggestions: DiagnosisSuggestionRecord[],
  aiSuggestions: DiagnosisSuggestionRecord[],
) {
  const merged = [...ruleSuggestions];
  const seen = new Set(
    merged.map(
      (suggestion) => `${suggestion.category}:${suggestion.title}:${suggestion.actionText}`,
    ),
  );

  aiSuggestions.forEach((suggestion) => {
    const key = `${suggestion.category}:${suggestion.title}:${suggestion.actionText}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(suggestion);
  });

  return merged;
}

function findJdAnalysisJobTitle(rawJdText: string) {
  return (
    rawJdText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length >= 2 && line.length <= 40 && /(工程师|实习|开发|运营|产品|算法|设计|测试)/i.test(line)) ??
    ""
  );
}

function findJdAnalysisCompanyName(rawJdText: string) {
  return (
    rawJdText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => /(有限公司|科技|网络|信息|公司|集团)/.test(line)) ?? ""
  );
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function mapAnalysisRecord(analysis: {
  id: string;
  resumeVersionId: string;
  rawJdText: string;
  parsedKeywords: unknown;
  responsibilities: unknown;
  requiredSkills: unknown;
  matchGaps: unknown;
  modelName: string | null;
  createdAt: Date;
}): JDAnalysisRecord {
  return {
    id: analysis.id,
    resumeVersionId: analysis.resumeVersionId,
    rawJdText: analysis.rawJdText,
    jobTitle: findJdAnalysisJobTitle(analysis.rawJdText),
    companyName: findJdAnalysisCompanyName(analysis.rawJdText),
    parsedKeywords: parseStringArray(analysis.parsedKeywords),
    responsibilities: parseStringArray(analysis.responsibilities),
    requiredSkills: parseStringArray(analysis.requiredSkills),
    matchGaps: parseStringArray(analysis.matchGaps),
    modelName: analysis.modelName,
    createdAt: analysis.createdAt.toISOString(),
  };
}

function buildChangeSummaryFromSuggestions(suggestions: DiagnosisSuggestionRecord[]) {
  const items: ResumeChangeSummary[] = [
    {
      type: "preserved",
      reason: "原有项目、教育和实践事实保持不变，仅在真实信息边界内应用诊断建议。",
      affectedSection: "education / projects / experiences / awards",
    },
  ];

  suggestions.forEach((suggestion) => {
    const patch = suggestion.patch;

    if (!patch) {
      return;
    }

    switch (patch.actionType) {
      case "rewrite_summary":
        items.push({
          type: "rewritten",
          reason: suggestion.rationale,
          affectedSection: "summary",
        });
        break;
      case "set_target_role":
        items.push({
          type: "keyword_aligned",
          reason: suggestion.rationale,
          affectedSection: "basic.targetRole",
        });
        break;
      case "append_skill_keywords":
        items.push({
          type: "keyword_aligned",
          reason: suggestion.rationale,
          affectedSection: "skills",
        });
        break;
      default:
        break;
    }
  });

  return items;
}

function applySuggestionPatch(
  content: ResumeContentJson,
  patch: DiagnosisSuggestionPatch,
): ResumeContentJson {
  switch (patch.actionType) {
    case "rewrite_summary":
      return {
        ...content,
        summary: patch.summary,
      };
    case "set_target_role":
      return {
        ...content,
        basic: {
          ...content.basic,
          targetRole: patch.targetRole,
        },
      };
    case "append_skill_keywords": {
      const nextSkills = patch.skills.filter(
        (skill) =>
          !content.skills.some((group) =>
            group.items.some((item) => item.trim().toLowerCase() === skill.trim().toLowerCase()),
          ),
      );

      if (nextSkills.length === 0) {
        return content;
      }

      const existingGroupIndex = content.skills.findIndex(
        (group) => group.category.trim().toLowerCase() === patch.category.trim().toLowerCase(),
      );

      if (existingGroupIndex >= 0) {
        const updatedSkills = [...content.skills];
        const currentGroup = updatedSkills[existingGroupIndex];

        updatedSkills[existingGroupIndex] = {
          ...currentGroup,
          items: dedupe([...currentGroup.items, ...nextSkills]),
        };

        return {
          ...content,
          skills: updatedSkills,
        };
      }

      return {
        ...content,
        skills: [
          ...content.skills,
          {
            category: patch.category,
            items: dedupe(nextSkills),
          },
        ],
      };
    }
    default:
      return content;
  }
}

class ResumeDiagnosisService {
  async getLatestReport(
    userId: string,
    resumeId: string,
    resumeVersionId: string,
  ): Promise<DiagnosisReportRecord | null> {
    const report = await prisma.diagnosisReport.findFirst({
      where: {
        userId,
        resumeVersionId,
        resumeVersion: {
          resumeId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return report ? mapDiagnosisReport(report) : null;
  }

  async getRecommendedAnalysis(
    userId: string,
    resumeId: string,
    resumeVersionId: string,
    sourceVersionId: string | null,
  ): Promise<JDAnalysisRecord | null> {
    const currentAnalysis = await prisma.jDAnalysis.findFirst({
      where: {
        userId,
        resumeVersionId,
        resumeVersion: {
          resumeId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (currentAnalysis) {
      return mapAnalysisRecord(currentAnalysis);
    }

    if (!sourceVersionId) {
      return null;
    }

    const sourceAnalysis = await prisma.jDAnalysis.findFirst({
      where: {
        userId,
        resumeVersionId: sourceVersionId,
        resumeVersion: {
          resumeId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return sourceAnalysis ? mapAnalysisRecord(sourceAnalysis) : null;
  }

  async diagnoseVersion(input: DiagnoseVersionInput): Promise<DiagnosisReportRecord> {
    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: input.resumeVersionId,
        resumeId: input.resumeId,
        userId: input.userId,
      },
      select: {
        id: true,
        sourceVersionId: true,
        contentJson: true,
      },
    });

    if (!sourceVersion) {
      const resume = await prisma.resume.findFirst({
        where: {
          id: input.resumeId,
          userId: input.userId,
        },
        select: {
          id: true,
        },
      });

      throw new ResumeDiagnosisServiceError(
        resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND",
      );
    }

    const jdAnalysis = input.analysisId
      ? await prisma.jDAnalysis.findFirst({
          where: {
            id: input.analysisId,
            userId: input.userId,
            resumeVersion: {
              resumeId: input.resumeId,
            },
          },
        })
      : null;

    if (input.analysisId && !jdAnalysis) {
      throw new ResumeDiagnosisServiceError("JD_ANALYSIS_NOT_FOUND");
    }

    const sourceResume = parseResumeContent(sourceVersion.contentJson);
    const resolvedAnalysis = jdAnalysis
      ? mapAnalysisRecord(jdAnalysis)
      : await this.getRecommendedAnalysis(
          input.userId,
          input.resumeId,
          input.resumeVersionId,
          sourceVersion.sourceVersionId,
        );
    const ruleDiagnosis = runRuleDiagnosis({
      sourceResume,
      jdAnalysis: resolvedAnalysis,
    });
    const aiDiagnosis = await resumeDiagnoserAgent.diagnose({
      sourceResume,
      jdAnalysis: resolvedAnalysis,
      ruleDiagnosis,
    });
    const issues = mergeIssues(ruleDiagnosis.issues, aiDiagnosis.issues);
    const suggestions = mergeSuggestions(
      ruleDiagnosis.suggestions,
      aiDiagnosis.suggestions,
    );
    const scoreOverview = buildDiagnosisScoreOverview(issues);
    const report = await prisma.diagnosisReport.create({
      data: {
        userId: input.userId,
        resumeVersionId: input.resumeVersionId,
        inputJdAnalysisId: resolvedAnalysis?.id ?? null,
        scoreOverview: toJsonValue(scoreOverview),
        issues: toJsonValue(issues),
        suggestions: toJsonValue(suggestions),
        modelName: aiDiagnosis.meta.model,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        actionType: "DIAGNOSIS_CREATED",
        resourceType: "DIAGNOSIS_REPORT",
        resourceId: report.id,
        payload: {
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
          inputJdAnalysisId: resolvedAnalysis?.id ?? null,
        },
      },
    });

    return mapDiagnosisReport(report);
  }

  async applySuggestions(
    input: ApplySuggestionsInput,
  ): Promise<DiagnosisApplyServiceResult> {
    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: input.resumeVersionId,
        resumeId: input.resumeId,
        userId: input.userId,
      },
      include: {
        resume: {
          include: {
            _count: {
              select: {
                versions: true,
              },
            },
          },
        },
      },
    });

    if (!sourceVersion) {
      const resume = await prisma.resume.findFirst({
        where: {
          id: input.resumeId,
          userId: input.userId,
        },
        select: {
          id: true,
        },
      });

      throw new ResumeDiagnosisServiceError(
        resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND",
      );
    }

    const report = await prisma.diagnosisReport.findFirst({
      where: {
        id: input.reportId,
        userId: input.userId,
        resumeVersionId: input.resumeVersionId,
        resumeVersion: {
          resumeId: input.resumeId,
        },
      },
    });

    if (!report) {
      throw new ResumeDiagnosisServiceError("DIAGNOSIS_NOT_FOUND");
    }

    const parsedSuggestions = parseDiagnosisSuggestions(report.suggestions);
    const selectedSuggestions = parsedSuggestions.filter((suggestion) =>
      input.suggestionIds.includes(suggestion.id),
    );
    const applicableSuggestions = selectedSuggestions.filter(
      (suggestion) => suggestion.canAutoApply && suggestion.patch,
    );

    if (applicableSuggestions.length === 0) {
      throw new ResumeDiagnosisServiceError("NO_APPLICABLE_SUGGESTION");
    }

    const sourceResume = parseResumeContent(sourceVersion.contentJson);
    const nextResume = applicableSuggestions.reduce((currentResume, suggestion) => {
      return applySuggestionPatch(currentResume, suggestion.patch!);
    }, sourceResume);
    const guardrail = guardrailService.inspectDiagnosisAppliedResume({
      sourceResume,
      updatedResume: nextResume,
    });

    if (guardrail.blocked) {
      throw new ResumeDiagnosisServiceError(
        "DIAGNOSIS_APPLY_BLOCKED",
        guardrail.warnings,
      );
    }

    const hasChanged =
      JSON.stringify(sourceResume) !== JSON.stringify(nextResume);

    if (!hasChanged) {
      throw new ResumeDiagnosisServiceError("NO_APPLICABLE_SUGGESTION");
    }

    const versionNotes: ResumeVersionNotes = {
      generationSummary: `已应用 ${applicableSuggestions.length} 条诊断建议，并保存为新的可回滚版本。`,
      items: buildChangeSummaryFromSuggestions(applicableSuggestions),
      warnings: [],
    };

    await prisma.$transaction(async (tx) => {
      const version = await tx.resumeVersion.create({
        data: {
          resumeId: input.resumeId,
          userId: input.userId,
          versionName: buildDiagnosisVersionName(
            sourceVersion.resume._count.versions + 1,
          ),
          versionType: "AI_REWRITE",
          sourceVersionId: input.resumeVersionId,
          jobTargetTitle: sourceVersion.jobTargetTitle,
          jobTargetCompany: sourceVersion.jobTargetCompany,
          contentMarkdown: renderResumeMarkdown(nextResume),
          contentJson: toJsonValue(nextResume),
          changeSummary: toJsonValue(versionNotes),
          status: "READY",
          createdBy: "AI_DIAGNOSE_APPLY",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          actionType: "VERSION_CREATED",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId: input.resumeId,
            versionType: "AI_REWRITE",
            sourceVersionId: input.resumeVersionId,
            reportId: input.reportId,
            suggestionIds: applicableSuggestions.map((suggestion) => suggestion.id),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.userId,
          actionType: "DIAGNOSIS_SUGGESTIONS_APPLIED",
          resourceType: "DIAGNOSIS_REPORT",
          resourceId: input.reportId,
          payload: {
            resumeId: input.resumeId,
            resumeVersionId: input.resumeVersionId,
            newVersionId: version.id,
            suggestionIds: applicableSuggestions.map((suggestion) => suggestion.id),
          },
        },
      });
    });

    return {
      workspace: await resumeService.getResumeWorkspace(input.userId, input.resumeId),
      appliedSuggestionIds: applicableSuggestions.map((suggestion) => suggestion.id),
    };
  }
}

export const resumeDiagnosisService = new ResumeDiagnosisService();
