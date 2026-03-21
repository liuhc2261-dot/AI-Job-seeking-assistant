import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { pdfExportRequestSchema } from "@/lib/validations/export";
import { exportService } from "@/services/export-service";

type ExportRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(request: Request, { params }: ExportRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/export/pdf",
    taskType: "export_pdf_create",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = pdfExportRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("PDF 导出参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const exportRecord = await exportService.createPdfExport({
      userId,
      resumeId,
      resumeVersionId: versionId,
      templateName: parsedBody.data.templateName,
    });

    return requestLog.finalize({
      response: apiOk(exportRecord, { status: 201 }),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
        exportId: exportRecord.id,
        exportStatus: exportRecord.status,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
      },
    });
  }
}
