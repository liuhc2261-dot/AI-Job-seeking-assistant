import type { Prisma } from "@prisma/client";

import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { prisma } from "@/lib/db";
import { ExportStorageError, exportFileStorage } from "@/lib/export-storage";
import { captureServerException } from "@/lib/monitoring/sentry";
import { commercialAccessService } from "@/services/commercial-access-service";
import type {
  ExportFormatOption,
  ExportTemplate,
  ResumeExportRecord,
  ResumeExportStatus,
  ResumeExportType,
} from "@/types/export";
import type { ResumeVersionKind } from "@/types/resume";

const exportTypeMap = {
  PDF: "pdf",
  MARKDOWN: "markdown",
  TEXT: "text",
} as const satisfies Record<string, ResumeExportType>;

const exportStatusMap = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
} as const satisfies Record<string, ResumeExportStatus>;

const versionTypeMap = {
  MASTER: "master",
  JOB_TARGETED: "job_targeted",
  MANUAL: "manual",
  AI_REWRITE: "ai_rewrite",
} as const satisfies Record<string, ResumeVersionKind>;

const markdownTemplateName = "source-markdown";
const pdfTemplateName = "ats-standard";

const exportTemplates: ExportTemplate[] = [
  {
    id: pdfTemplateName,
    name: "标准 ATS 模板",
    description: "单栏、清晰、稳定，优先保证中文排版和 ATS 友好的投递可读性。",
    recommendedFor: "校园招聘 / 实习投递 / 通用岗位",
  },
];

const exportFormatOptions: ExportFormatOption[] = [
  {
    id: "markdown",
    label: "Markdown 源稿",
    description: "直接导出当前版本的 Markdown 内容，便于继续编辑、复用和二次排版。",
    available: true,
  },
  {
    id: "pdf",
    label: "PDF 投递版",
    description: "基于 content_json 渲染稳定 HTML 模板，并在服务端生成可下载的 PDF 文件。",
    available: true,
  },
];

const resumeVersionExportSelect = {
  id: true,
  resumeId: true,
  versionName: true,
  versionType: true,
  jobTargetTitle: true,
  jobTargetCompany: true,
} as const;

type ExportDownloadPayload = {
  exportId: string;
  resumeId: string;
  resumeVersionId: string;
  exportType: ResumeExportType;
  exportStatus: ResumeExportStatus;
  templateName: string;
  fileNameAscii: string;
  fileNameUtf8: string;
  content: string | Buffer;
  contentType: string;
  fileSize: number;
};

type SourceVersionRecord = {
  id: string;
  resumeId: string;
  versionName: string;
  versionType: keyof typeof versionTypeMap;
  jobTargetTitle: string | null;
  jobTargetCompany: string | null;
  contentMarkdown: string;
  contentJson: unknown;
};

export class ExportServiceError extends Error {
  constructor(
    public readonly code:
      | "RESUME_NOT_FOUND"
      | "VERSION_NOT_FOUND"
      | "EXPORT_NOT_FOUND"
      | "EXPORT_NOT_READY"
      | "EXPORT_RETRY_NOT_ALLOWED"
      | "EXPORT_UNSUPPORTED"
      | "EXPORT_BROWSER_UNAVAILABLE"
      | "EXPORT_STORAGE_UNAVAILABLE"
      | "EXPORT_FILE_MISSING",
  ) {
    super(code);
  }
}

function sanitizeFileNameSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function getFileExtension(exportType: keyof typeof exportTypeMap) {
  switch (exportType) {
    case "PDF":
      return "pdf";
    case "MARKDOWN":
      return "md";
    case "TEXT":
    default:
      return "txt";
  }
}

function buildUtf8FileName(input: {
  versionName: string;
  jobTargetTitle: string | null;
  extension: string;
}) {
  const baseName = sanitizeFileNameSegment(
    input.jobTargetTitle
      ? `${input.versionName}-${input.jobTargetTitle}`
      : input.versionName,
  );

  return `${baseName || "resume-export"}.${input.extension}`;
}

