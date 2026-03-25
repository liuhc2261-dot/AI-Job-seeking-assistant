import {
  getAuthenticatedCommercialUserId,
  getCommercialApiErrorResponse,
} from "@/lib/api/commercial";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { commercialAccessService } from "@/services/commercial-access-service";

export async function GET(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "GET /api/commerce",
    taskType: "commerce_overview_fetch",
  });
  const userId = await getAuthenticatedCommercialUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  try {
    const overview = await commercialAccessService.getCommercialOverview(userId);

    return requestLog.finalize({
      response: apiOk(overview),
      userId,
      extra: {
        currentPlan: overview.profile.planCode,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getCommercialApiErrorResponse(error),
      userId,
    });
  }
}
