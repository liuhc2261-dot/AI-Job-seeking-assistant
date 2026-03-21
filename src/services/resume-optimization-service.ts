import type { Prisma } from "@prisma/client";

import { resumeOptimizerAgent } from "@/ai/orchestrators/resume-optimizer-agent";
import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { createEmptyResumeContent } from "@/lib/resume-document";
import { prisma } from "@/lib/db";
import {
  JDAnalysisServiceError,
  jdAnalysisService,
} from "@/services/jd-analysis-service";
import { resumeService } from "@/services/resume-service";
import type { ResumeContentJson, ResumeWorkspace } from "@/types/resume";

export class ResumeOptimizationServiceError extends Error {
  constructor(
    public readonly code:
      | "RESUME_NOT_FOUND"
      | "VERSION_NOT_FOUND"
      | "JD_ANALYSIS_NOT_FOUND",
  ) {
    super(code);
  }
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function parseResumeContent(rawValue: unknown): ResumeContentJson {
  const parsedValue = resumeContentJsonSchema.safeParse(rawValue);

  if (parsedValue.success) {
    return parsedValue.data;
  }

  return createEmptyResumeContent();
}

function buildJobTargetedVersionName(jobTitle: string, index: number) {
  const trimmedTitle = jobTitle.trim();

  return trimmedTitle ? `${trimmedTitle} 定制 v${index}` : `岗位定制 v${index}`;
}

class ResumeOptimizationService {
  async optimizeVersion(input: {
    userId: string;
    resumeId: string;
    resumeVersionId: string;
    analysisId: string;
  }): Promise<ResumeWorkspace> {
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

      throw new ResumeOptimizationServiceError(
        resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND",
      );
    }

    const jdAnalysis = await jdAnalysisService
      .getAnalysisById(
        input.userId,
        input.resumeId,
        input.resumeVersionId,
        input.analysisId,
      )
      .catch((error) => {
        if (error instanceof JDAnalysisServiceError) {
          throw new ResumeOptimizationServiceError("JD_ANALYSIS_NOT_FOUND");
        }

        throw error;
      });
    const sourceResume = parseResumeContent(sourceVersion.contentJson);
    const optimizedResume = await resumeOptimizerAgent.optimize({
      sourceResume,
      jdAnalysis,
    });

    await prisma.$transaction(async (tx) => {
      const version = await tx.resumeVersion.create({
        data: {
          resumeId: input.resumeId,
          userId: input.userId,
          versionName: buildJobTargetedVersionName(
            jdAnalysis.jobTitle,
            sourceVersion.resume._count.versions + 1,
          ),
          versionType: "JOB_TARGETED",
          sourceVersionId: sourceVersion.id,
          jobTargetTitle: jdAnalysis.jobTitle || null,
          jobTargetCompany: jdAnalysis.companyName || null,
          contentMarkdown: optimizedResume.contentMarkdown,
          contentJson: toJsonValue(optimizedResume.contentJson),
          changeSummary: toJsonValue({
            generationSummary: optimizedResume.generationSummary,
            items: optimizedResume.changeSummary,
            warnings: optimizedResume.warnings,
          }),
          status: "READY",
          createdBy: "AI_OPTIMIZE",
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
            versionType: "JOB_TARGETED",
            sourceVersionId: sourceVersion.id,
            analysisId: input.analysisId,
          },
        },
      });
    });

    return resumeService.getResumeWorkspace(input.userId, input.resumeId);
  }
}

export const resumeOptimizationService = new ResumeOptimizationService();
