import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { captureServerException } from "@/lib/monitoring/sentry";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { authService } from "@/services/auth-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/auth/forgot-password",
    taskType: "forgot_password",
  });
  const body = await request.json().catch(() => null);
  const parsedBody = forgotPasswordSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("找回密码参数不合法。", 400, parsedBody.error.flatten()),
    });
  }

  try {
    const result = await authService.requestPasswordReset(parsedBody.data.email);

    return requestLog.finalize({
      response: apiOk({
        requested: true,
        developmentResetLink: result.resetLink,
      }),
      userId: result.userId,
    });
  } catch (error) {
    captureServerException(error, {
      area: "auth-api",
      tags: {
        action: "forgot_password",
      },
    });

    return requestLog.finalize({
      response: apiError("找回密码请求失败，请稍后重试。", 500),
    });
  }
}
