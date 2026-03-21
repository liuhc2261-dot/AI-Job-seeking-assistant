import { apiError, apiOk } from "@/lib/http";
import { getAuthenticatedUserId, getProfileApiErrorResponse } from "@/lib/api/profile";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { projectSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type ProjectRouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function PUT(request: Request, context: ProjectRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PUT /api/profile/projects/[projectId]",
    taskType: "profile_project_update",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = projectSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("项目经历参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const { projectId } = await context.params;

    await profileService.updateProject(userId, projectId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return requestLog.finalize({
      response: apiOk(snapshot),
      userId,
    });
  } catch (error) {
    return requestLog.finalize({
      response: getProfileApiErrorResponse(error),
      userId,
    });
  }
}

export async function DELETE(request: Request, context: ProjectRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "DELETE /api/profile/projects/[projectId]",
    taskType: "profile_project_delete",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const { projectId } = await context.params;

    await profileService.deleteProject(userId, projectId);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return requestLog.finalize({
      response: apiOk(snapshot),
      userId,
    });
  } catch (error) {
    return requestLog.finalize({
      response: getProfileApiErrorResponse(error),
      userId,
    });
  }
}
