import type { Prisma } from "@prisma/client";

import {
  resumeContentJsonSchema,
  resumeVersionNotesSchema,
} from "@/ai/schemas/resume-generator";
import { resumeGeneratorAgent } from "@/ai/orchestrators/resume-generator-agent";
import { createEmptyResumeContent, renderResumeMarkdown } from "@/lib/resume-document";
import { prisma } from "@/lib/db";
import { profileService } from "@/services/profile-service";
import { resumeGenerationStyleOptions } from "@/types/resume";
import type {
  ResumeContentJson,
  ResumeCreatedByKind,
  ResumeGenerationStyle,
  ResumeHubData,
  ResumeLifecycleStep,
  ResumeListItem,
  ResumeStatusKind,
  ResumeVersionKind,
  ResumeVersionNotes,
  ResumeVersionRecord,
  ResumeVersionStatus,
  ResumeWorkspace,
} from "@/types/resume";

const versionTypeMap = {
  MASTER: "master",
  JOB_TARGETED: "job_targeted",
  MANUAL: "manual",
  AI_REWRITE: "ai_rewrite",
} as const satisfies Record<string, ResumeVersionKind>;

const createdByMap = {
  MANUAL: "manual",
  AI_GENERATE: "ai_generate",
  AI_OPTIMIZE: "ai_optimize",
  AI_DIAGNOSE_APPLY: "ai_diagnose_apply",
} as const satisfies Record<string, ResumeCreatedByKind>;

const versionStatusMap = {
  DRAFT: "draft",
  READY: "ready",
  ARCHIVED: "archived",
} as const satisfies Record<string, ResumeVersionStatus>;

const resumeStatusMap = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const satisfies Record<string, ResumeStatusKind>;

type ResumeVersionMutationResult = {
  workspace: ResumeWorkspace;
  createdVersionId: string;
};

type ResumeRollbackResult = ResumeVersionMutationResult & {
  targetVersionId: string;
};

type ResumeVersionCopyResult = ResumeVersionMutationResult & {
  sourceVersionId: string;
};

type ResumeVersionRenameResult = {
  workspace: ResumeWorkspace;
  updatedVersionId: string;
};

type ResumeVersionDeleteResult = {
  workspace: ResumeWorkspace;
  deletedVersionId: string;
  deletedWasCurrent: boolean;
};

export class ResumeServiceError extends Error {
  constructor(
    public readonly code:
      | "PROFILE_INCOMPLETE"
      | "RESUME_NOT_FOUND"
      | "VERSION_NOT_FOUND"
      | "VERSION_ALREADY_CURRENT"
      | "LAST_VERSION_DELETE_FORBIDDEN",
    public readonly details?: string[],
  ) {
    super(code);
  }
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function buildResumeName(input: {
  targetRole: string;
  fullName: string;
}) {
  if (input.targetRole) {
    return `${input.targetRole} 母版简历`;
  }

  if (input.fullName) {
    return `${input.fullName} 的求职母版`;
  }

  return "默认母版简历";
}

function buildVersionName(type: "master" | "manual", index: number) {
  return type === "master" ? `母版 v${index}` : `手动编辑 v${index}`;
}

function buildRollbackVersionName(input: {
  versionType: keyof typeof versionTypeMap;
  versionName: string;
  versionIndex: number;
  jobTargetTitle: string | null;
}) {
  if (input.versionType === "JOB_TARGETED") {
    const title = input.jobTargetTitle?.trim() || input.versionName.trim();

    return `${title || "岗位版"} 回滚 v${input.versionIndex}`;
  }

  if (input.versionType === "MASTER") {
    return `母版回滚 v${input.versionIndex}`;
  }

  if (input.versionType === "AI_REWRITE") {
    return `诊断回滚 v${input.versionIndex}`;
  }

  return `手动回滚 v${input.versionIndex}`;
}

function buildCopiedVersionName(input: {
  versionType: keyof typeof versionTypeMap;
  versionName: string;
  versionIndex: number;
  jobTargetTitle: string | null;
}) {
  if (input.versionType === "JOB_TARGETED") {
    const title = input.jobTargetTitle?.trim() || input.versionName.trim();

    return `${title || "岗位版"} 副本 v${input.versionIndex}`;
  }

  if (input.versionType === "MASTER") {
    return `母版副本 v${input.versionIndex}`;
  }

  if (input.versionType === "AI_REWRITE") {
    return `诊断副本 v${input.versionIndex}`;
  }

  return `手动副本 v${input.versionIndex}`;
}

function parseResumeContent(rawValue: unknown, fallbackEmail = ""): ResumeContentJson {
  const parsedValue = resumeContentJsonSchema.safeParse(rawValue);

  if (parsedValue.success) {
    return parsedValue.data;
  }

  return createEmptyResumeContent({
    email: fallbackEmail,
  });
}

function parseVersionNotes(rawValue: unknown): ResumeVersionNotes | null {
  const parsedValue = resumeVersionNotesSchema.safeParse(rawValue);

  return parsedValue.success ? parsedValue.data : null;
}

class ResumeService {
  getLifecycleSteps(): ResumeLifecycleStep[] {
    return [
      {
        title: "建档快照",
        description: "从用户资料生成统一 profile snapshot，作为后续 AI 链路的输入基线。",
      },
      {
        title: "母版生成",
        description: "同时产出 content_json 与 content_markdown，并沉淀为 master 版本。",
      },
      {
        title: "岗位派生",
        description: "基于 JD 解析结果生成 job_targeted 版本，并保留 source_version_id。",
      },
      {
        title: "诊断与导出",
        description: "在规则检查、诊断建议和 PDF / Markdown 导出基础上沉淀长期版本资产。",
      },
    ];
  }

