import { getAuthenticatedResumeUserId, getResumeApiErrorResponse } from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { jdParseRequestSchema } from "@/lib/validations/resume";
import { jdAnalysisService } from "@/services/jd-analysis-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/jd/parse",
    taskType: "jd_parse",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = jdParseRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("JD 解析参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const analysis = await jdAnalysisService.parseForVersion({
      userId,
      resumeId: parsedBody.data.resumeId,
      resumeVersionId: parsedBody.data.resumeVersionId,
      jdText: parsedBody.data.jdText,
    });

    return requestLog.finalize({
      response: apiOk(analysis, { status: 201 }),
      userId,
      extra: {
        resumeId: parsedBody.data.resumeId,
        resumeVersionId: parsedBody.data.resumeVersionId,
        analysisId: analysis.id,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId: parsedBody.data.resumeId,
        resumeVersionId: parsedBody.data.resumeVersionId,
      },
    });
  }
}
