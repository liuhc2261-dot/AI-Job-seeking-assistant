import { getCommercialApiErrorResponse } from "@/lib/api/commercial";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { commercialAccessService } from "@/services/commercial-access-service";
import { paymentService } from "@/services/payment-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/payments/wechat/notify",
    taskType: "wechat_payment_notify",
  });

  try {
    const callback = await paymentService.handleWechatCallback(request);

    if (!callback.handled) {
      return requestLog.finalize({
        response: Response.json({
          code: "SUCCESS",
          message: "ignored",
        }),
      });
    }

    await commercialAccessService.confirmOrderPaid({
      orderId: callback.orderId,
      paymentChannel: callback.paymentChannel,
      externalOrderId: callback.externalOrderId,
      notes: "wechat_notify_paid",
      paidStatus: "PAID",
    });

    return requestLog.finalize({
      response: Response.json({
        code: "SUCCESS",
        message: "success",
      }),
      extra: {
        orderId: callback.orderId,
        paymentChannel: callback.paymentChannel,
      },
    });
  } catch (error) {
    const response = getCommercialApiErrorResponse(error);

    return requestLog.finalize({
      response: Response.json(
        {
          code: "FAIL",
          message: response.status === 401 ? "signature invalid" : "callback error",
        },
        { status: response.status === 401 ? 401 : 500 },
      ),
    });
  }
}
