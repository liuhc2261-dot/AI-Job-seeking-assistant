import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { resumeDiagnoseRequestSchema } from "@/lib/validations/resume";
import { resumeDiagnosisService } from "@/services/resume-diagnosis-service";

type DiagnoseRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(request: Request, { params }: DiagnoseRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/diagnose",
    taskType: "resume_diagnose",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = resumeDiagnoseRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("简历诊断参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const report = await resumeDiagnosisService.diagnoseVersion({
      userId,
      resumeId,
      resumeVersionId: versionId,
      analysisId: parsedBody.data.analysisId,
    });

    return requestLog.finalize({
      response: apiOk(report, { status: 201 }),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
        analysisId: parsedBody.data.analysisId ?? null,
        reportId: report.id,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
        analysisId: parsedBody.data.analysisId ?? null,
      },
    });
  }
}
