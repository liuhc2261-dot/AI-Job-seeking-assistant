import { apiError, apiOk } from "@/lib/http";
import { getAuthenticatedUserId, getProfileApiErrorResponse } from "@/lib/api/profile";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { profileService } from "@/services/profile-service";
import { skillSchema } from "@/lib/validations/profile";

type SkillRouteContext = {
  params: Promise<{
    skillId: string;
  }>;
};

export async function PUT(request: Request, context: SkillRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PUT /api/profile/skills/[skillId]",
    taskType: "profile_skill_update",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = skillSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("技能参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const { skillId } = await context.params;

    await profileService.updateSkill(userId, skillId, parsedBody.data);
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

export async function DELETE(request: Request, context: SkillRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "DELETE /api/profile/skills/[skillId]",
    taskType: "profile_skill_delete",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const { skillId } = await context.params;

    await profileService.deleteSkill(userId, skillId);
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
