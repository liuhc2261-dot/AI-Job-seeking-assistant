import { nextAuthHandler } from "@/auth";
import { apiError } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { captureServerException } from "@/lib/monitoring/sentry";

type NextAuthRouteContext = {
  params: Promise<{
    nextauth?: string[];
  }>;
};

async function handleAuthRequest(
  request: Request,
  context: NextAuthRouteContext,
  method: "GET" | "POST",
) {
  const requestLog = createApiRequestLogger({
    request,
    route: `${method} /api/auth/[...nextauth]`,
    taskType: "auth_session",
  });

  try {
    const response = await nextAuthHandler(request, context);

    return requestLog.finalize({
      response,
    });
  } catch (error) {
    captureServerException(error, {
      area: "auth-nextauth-route",
      tags: {
        method,
      },
    });

    return requestLog.finalize({
      response: apiError("认证处理失败，请稍后重试。", 500),
    });
  }
}

export function GET(request: Request, context: NextAuthRouteContext) {
  return handleAuthRequest(request, context, "GET");
}

export function POST(request: Request, context: NextAuthRouteContext) {
  return handleAuthRequest(request, context, "POST");
}
