import { apiError, apiOk } from "@/lib/http";
import {
  getAuthenticatedUserId,
  getProfileApiErrorResponse,
} from "@/lib/api/profile";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { experienceSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/profile/experiences",
    taskType: "profile_experience_create",
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
    await profileService.createExperience(userId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return requestLog.finalize({
      response: apiOk(snapshot, { status: 201 }),
      userId,
    });
  } catch (error) {
    return requestLog.finalize({
      response: getProfileApiErrorResponse(error),
      userId,
    });
  }
}
