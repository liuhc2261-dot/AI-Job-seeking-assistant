import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import {
  resumeManualSaveSchema,
  resumeVersionRenameSchema,
} from "@/lib/validations/resume";
import { resumeService } from "@/services/resume-service";

type ResumeVersionRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function PUT(request: Request, { params }: ResumeVersionRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PUT /api/resumes/[resumeId]/versions/[versionId]",
    taskType: "resume_version_manual_save",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = resumeManualSaveSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("简历编辑参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const workspace = await resumeService.saveManualVersion(
      userId,
      resumeId,
      versionId,
      parsedBody.data.contentJson,
    );

    return requestLog.finalize({
      response: apiOk(workspace),
      userId,
      extra: {
        resumeId,
        sourceVersionId: versionId,
        createdVersionId: workspace.currentVersion?.id ?? null,
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

export async function PATCH(request: Request, { params }: ResumeVersionRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PATCH /api/resumes/[resumeId]/versions/[versionId]",
    taskType: "resume_version_rename",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = resumeVersionRenameSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("版本重命名参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const result = await resumeService.renameVersion(
      userId,
      resumeId,
      versionId,
      parsedBody.data.versionName,
    );

    return requestLog.finalize({
      response: apiOk(result),
      userId,
      extra: {
        resumeId,
        versionId,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        versionId,
      },
    });
  }
}

export async function DELETE(request: Request, { params }: ResumeVersionRouteProps) {
  const requestLog = createApiRequestLogger({
    request,
    route: "DELETE /api/resumes/[resumeId]/versions/[versionId]",
    taskType: "resume_version_delete",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const result = await resumeService.deleteVersion(userId, resumeId, versionId);

    return requestLog.finalize({
      response: apiOk(result),
      userId,
      extra: {
        resumeId,
        versionId,
        deletedWasCurrent: result.deletedWasCurrent,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        versionId,
      },
    });
  }
}
