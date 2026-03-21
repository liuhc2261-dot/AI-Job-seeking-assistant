import { apiError, apiOk } from "@/lib/http";
import {
  getAuthenticatedUserId,
  getProfileApiErrorResponse,
} from "@/lib/api/profile";
import { experienceSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type ExperienceRouteContext = {
  params: Promise<{
    experienceId: string;
  }>;
};

export async function PUT(request: Request, context: ExperienceRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = experienceSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("实习经历参数不合法。", 400, parsedBody.error.flatten());
  }

  try {
    const { experienceId } = await context.params;

    await profileService.updateExperience(userId, experienceId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: ExperienceRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  try {
    const { experienceId } = await context.params;

    await profileService.deleteExperience(userId, experienceId);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}
