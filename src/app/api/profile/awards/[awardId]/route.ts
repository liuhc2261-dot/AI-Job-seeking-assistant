import { apiError, apiOk } from "@/lib/http";
import {
  getAuthenticatedUserId,
  getProfileApiErrorResponse,
} from "@/lib/api/profile";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { awardSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type AwardRouteContext = {
  params: Promise<{
    awardId: string;
  }>;
};

export async function PUT(request: Request, context: AwardRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "PUT /api/profile/awards/[awardId]",
    taskType: "profile_award_update",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = awardSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("奖项参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const { awardId } = await context.params;

    await profileService.updateAward(userId, awardId, parsedBody.data);
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

export async function DELETE(request: Request, context: AwardRouteContext) {
  const requestLog = createApiRequestLogger({
    request,
    route: "DELETE /api/profile/awards/[awardId]",
    taskType: "profile_award_delete",
  });
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const { awardId } = await context.params;

    await profileService.deleteAward(userId, awardId);
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
