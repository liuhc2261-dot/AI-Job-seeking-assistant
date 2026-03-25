import {
  getAuthenticatedCommercialUserId,
  getCommercialApiErrorResponse,
  hasValidCommerceCallbackSecret,
} from "@/lib/api/commercial";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { commerceConfirmOrderSchema } from "@/lib/validations/commercial";
import { commercialAccessService } from "@/services/commercial-access-service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  },
) {
  const { orderId } = await context.params;
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/commerce/orders/[orderId]/confirm",
    taskType: "commerce_order_confirm",
  });
  const callbackAuthorized = hasValidCommerceCallbackSecret(request);
  const authenticatedUserId = callbackAuthorized
    ? null
    : await getAuthenticatedCommercialUserId();

  if (!callbackAuthorized && !authenticatedUserId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  if (!callbackAuthorized && process.env.NODE_ENV === "production") {
    return requestLog.finalize({
      response: apiError("当前环境不允许前端直接确认支付，请等待支付回调。", 403),
      userId: authenticatedUserId,
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = commerceConfirmOrderSchema.safeParse(body ?? {});

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("支付确认参数不合法。", 400, parsedBody.error.flatten()),
      userId: authenticatedUserId,
    });
  }

  try {
    const result = await commercialAccessService.confirmOrderPaid({
      orderId,
      userId: authenticatedUserId ?? undefined,
      paymentChannel: parsedBody.data.paymentChannel,
      externalOrderId: parsedBody.data.externalOrderId || undefined,
      notes: parsedBody.data.notes || undefined,
      paidStatus: callbackAuthorized ? "PAID" : "MANUAL_GRANTED",
    });

    return requestLog.finalize({
      response: apiOk(result),
      userId: authenticatedUserId,
      extra: {
        orderId: result.order.id,
        orderStatus: result.order.status,
        alreadyProcessed: result.alreadyProcessed,
        callbackAuthorized,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getCommercialApiErrorResponse(error),
      userId: authenticatedUserId,
    });
  }
}
