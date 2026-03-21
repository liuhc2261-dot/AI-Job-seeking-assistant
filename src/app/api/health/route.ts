import { apiOk } from "@/lib/http";
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
    }),
  });
}
