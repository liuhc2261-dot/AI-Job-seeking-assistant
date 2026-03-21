import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { resumeGenerationRequestSchema } from "@/lib/validations/resume";
import { resumeService } from "@/services/resume-service";

export async function GET(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "GET /api/resumes",
    taskType: "resume_hub_fetch",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const hub = await resumeService.getResumeHub(userId);

    return requestLog.finalize({
      response: apiOk(hub),
      userId,
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
    });
  }
}

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes",
    taskType: "resume_generate",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = resumeGenerationRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("母版简历生成参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const workspace = await resumeService.generateMasterResume(
      userId,
      parsedBody.data.style,
    );

    return requestLog.finalize({
      response: apiOk(workspace, { status: 201 }),
      userId,
      extra: {
        resumeId: workspace.resume.id,
        resumeVersionId: workspace.currentVersion?.id ?? null,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
    });
  }
}
