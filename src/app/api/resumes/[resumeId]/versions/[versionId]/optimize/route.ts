import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { resumeOptimizeRequestSchema } from "@/lib/validations/resume";
import { resumeOptimizationService } from "@/services/resume-optimization-service";

type ResumeOptimizeRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: ResumeOptimizeRouteProps,
) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/optimize",
    taskType: "resume_optimize",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = resumeOptimizeRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("岗位优化参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const workspace = await resumeOptimizationService.optimizeVersion({
      userId,
      resumeId,
      resumeVersionId: versionId,
      analysisId: parsedBody.data.analysisId,
    });

    return requestLog.finalize({
      response: apiOk(workspace, { status: 201 }),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
        analysisId: parsedBody.data.analysisId,
        createdVersionId: workspace.currentVersion?.id ?? null,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
        analysisId: parsedBody.data.analysisId,
      },
    });
  }
}
