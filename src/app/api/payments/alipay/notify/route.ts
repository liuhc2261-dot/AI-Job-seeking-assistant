import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { commercialAccessService } from "@/services/commercial-access-service";
import { PaymentServiceError, paymentService } from "@/services/payment-service";

export async function POST(request: Request) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/payments/alipay/notify",
    taskType: "alipay_payment_notify",
  });

  try {
    const callback = await paymentService.handleAlipayCallback(request);

    if (!callback.handled) {
      return requestLog.finalize({
        response: new Response("success", { status: 200 }),
      });
    }

    await commercialAccessService.confirmOrderPaid({
      orderId: callback.orderId,
      paymentChannel: callback.paymentChannel,
      externalOrderId: callback.externalOrderId,
      notes: "alipay_notify_paid",
      paidStatus: "PAID",
    });

    return requestLog.finalize({
      response: new Response("success", { status: 200 }),
      extra: {
        orderId: callback.orderId,
        paymentChannel: callback.paymentChannel,
      },
    });
  } catch (error) {
    const status =
      error instanceof PaymentServiceError && error.code === "PAYMENT_SIGNATURE_INVALID"
        ? 401
        : 500;

    return requestLog.finalize({
      response: new Response("failure", { status }),
    });
  }
}
