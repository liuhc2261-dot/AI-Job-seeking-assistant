import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { diagnosisApplyRequestSchema } from "@/lib/validations/resume";
import { resumeDiagnosisService } from "@/services/resume-diagnosis-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/diagnose/apply",
    taskType: "diagnose_apply",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = diagnosisApplyRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("诊断建议应用参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const result = await resumeDiagnosisService.applySuggestions({
      userId,
      resumeId: parsedBody.data.resumeId,
      resumeVersionId: parsedBody.data.resumeVersionId,
      reportId: parsedBody.data.reportId,
      suggestionIds: parsedBody.data.suggestionIds,
    });

    return requestLog.finalize({
      response: apiOk(result, { status: 201 }),
      userId,
      extra: {
        resumeId: parsedBody.data.resumeId,
        resumeVersionId: parsedBody.data.resumeVersionId,
        reportId: parsedBody.data.reportId,
        appliedSuggestionCount: parsedBody.data.suggestionIds.length,
        createdVersionId: result.workspace.currentVersion?.id ?? null,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId: parsedBody.data.resumeId,
        resumeVersionId: parsedBody.data.resumeVersionId,
        reportId: parsedBody.data.reportId,
      },
    });
  }
}
