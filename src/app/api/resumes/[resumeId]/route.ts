import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { resumeService } from "@/services/resume-service";

type ResumeRouteProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function GET(request: Request, { params }: ResumeRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "GET /api/resumes/[resumeId]",
    taskType: "resume_workspace_fetch",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const { resumeId } = await params;

  try {
    const workspace = await resumeService.getResumeWorkspace(userId, resumeId);

    return requestLog.finalize({
      response: apiOk(workspace),
      userId,
      extra: {
        resumeId,
        resumeVersionId: workspace.currentVersion?.id ?? null,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
      },
    });
  }
}