function buildAsciiFileName(exportId: string, extension: string) {
  return `resume-export-${exportId}.${extension}`;
}

function getTextByteLength(content: string) {
  return new TextEncoder().encode(content).byteLength;
}

class ExportService {
  listTemplates(): ExportTemplate[] {
    return exportTemplates;
  }

  listFormatOptions(): ExportFormatOption[] {
    return exportFormatOptions;
  }

  getMarkdownTemplateName() {
    return markdownTemplateName;
  }

  getPdfTemplateName() {
    return pdfTemplateName;
  }

  async listResumeExports(
    userId: string,
    resumeId: string,
  ): Promise<ResumeExportRecord[]> {
    const exports = await prisma.export.findMany({
      where: {
        userId,
        resumeVersion: {
          resumeId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        resumeVersion: {
          select: resumeVersionExportSelect,
        },
      },
    });

    return exports.map((record) => this.mapExportRecord(record));
  }

  async createMarkdownExport(input: {
    userId: string;
    resumeId: string;
    resumeVersionId: string;
    templateName: string;
  }): Promise<ResumeExportRecord> {
    const sourceVersion = await this.findSourceVersionOrThrow(input);
    const pendingExport = await this.createPendingExport({
      userId: input.userId,
      resumeVersionId: sourceVersion.id,
      exportType: "MARKDOWN",
      templateName: input.templateName || markdownTemplateName,
    });

    try {
      const updatedExport = await this.completeExport({
        exportId: pendingExport.id,
        fileSize: getTextByteLength(sourceVersion.contentMarkdown),
      });

      await this.createAuditLog({
        userId: input.userId,
        resumeId: input.resumeId,
        resumeVersionId: input.resumeVersionId,
        exportType: "MARKDOWN",
        exportId: updatedExport.id,
        templateName: updatedExport.templateName,
      });

      return this.mapExportRecord(updatedExport);
    } catch (error) {
      await this.failExport(pendingExport.id);

      captureServerException(error, {
        area: "export-service",
        tags: {
          exportType: "MARKDOWN",
        },
        extra: {
          exportId: pendingExport.id,
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
          templateName: input.templateName,
        },
      });

      console.error("[export-service] markdown export failed", {
        exportId: pendingExport.id,
        resumeId: input.resumeId,
        resumeVersionId: input.resumeVersionId,
        message: error instanceof Error ? error.message : "unknown_error",
      });

      throw error;
    }
  }

  async createPdfExport(input: {
    userId: string;
    resumeId: string;
    resumeVersionId: string;
    templateName: string;
  }): Promise<ResumeExportRecord> {
    await commercialAccessService.assertFeatureAvailable(input.userId, "pdf_export");
    const sourceVersion = await this.findSourceVersionOrThrow(input);
    const pendingExport = await this.createPendingExport({
      userId: input.userId,
      resumeVersionId: sourceVersion.id,
      exportType: "PDF",
      templateName: input.templateName || pdfTemplateName,
    });

    try {
      const contentJson = resumeContentJsonSchema.parse(sourceVersion.contentJson);
      const { renderResumePdfBuffer } = await import("@/lib/pdf-renderer");
      const pdfBuffer = await renderResumePdfBuffer({
        content: contentJson,
        templateName: pendingExport.templateName,
      });

      await exportFileStorage.write({
        exportId: pendingExport.id,
        exportType: "PDF",
        content: pdfBuffer,
        contentType: "application/pdf",
      });

      const updatedExport = await prisma.$transaction(async (tx) => {
        const completedExport = await this.completeExport(
          {
            exportId: pendingExport.id,
            fileSize: pdfBuffer.byteLength,
          },
          tx,
        );

        await this.createAuditLog(
          {
            userId: input.userId,
            resumeId: input.resumeId,
            resumeVersionId: input.resumeVersionId,
            exportType: "PDF",
            exportId: completedExport.id,
            templateName: completedExport.templateName,
          },
          tx,
        );

        await commercialAccessService.recordSuccessfulFeatureUsage({
          userId: input.userId,
          feature: "pdf_export",
          resourceType: "EXPORT",
          resourceId: completedExport.id,
          metadata: {
            resumeId: input.resumeId,
            resumeVersionId: input.resumeVersionId,
            templateName: completedExport.templateName,
          },
          tx,
        });

        return completedExport;
      });

      return this.mapExportRecord(updatedExport);
    } catch (error) {
      await this.failExport(pendingExport.id, "PDF");

      captureServerException(error, {
        area: "export-service",
        tags: {
          exportType: "PDF",
        },
        extra: {
          exportId: pendingExport.id,
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
          templateName: input.templateName,
        },
      });

      console.error("[export-service] pdf export failed", {
        exportId: pendingExport.id,
        resumeId: input.resumeId,
        resumeVersionId: input.resumeVersionId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "unknown_error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof Error && error.message === "PDF_BROWSER_UNAVAILABLE") {
        throw new ExportServiceError("EXPORT_BROWSER_UNAVAILABLE");
      }

      if (
        error instanceof ExportStorageError &&
        error.code === "EXPORT_STORAGE_MISCONFIGURED"
      ) {
        throw new ExportServiceError("EXPORT_STORAGE_UNAVAILABLE");
      }

      throw error;
    }
  }

  async getExportDownload(input: {
    userId: string;
    exportId: string;
    requestId?: string;
  }): Promise<ExportDownloadPayload> {
    const exportRecord = await prisma.export.findFirst({
      where: {
        id: input.exportId,
        userId: input.userId,
      },
      include: {
        resumeVersion: {
          select: {
            ...resumeVersionExportSelect,
            contentMarkdown: true,
          },
        },
      },
    });

    if (!exportRecord) {
      throw new ExportServiceError("EXPORT_NOT_FOUND");
    }

    if (exportRecord.status !== "SUCCESS" || !exportRecord.fileUrl) {
      throw new ExportServiceError("EXPORT_NOT_READY");
    }

    const extension = getFileExtension(exportRecord.exportType);
    const fileName = {
      fileNameAscii: buildAsciiFileName(exportRecord.id, extension),
      fileNameUtf8: buildUtf8FileName({
        versionName: exportRecord.resumeVersion.versionName,
        jobTargetTitle: exportRecord.resumeVersion.jobTargetTitle,
        extension,
      }),
    };

    if (exportRecord.exportType === "MARKDOWN") {
      const payload = {
        exportId: exportRecord.id,
        resumeId: exportRecord.resumeVersion.resumeId,
        resumeVersionId: exportRecord.resumeVersion.id,
        exportType: exportTypeMap[exportRecord.exportType],
        exportStatus: exportStatusMap[exportRecord.status],
        templateName: exportRecord.templateName,
        ...fileName,
        content: exportRecord.resumeVersion.contentMarkdown,
        contentType: "text/markdown; charset=utf-8",
        fileSize:
          exportRecord.fileSize ??
          getTextByteLength(exportRecord.resumeVersion.contentMarkdown),
      };

      await this.createDownloadAuditLog({
        userId: input.userId,
        exportId: exportRecord.id,
        resumeId: exportRecord.resumeVersion.resumeId,
        resumeVersionId: exportRecord.resumeVersion.id,
        exportType: exportRecord.exportType,
        templateName: exportRecord.templateName,
        fileSize: payload.fileSize,
        requestId: input.requestId,
      });

      return payload;
    }

    if (exportRecord.exportType === "PDF") {
      try {
        const fileBuffer = await exportFileStorage.read({
          exportId: exportRecord.id,
          exportType: "PDF",
        });

        const payload = {
          exportId: exportRecord.id,
          resumeId: exportRecord.resumeVersion.resumeId,
          resumeVersionId: exportRecord.resumeVersion.id,
          exportType: exportTypeMap[exportRecord.exportType],
          exportStatus: exportStatusMap[exportRecord.status],
          templateName: exportRecord.templateName,
          ...fileName,
          content: fileBuffer,
          contentType: "application/pdf",
          fileSize: exportRecord.fileSize ?? fileBuffer.byteLength,
        };

        await this.createDownloadAuditLog({
          userId: input.userId,
          exportId: exportRecord.id,
          resumeId: exportRecord.resumeVersion.resumeId,
          resumeVersionId: exportRecord.resumeVersion.id,
          exportType: exportRecord.exportType,
          templateName: exportRecord.templateName,
          fileSize: payload.fileSize,
          requestId: input.requestId,
        });

        return payload;
      } catch (error) {
        if (
          error instanceof ExportStorageError &&
          error.code === "EXPORT_STORAGE_MISCONFIGURED"
        ) {
          throw new ExportServiceError("EXPORT_STORAGE_UNAVAILABLE");
        }

        if (
          error instanceof ExportStorageError &&
          error.code === "EXPORT_OBJECT_MISSING"
        ) {
          throw new ExportServiceError("EXPORT_FILE_MISSING");
        }

        throw error;
      }
    }

    throw new ExportServiceError("EXPORT_UNSUPPORTED");
  }

  async retryExport(input: {
    userId: string;
    exportId: string;
  }): Promise<ResumeExportRecord> {
    const exportRecord = await prisma.export.findFirst({
      where: {
        id: input.exportId,
        userId: input.userId,
      },
      select: {
        id: true,
        resumeVersionId: true,
        exportType: true,
        templateName: true,
        status: true,
        resumeVersion: {
          select: {
            resumeId: true,
          },
        },
      },
    });

    if (!exportRecord) {
      throw new ExportServiceError("EXPORT_NOT_FOUND");
    }

    if (exportRecord.status !== "FAILED") {
      throw new ExportServiceError("EXPORT_RETRY_NOT_ALLOWED");
    }

    if (exportRecord.exportType === "MARKDOWN") {
      const retriedExport = await this.createMarkdownExport({
        userId: input.userId,
        resumeId: exportRecord.resumeVersion.resumeId,
        resumeVersionId: exportRecord.resumeVersionId,
        templateName: exportRecord.templateName,
      });

      await this.createRetryAuditLog({
        userId: input.userId,
        previousExportId: exportRecord.id,
        retriedExportId: retriedExport.id,
        resumeId: exportRecord.resumeVersion.resumeId,
        resumeVersionId: exportRecord.resumeVersionId,
        exportType: "MARKDOWN",
        templateName: exportRecord.templateName,
      });

      return retriedExport;
    }

    if (exportRecord.exportType === "PDF") {
      const retriedExport = await this.createPdfExport({
        userId: input.userId,
        resumeId: exportRecord.resumeVersion.resumeId,
        resumeVersionId: exportRecord.resumeVersionId,
        templateName: exportRecord.templateName,
      });

      await this.createRetryAuditLog({
        userId: input.userId,
        previousExportId: exportRecord.id,
        retriedExportId: retriedExport.id,
        resumeId: exportRecord.resumeVersion.resumeId,
        resumeVersionId: exportRecord.resumeVersionId,
        exportType: "PDF",
        templateName: exportRecord.templateName,
      });

      return retriedExport;
    }

    throw new ExportServiceError("EXPORT_UNSUPPORTED");
  }

  private async findSourceVersionOrThrow(input: {
    userId: string;
    resumeId: string;
    resumeVersionId: string;
  }): Promise<SourceVersionRecord> {
    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: input.resumeVersionId,
        resumeId: input.resumeId,
        userId: input.userId,
      },
      select: {
        ...resumeVersionExportSelect,
        contentMarkdown: true,
        contentJson: true,
      },
    });

