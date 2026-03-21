import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { resumeService } from "@/services/resume-service";

type ResumeVersionRollbackRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(
  _: Request,
  { params }: ResumeVersionRollbackRouteProps,
) {
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  const { resumeId, versionId } = await params;

  try {
    const result = await resumeService.rollbackToVersion(userId, resumeId, versionId);

    return apiOk(result, { status: 201 });
  } catch (error) {
    return getResumeApiErrorResponse(error);
  }
}