  getVersionPrinciples() {
    return [
      "不直接覆盖母版简历，所有生成、复制、回滚或编辑都默认沉淀为新版本。",
      "每个版本同时维护 Markdown 与 JSON 两份内容。",
      "所有查询和写入都显式带 user_id 约束，确保用户隔离。",
    ];
  }

  async getResumeHub(userId: string): Promise<ResumeHubData> {
    const [snapshot, resumes] = await Promise.all([
      profileService.getProfileSnapshot(userId),
      this.listResumes(userId),
    ]);

    const missingModules = snapshot.completion.missingSlugs.map((slug) => {
      return snapshot.modules.find((module) => module.slug === slug)?.title ?? slug;
    });

    return {
      resumes,
      styles: resumeGenerationStyleOptions,
      canGenerate: missingModules.length === 0,
      missingProfileModules: missingModules,
      lifecycleSteps: this.getLifecycleSteps(),
      versionPrinciples: this.getVersionPrinciples(),
    };
  }

  async listResumes(userId: string): Promise<ResumeListItem[]> {
    const resumes = await prisma.resume.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    return resumes.map((resume) => {
      const currentVersion = resume.versions[0]
        ? this.mapVersionRecord(resume.versions[0])
        : null;

      return {
        id: resume.id,
        name: resume.name,
        status: resumeStatusMap[resume.status],
        updatedAt: resume.updatedAt.toISOString(),
        totalVersions: resume._count.versions,
        currentVersion,
      };
    });
  }