    if (sourceVersion) {
      return sourceVersion;
    }

    const resume = await prisma.resume.findFirst({
      where: {
        id: input.resumeId,
        userId: input.userId,
      },
      select: {
        id: true,
      },
    });

    throw new ExportServiceError(resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND");
  }

  private async createPendingExport(input: {
    userId: string;
    resumeVersionId: string;
    exportType: "MARKDOWN" | "PDF";
    templateName: string;
  }) {
    return prisma.export.create({
      data: {
        userId: input.userId,
        resumeVersionId: input.resumeVersionId,
        exportType: input.exportType,
        templateName: input.templateName,
        status: "PENDING",
      },
      include: {
        resumeVersion: {
          select: resumeVersionExportSelect,
        },
      },
    });
  }

  private async completeExport(
    input: {
      exportId: string;
      fileSize: number;
    },
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    return client.export.update({
      where: {
        id: input.exportId,
      },
      data: {
        status: "SUCCESS",
        fileUrl: `/api/exports/${input.exportId}`,
        fileSize: input.fileSize,
      },
      include: {
        resumeVersion: {
          select: resumeVersionExportSelect,
        },
      },
    });
  }

  private async createAuditLog(
    input: {
      userId: string;
      resumeId: string;
      resumeVersionId: string;
      exportType: "MARKDOWN" | "PDF";
      exportId: string;
      templateName: string;
    },
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    await client.auditLog.create({
      data: {
        userId: input.userId,
        actionType: "EXPORT_CREATED",
        resourceType: "EXPORT",
        resourceId: input.exportId,
        payload: {
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
          exportType: input.exportType,
          templateName: input.templateName,
        },
      },
    });
  }

