import { apiError, apiOk } from "@/lib/http";
import { getAuthenticatedUserId, getProfileApiErrorResponse } from "@/lib/api/profile";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { educationSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type EducationRouteContext = {
  params: Promise<{
    educationId: string;
  }>;
};

export async function PUT(request: Request, context: EducationRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PUT /api/profile/educations/[educationId]",
    taskType: "profile_education_update",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = educationSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("教育经历参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const { educationId } = await context.params;

    await profileService.updateEducation(userId, educationId, parsedBody.data);
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

export async function DELETE(request: Request, context: EducationRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "DELETE /api/profile/educations/[educationId]",
    taskType: "profile_education_delete",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const { educationId } = await context.params;

    await profileService.deleteEducation(userId, educationId);
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
