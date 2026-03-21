import { apiError, apiOk } from "@/lib/http";
import {
  getAuthenticatedUserId,
  getProfileApiErrorResponse,
} from "@/lib/api/profile";
import { awardSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type AwardRouteContext = {
  params: Promise<{
    awardId: string;
  }>;
};

export async function PUT(request: Request, context: AwardRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = awardSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("奖项参数不合法。", 400, parsedBody.error.flatten());
  }

  try {
    const { awardId } = await context.params;

    await profileService.updateAward(userId, awardId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: AwardRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  try {
    const { awardId } = await context.params;

    await profileService.deleteAward(userId, awardId);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}