  private async createRetryAuditLog(input: {
    userId: string;
    previousExportId: string;
    retriedExportId: string;
    resumeId: string;
    resumeVersionId: string;
    exportType: "MARKDOWN" | "PDF";
    templateName: string;
  }) {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        actionType: "EXPORT_RETRIED",
        resourceType: "EXPORT",
        resourceId: input.retriedExportId,
        payload: {
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
          previousExportId: input.previousExportId,
          retriedExportId: input.retriedExportId,
          exportType: input.exportType,
          templateName: input.templateName,
        },
      },
    });
  }

  private async createDownloadAuditLog(input: {
    userId: string;
    exportId: string;
    resumeId: string;
    resumeVersionId: string;
    exportType: "MARKDOWN" | "PDF";
    templateName: string;
    fileSize: number;
    requestId?: string;
  }) {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        actionType: "EXPORT_DOWNLOADED",
        resourceType: "EXPORT",
        resourceId: input.exportId,
        payload: {
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
          exportId: input.exportId,
          exportType: input.exportType,
          templateName: input.templateName,
          fileSize: input.fileSize,
          requestId: input.requestId ?? null,
        },
      },
    });
  }

  private async failExport(
    exportId: string,
    exportType?: Extract<keyof typeof exportTypeMap, "PDF">,
  ) {
    await prisma.export
      .update({
        where: {
          id: exportId,
        },
        data: {
          status: "FAILED",
          fileUrl: null,
          fileSize: null,
        },
      })
      .catch(() => undefined);

    if (exportType) {
      await exportFileStorage
        .remove({
          exportId,
          exportType,
        })
        .catch(() => undefined);
    }
  }

  private mapExportRecord(record: {
    id: string;
    exportType: keyof typeof exportTypeMap;
    templateName: string;
    status: keyof typeof exportStatusMap;
    fileUrl: string | null;
    fileSize: number | null;
    createdAt: Date;
    resumeVersion: {
      id: string;
      resumeId: string;
      versionName: string;
      versionType: keyof typeof versionTypeMap;
      jobTargetTitle: string | null;
      jobTargetCompany: string | null;
    };
  }): ResumeExportRecord {
    return {
      id: record.id,
      resumeId: record.resumeVersion.resumeId,
      resumeVersionId: record.resumeVersion.id,
      resumeVersionName: record.resumeVersion.versionName,
      resumeVersionType: versionTypeMap[record.resumeVersion.versionType],
      jobTargetTitle: record.resumeVersion.jobTargetTitle,
      jobTargetCompany: record.resumeVersion.jobTargetCompany,
      exportType: exportTypeMap[record.exportType],
      templateName: record.templateName,
      status: exportStatusMap[record.status],
      fileUrl: record.fileUrl,
      fileSize: record.fileSize,
      createdAt: record.createdAt.toISOString(),
    };
  }
}

export const exportService = new ExportService();
