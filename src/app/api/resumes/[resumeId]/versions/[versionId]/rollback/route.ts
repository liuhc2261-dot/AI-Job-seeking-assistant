import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { resumeService } from "@/services/resume-service";

type ResumeVersionRollbackRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ResumeVersionRollbackRouteProps,
) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/rollback",
    taskType: "resume_version_rollback",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const result = await resumeService.rollbackToVersion(userId, resumeId, versionId);

    return requestLog.finalize({
      response: apiOk(result, { status: 201 }),
      userId,
      extra: {
        resumeId,
        targetVersionId: versionId,
        createdVersionId: result.createdVersionId,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        targetVersionId: versionId,
      },
    });
  }
}
