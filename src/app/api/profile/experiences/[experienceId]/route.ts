import { apiError, apiOk } from "@/lib/http";
import {
  getAuthenticatedUserId,
  getProfileApiErrorResponse,
} from "@/lib/api/profile";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { experienceSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type ExperienceRouteContext = {
  params: Promise<{
    experienceId: string;
  }>;
};

export async function PUT(request: Request, context: ExperienceRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PUT /api/profile/experiences/[experienceId]",
    taskType: "profile_experience_update",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = experienceSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("实习经历参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const { experienceId } = await context.params;

    await profileService.updateExperience(userId, experienceId, parsedBody.data);
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

export async function DELETE(request: Request, context: ExperienceRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "DELETE /api/profile/experiences/[experienceId]",
    taskType: "profile_experience_delete",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const { experienceId } = await context.params;

    await profileService.deleteExperience(userId, experienceId);
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
