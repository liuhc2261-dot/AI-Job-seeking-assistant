import { getAuthSession } from "@/auth";
import { apiError } from "@/lib/http";
import { captureServerException } from "@/lib/monitoring/sentry";
import { ProfileServiceError } from "@/services/profile-service";

export async function getAuthenticatedUserId() {
  const session = await getAuthSession();

  return session?.user?.id ?? null;
}

export function getProfileApiErrorResponse(error: unknown) {
  if (error instanceof ProfileServiceError) {
    switch (error.code) {
      case "USER_NOT_FOUND":
        return apiError("用户不存在。", 404);
      case "EDUCATION_NOT_FOUND":
        return apiError("教育经历不存在或无权访问。", 404);
      case "PROJECT_NOT_FOUND":
        return apiError("项目经历不存在或无权访问。", 404);
      case "EXPERIENCE_NOT_FOUND":
        return apiError("实习经历不存在或无权访问。", 404);
      case "AWARD_NOT_FOUND":
        return apiError("奖项记录不存在或无权访问。", 404);
      case "SKILL_NOT_FOUND":
        return apiError("技能记录不存在或无权访问。", 404);
      default:
        captureServerException(error, {
          area: "profile-api",
          tags: {
            errorType: "ProfileServiceError",
            code: error.code,
          },
        });
        return apiError("资料操作失败，请稍后重试。", 500);
    }
  }

  captureServerException(error, {
    area: "profile-api",
  });

  return apiError("资料操作失败，请稍后重试。", 500);
}
