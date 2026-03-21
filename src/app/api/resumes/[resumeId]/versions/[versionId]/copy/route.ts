import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { resumeService } from "@/services/resume-service";

type ResumeVersionCopyRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ResumeVersionCopyRouteProps,
) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/copy",
    taskType: "resume_version_copy",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const result = await resumeService.copyVersion(userId, resumeId, versionId);

    return requestLog.finalize({
      response: apiOk(result, { status: 201 }),
      userId,
      extra: {
        resumeId,
        sourceVersionId: versionId,
        createdVersionId: result.createdVersionId,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        sourceVersionId: versionId,
      },
    });
  }
}
