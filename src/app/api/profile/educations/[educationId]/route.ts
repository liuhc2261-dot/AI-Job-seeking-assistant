import { apiError, apiOk } from "@/lib/http";
import { getAuthenticatedUserId, getProfileApiErrorResponse } from "@/lib/api/profile";
import { educationSchema } from "@/lib/validations/profile";
import { profileService } from "@/services/profile-service";

type EducationRouteContext = {
  params: Promise<{
    educationId: string;
  }>;
};

export async function PUT(request: Request, context: EducationRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = educationSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("教育经历参数不合法。", 400, parsedBody.error.flatten());
  }

  try {
    const { educationId } = await context.params;

    await profileService.updateEducation(userId, educationId, parsedBody.data);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}

export async function DELETE(_: Request, context: EducationRouteContext) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return apiError("请先登录。", 401);
  }

  try {
    const { educationId } = await context.params;

    await profileService.deleteEducation(userId, educationId);
    const snapshot = await profileService.getProfileSnapshot(userId);

    return apiOk(snapshot);
  } catch (error) {
    return getProfileApiErrorResponse(error);
  }
}
