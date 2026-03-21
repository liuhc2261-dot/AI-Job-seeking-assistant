import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { captureServerException } from "@/lib/monitoring/sentry";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { AuthServiceError, authService } from "@/services/auth-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/auth/reset-password",
    taskType: "reset_password",
  });
  const body = await request.json().catch(() => null);
  const parsedBody = resetPasswordSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("重置密码参数不合法。", 400, parsedBody.error.flatten()),
    });
  }

  try {
    const result = await authService.resetPassword({
      token: parsedBody.data.token,
      password: parsedBody.data.password,
    });

    return requestLog.finalize({
      response: apiOk({
        reset: true,
      }),
      userId: result.userId,
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      if (error.code === "RESET_TOKEN_INVALID" || error.code === "RESET_TOKEN_EXPIRED") {
        return requestLog.finalize({
          response: apiError("重置链接无效或已过期，请重新发起找回密码。", 400),
        });
      }

      if (error.code === "USER_DISABLED") {
        return requestLog.finalize({
          response: apiError("当前账号不可用，请联系管理员。", 403),
        });
      }
    }

    captureServerException(error, {
      area: "auth-api",
      tags: {
        action: "reset_password",
      },
    });

    return requestLog.finalize({
      response: apiError("重置密码失败，请稍后重试。", 500),
    });
  }
}
