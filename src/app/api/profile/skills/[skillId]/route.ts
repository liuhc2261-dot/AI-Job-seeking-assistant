import { apiError, apiOk } from "@/lib/http";
import { getAuthenticatedUserId, getProfileApiErrorResponse } from "@/lib/api/profile";
import { profileService } from "@/services/profile-service";
import { skillSchema } from "@/lib/validations/profile";

type SkillRouteContext = {
  params: Promise<{
    skillId: string;
  }>;
};

export async function PUT(request: Request, context: SkillRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = skillSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("技能参数不合法。", 400, parsedBody.error.flatten());
  }

  try {
    const { skillId } = await context.params;

    await profileService.updateSkill(userId, skillId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: SkillRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  try {
    const { skillId } = await context.params;

    await profileService.deleteSkill(userId, skillId);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}
