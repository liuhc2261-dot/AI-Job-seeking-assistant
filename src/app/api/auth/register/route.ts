import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { captureServerException } from "@/lib/monitoring/sentry";
import { registerSchema } from "@/lib/validations/auth";
import { AuthServiceError, authService } from "@/services/auth-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/auth/register",
    taskType: "register",
  });
  const body = await request.json().catch(() => null);
  const parsedBody = registerSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("注册参数不合法。", 400, parsedBody.error.flatten()),
    });
  }

  try {
    const user = await authService.register({
      email: parsedBody.data.email,
      password: parsedBody.data.password,
    });

    return requestLog.finalize({
      response: apiOk(
        {
          id: user.id,
          email: user.email,
        },
        { status: 201 },
      ),
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof AuthServiceError && error.code === "EMAIL_EXISTS") {
      return requestLog.finalize({
        response: apiError("该邮箱已被注册。", 409),
      });
    }

    captureServerException(error, {
      area: "auth-api",
      tags: {
        action: "register",
      },
    });

    return requestLog.finalize({
      response: apiError("注册失败，请稍后重试。", 500),
    });
  }
}
