import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { markdownExportRequestSchema } from "@/lib/validations/export";
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
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/export/md",
    taskType: "export_markdown_create",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = markdownExportRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("Markdown 导出参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const exportRecord = await exportService.createMarkdownExport({
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