  async getResumeWorkspace(userId: string, resumeId: string): Promise<ResumeWorkspace> {
    const resume = await prisma.resume.findFirst({
      where: {
        id: resumeId,
        userId,
      },
      include: {
        versions: {
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    if (!resume) {
      throw new ResumeServiceError("RESUME_NOT_FOUND");
    }

    const versions = resume.versions.map((version) => this.mapVersionRecord(version));

    return {
      resume: {
        id: resume.id,
        name: resume.name,
        status: resumeStatusMap[resume.status],
        updatedAt: resume.updatedAt.toISOString(),
        totalVersions: resume._count.versions,
        currentVersion: versions[0] ?? null,
      },
      versions,
      currentVersion: versions[0] ?? null,
      styles: resumeGenerationStyleOptions,
    };
  }

  async generateMasterResume(userId: string, style: ResumeGenerationStyle) {
    const profileSnapshot = await profileService.getProfileSnapshot(userId);
    const missingModules = profileSnapshot.completion.missingSlugs.map((slug) => {
      return profileSnapshot.modules.find((module) => module.slug === slug)?.title ?? slug;
    });

    if (missingModules.length > 0) {
      throw new ResumeServiceError("PROFILE_INCOMPLETE", missingModules);
    }

    const generatedResume = await resumeGeneratorAgent.generate({
      profileSnapshot,
      style,
    });

    const createdResumeId = await prisma.$transaction(async (tx) => {
      const existingResume = await tx.resume.findFirst({
        where: {
          userId,
        },
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          versions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          _count: {
            select: {
              versions: true,
            },
          },
        },
      });

      const resumeName = buildResumeName({
        targetRole: profileSnapshot.profile.targetRole.trim(),
        fullName: profileSnapshot.profile.fullName.trim(),
      });

      const resume = existingResume
        ? await tx.resume.update({
            where: {
              id: existingResume.id,
            },
            data: {
              name: resumeName,
              status: "ACTIVE",
              baseProfileSnapshot: toJsonValue(profileSnapshot),
            },
          })
        : await tx.resume.create({
            data: {
              userId,
              name: resumeName,
              status: "ACTIVE",
              baseProfileSnapshot: toJsonValue(profileSnapshot),
            },
          });

      const version = await tx.resumeVersion.create({
        data: {
          resumeId: resume.id,
          userId,
          versionName: buildVersionName("master", (existingResume?._count.versions ?? 0) + 1),
          versionType: "MASTER",
          sourceVersionId: existingResume?.versions[0]?.id ?? null,
          contentMarkdown: generatedResume.contentMarkdown,
          contentJson: toJsonValue(generatedResume.contentJson),
          changeSummary: toJsonValue({
            generationSummary: generatedResume.generationSummary,
            items: generatedResume.changeSummary,
            warnings: generatedResume.warnings,
          }),
          status: "READY",
          createdBy: "AI_GENERATE",
        },
      });

      if (!existingResume) {
        await tx.auditLog.create({
          data: {
            userId,
            actionType: "RESUME_CREATED",
            resourceType: "RESUME",
            resourceId: resume.id,
            payload: {
              name: resume.name,
              style,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_CREATED",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId: resume.id,
            versionType: "MASTER",
            style,
          },
        },
      });

      return resume.id;
    });

    return this.getResumeWorkspace(userId, createdResumeId);
  }

  async saveManualVersion(
    userId: string,
    resumeId: string,
    sourceVersionId: string,
    contentJson: ResumeContentJson,
  ) {
    const existingResume = await prisma.resume.findFirst({
      where: {
        id: resumeId,
        userId,
      },
      include: {
        _count: {
          select: {
            versions: true,
          },
        },
      },
    });

    if (!existingResume) {
      throw new ResumeServiceError("RESUME_NOT_FOUND");
    }

    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: sourceVersionId,
        resumeId,
        userId,
      },
    });

    if (!sourceVersion) {
      throw new ResumeServiceError("VERSION_NOT_FOUND");
    }

    const markdown = renderResumeMarkdown(contentJson);

    await prisma.$transaction(async (tx) => {
      const version = await tx.resumeVersion.create({
        data: {
          resumeId,
          userId,
          versionName: buildVersionName("manual", existingResume._count.versions + 1),
          versionType: "MANUAL",
          sourceVersionId,
          contentMarkdown: markdown,
          contentJson: toJsonValue(contentJson),
          changeSummary: toJsonValue({
            generationSummary: "当前版本来自编辑页手动保存。",
            items: [
              {
                type: "rewritten",
                reason: "用户在编辑页调整简历内容，并保存为新的可回滚版本。",
                affectedSection: "manual_edit",
              },
            ],
            warnings: [],
          }),
          status: "READY",
          createdBy: "MANUAL",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_CREATED",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId,
            versionType: "MANUAL",
            sourceVersionId,
          },
        },
      });
    });

    return this.getResumeWorkspace(userId, resumeId);
  }

