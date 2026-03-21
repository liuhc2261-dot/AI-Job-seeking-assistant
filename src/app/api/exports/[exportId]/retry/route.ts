import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { exportService } from "@/services/export-service";

type ExportRetryRouteProps = {
  params: Promise<{
    exportId: string;
  }>;
};

export async function POST(request: Request, { params }: ExportRetryRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/exports/[exportId]/retry",
    taskType: "export_retry",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const { exportId } = await params;

  try {
    const exportRecord = await exportService.retryExport({
      userId,
      exportId,
    });

    return requestLog.finalize({
      response: apiOk(exportRecord, { status: 201 }),
      userId,
      extra: {
        exportId: exportRecord.id,
        exportStatus: exportRecord.status,
        resumeId: exportRecord.resumeId,
        resumeVersionId: exportRecord.resumeVersionId,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        exportId,
      },
    });
  }
}
