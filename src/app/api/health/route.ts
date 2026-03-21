import { apiOk } from "@/lib/http";
import { getSystemReadiness } from "@/lib/env";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";

export function GET(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "GET /api/health",
    taskType: "health_check",
  });

  return requestLog.finalize({
    response: apiOk({
      status: "ok",
      timestamp: new Date().toISOString(),
      checks: getSystemReadiness().map((item) => ({
        key: item.key,
        configured: item.configured,
      })),
    }),
  });
}