  async copyVersion(
    userId: string,
    resumeId: string,
    sourceVersionId: string,
  ): Promise<ResumeVersionCopyResult> {
    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: sourceVersionId,
        resumeId,
        userId,
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
          id: resumeId,
          userId,
        },
        select: {
          id: true,
        },
      });

      throw new ResumeServiceError(resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND");
    }

    const normalizedContent = parseResumeContent(sourceVersion.contentJson);

    const createdVersionId = await prisma.$transaction(async (tx) => {
      const version = await tx.resumeVersion.create({
        data: {
          resumeId,
          userId,
          versionName: buildCopiedVersionName({
            versionType: sourceVersion.versionType,
            versionName: sourceVersion.versionName,
            versionIndex: sourceVersion.resume._count.versions + 1,
            jobTargetTitle: sourceVersion.jobTargetTitle,
          }),
          versionType: sourceVersion.versionType,
          sourceVersionId: sourceVersion.id,
          jobTargetTitle: sourceVersion.jobTargetTitle,
          jobTargetCompany: sourceVersion.jobTargetCompany,
          contentMarkdown: renderResumeMarkdown(normalizedContent),
          contentJson: toJsonValue(normalizedContent),
          changeSummary: toJsonValue({
            generationSummary: `已基于 ${sourceVersion.versionName} 创建副本，可继续编辑或作为新的分支版本。`,
            items: [
              {
                type: "preserved",
                reason: "完整复制源版本内容，作为新的可回滚副本保留。",
                affectedSection: "all_sections",
              },
            ],
            warnings: [],
          }),
          status: "READY",
          createdBy: "MANUAL",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_CREATED",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId,
            versionType: sourceVersion.versionType,
            sourceVersionId: sourceVersion.id,
            action: "copy",
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_COPIED",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId,
            sourceVersionId: sourceVersion.id,
            sourceVersionName: sourceVersion.versionName,
          },
        },
      });

      return version.id;
    });

    return {
      workspace: await this.getResumeWorkspace(userId, resumeId),
      createdVersionId,
      sourceVersionId,
    };
  }

  async rollbackToVersion(
    userId: string,
    resumeId: string,
    targetVersionId: string,
  ): Promise<ResumeRollbackResult> {
    const targetVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: targetVersionId,
        resumeId,
        userId,
      },
      include: {
        resume: {
          include: {
            versions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
            _count: {
              select: {
                versions: true,
              },
            },
          },
        },
      },
    });

    if (!targetVersion) {
      const resume = await prisma.resume.findFirst({
        where: {
          id: resumeId,
          userId,
        },
        select: {
          id: true,
        },
      });

      throw new ResumeServiceError(resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND");
    }

    if (targetVersion.resume.versions[0]?.id === targetVersionId) {
      throw new ResumeServiceError("VERSION_ALREADY_CURRENT");
    }

    const normalizedContent = parseResumeContent(targetVersion.contentJson);

    const createdVersionId = await prisma.$transaction(async (tx) => {
      const version = await tx.resumeVersion.create({
        data: {
          resumeId,
          userId,
          versionName: buildRollbackVersionName({
            versionType: targetVersion.versionType,
            versionName: targetVersion.versionName,
            versionIndex: targetVersion.resume._count.versions + 1,
            jobTargetTitle: targetVersion.jobTargetTitle,
          }),
          versionType: targetVersion.versionType,
          sourceVersionId: targetVersion.id,
          jobTargetTitle: targetVersion.jobTargetTitle,
          jobTargetCompany: targetVersion.jobTargetCompany,
          contentMarkdown: renderResumeMarkdown(normalizedContent),
          contentJson: toJsonValue(normalizedContent),
          changeSummary: toJsonValue({
            generationSummary: `已从 ${targetVersion.versionName} 回滚恢复，并保留完整历史版本链。`,
            items: [
              {
                type: "preserved",
                reason: "完整复用目标版本的结构化内容，不直接覆盖历史版本。",
                affectedSection: "all_sections",
              },
            ],
            warnings: [],
          }),
          status: "READY",
          createdBy: "MANUAL",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_CREATED",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId,
            versionType: targetVersion.versionType,
            sourceVersionId: targetVersion.id,
            action: "rollback",
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_ROLLED_BACK",
          resourceType: "RESUME_VERSION",
          resourceId: version.id,
          payload: {
            resumeId,
            targetVersionId: targetVersion.id,
            restoredFromVersionName: targetVersion.versionName,
          },
        },
      });

      return version.id;
    });

    return {
      workspace: await this.getResumeWorkspace(userId, resumeId),
      createdVersionId,
      targetVersionId,
    };
  }

  async renameVersion(
    userId: string,
    resumeId: string,
    versionId: string,
    versionName: string,
  ): Promise<ResumeVersionRenameResult> {
    const existingVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: versionId,
        resumeId,
        userId,
      },
      select: {
        id: true,
        versionName: true,
      },
    });

    if (!existingVersion) {
      const resume = await prisma.resume.findFirst({
        where: {
          id: resumeId,
          userId,
        },
        select: {
          id: true,
        },
      });

      throw new ResumeServiceError(resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND");
    }

    const nextVersionName = versionName.trim();

    await prisma.$transaction(async (tx) => {
      await tx.resumeVersion.update({
        where: {
          id: versionId,
        },
        data: {
          versionName: nextVersionName,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_RENAMED",
          resourceType: "RESUME_VERSION",
          resourceId: versionId,
          payload: {
            resumeId,
            previousVersionName: existingVersion.versionName,
            nextVersionName,
          },
        },
      });
    });

    return {
      workspace: await this.getResumeWorkspace(userId, resumeId),
      updatedVersionId: versionId,
    };
  }

  async deleteVersion(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<ResumeVersionDeleteResult> {
    const existingVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: versionId,
        resumeId,
        userId,
      },
      include: {
        resume: {
          include: {
            versions: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
            _count: {
              select: {
                versions: true,
              },
            },
          },
        },
        _count: {
          select: {
            derivedVersions: true,
            jdAnalyses: true,
            diagnosisReports: true,
            exports: true,
          },
        },
      },
    });

    if (!existingVersion) {
      const resume = await prisma.resume.findFirst({
        where: {
          id: resumeId,
          userId,
        },
        select: {
          id: true,
        },
      });

      throw new ResumeServiceError(resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND");
    }

    if (existingVersion.resume._count.versions <= 1) {
      throw new ResumeServiceError("LAST_VERSION_DELETE_FORBIDDEN");
    }

    const deletedWasCurrent = existingVersion.resume.versions[0]?.id === versionId;

    await prisma.$transaction(async (tx) => {
      await tx.resumeVersion.delete({
        where: {
          id: versionId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "VERSION_DELETED",
          resourceType: "RESUME_VERSION",
          resourceId: versionId,
          payload: {
            resumeId,
            versionName: existingVersion.versionName,
            versionType: existingVersion.versionType,
            sourceVersionId: existingVersion.sourceVersionId,
            deletedWasCurrent,
            derivedVersionsDetachedCount: existingVersion._count.derivedVersions,
            deletedAnalysisCount: existingVersion._count.jdAnalyses,
            deletedDiagnosisCount: existingVersion._count.diagnosisReports,
            deletedExportCount: existingVersion._count.exports,
          },
        },
      });
    });

    return {
      workspace: await this.getResumeWorkspace(userId, resumeId),
      deletedVersionId: versionId,
      deletedWasCurrent,
    };
  }

  private mapVersionRecord(version: {
    id: string;
    resumeId: string;
    versionName: string;
    versionType: keyof typeof versionTypeMap;
    sourceVersionId: string | null;
    jobTargetTitle: string | null;
    jobTargetCompany: string | null;
    contentMarkdown: string;
    contentJson: unknown;
    changeSummary: unknown;
    status: keyof typeof versionStatusMap;
    createdBy: keyof typeof createdByMap;
    createdAt: Date;
    updatedAt: Date;
  }): ResumeVersionRecord {
    const contentJson = parseResumeContent(version.contentJson);

    return {
      id: version.id,
      resumeId: version.resumeId,
      versionName: version.versionName,
      versionType: versionTypeMap[version.versionType],
      sourceVersionId: version.sourceVersionId,
      jobTargetTitle: version.jobTargetTitle,
      jobTargetCompany: version.jobTargetCompany,
      contentMarkdown: version.contentMarkdown,
      contentJson,
      changeSummary: parseVersionNotes(version.changeSummary),
      status: versionStatusMap[version.status],
      createdBy: createdByMap[version.createdBy],
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }
}

export const resumeService = new ResumeService();
