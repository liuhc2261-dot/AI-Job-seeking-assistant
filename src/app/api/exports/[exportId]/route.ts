import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { exportService } from "@/services/export-service";

type ExportDownloadRouteProps = {
  params: Promise<{
    exportId: string;
  }>;
};

function buildContentDisposition(input: {
  fileNameAscii: string;
  fileNameUtf8: string;
}) {
  return `attachment; filename="${input.fileNameAscii}"; filename*=UTF-8''${encodeURIComponent(
    input.fileNameUtf8,
  )}`;
}

export async function GET(request: Request, { params }: ExportDownloadRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "GET /api/exports/[exportId]",
    taskType: "export_download",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const { exportId } = await params;

  try {
    const download = await exportService.getExportDownload({
      userId,
      exportId,
      requestId: requestLog.requestId,
    });
    const responseBody =
      typeof download.content === "string"
        ? download.content
        : new Uint8Array(download.content);

    return requestLog.finalize({
      response: new Response(responseBody, {
        status: 200,
        headers: {
          "Content-Type": download.contentType,
          "Content-Length": String(download.fileSize),
          "Content-Disposition": buildContentDisposition({
            fileNameAscii: download.fileNameAscii,
            fileNameUtf8: download.fileNameUtf8,
          }),
          "Cache-Control": "private, no-store",
        },
      }),
      userId,
      extra: {
        exportId: download.exportId,
        exportStatus: download.exportStatus,
        exportType: download.exportType,
        resumeId: download.resumeId,
        resumeVersionId: download.resumeVersionId,
        fileSize: download.fileSize,
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
