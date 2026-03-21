import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { resumeService } from "@/services/resume-service";

type ResumeRouteProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export async function GET(_: Request, { params }: ResumeRouteProps) {
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  const { resumeId } = await params;

  try {
    const workspace = await resumeService.getResumeWorkspace(userId, resumeId);

    return apiOk(workspace);
  } catch (error) {
    return getResumeApiErrorResponse(error);
  }
}
