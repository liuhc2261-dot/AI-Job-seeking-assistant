import {
  getAuthenticatedCommercialUserId,
  getCommercialApiErrorResponse,
} from "@/lib/api/commercial";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { commerceCheckoutRequestSchema } from "@/lib/validations/commercial";
import { commercialAccessService } from "@/services/commercial-access-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/commerce/checkout",
    taskType: "commerce_checkout_create",
  });
  const userId = await getAuthenticatedCommercialUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = commerceCheckoutRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("支付订单参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  try {
    const checkout = await commercialAccessService.createCheckoutOrder({
      userId,
      planCode: parsedBody.data.planCode,
      paymentChannel: parsedBody.data.paymentChannel,
    });

    return requestLog.finalize({
      response: apiOk(checkout, { status: checkout.reusedExistingOrder ? 200 : 201 }),
      userId,
      extra: {
        orderId: checkout.order.id,
        planCode: checkout.order.planCode,
        reusedExistingOrder: checkout.reusedExistingOrder,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getCommercialApiErrorResponse(error),
      userId,
    });
  }
}
