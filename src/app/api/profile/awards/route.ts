import { apiError, apiOk } from "@/lib/http";
import {
  getAuthenticatedUserId,
  getProfileApiErrorResponse,
} from "@/lib/api/profile";
import { awardSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

export async function POST(request: Request) {
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
    await profileService.createAward(userId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot, { status: 201 });
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}
