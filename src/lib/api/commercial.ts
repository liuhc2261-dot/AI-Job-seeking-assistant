import { getAuthSession } from "@/auth";
import { apiError } from "@/lib/http";
import { captureServerException } from "@/lib/monitoring/sentry";
import { env } from "@/lib/env";
import { CommercialAccessServiceError } from "@/services/commercial-access-service";

export async function getAuthenticatedCommercialUserId() {
  const session = await getAuthSession();

  return session?.user?.id ?? null;
}

export function hasValidCommerceCallbackSecret(request: Request) {
  const incomingSecret = request.headers.get("x-commerce-callback-secret")?.trim();

  return Boolean(
    env.commerceCallbackSecret &&
      incomingSecret &&
      incomingSecret === env.commerceCallbackSecret,
  );
}

export function getCommercialApiErrorResponse(error: unknown) {
  if (error instanceof CommercialAccessServiceError) {
    switch (error.code) {
      case "USER_NOT_FOUND":
        return apiError("账号不存在，暂时无法处理套餐订单。", 404);
      case "PLAN_NOT_FOUND":
        return apiError("当前套餐不存在或暂不支持下单。", 404);
      case "ORDER_NOT_FOUND":
        return apiError("订单不存在或无权访问。", 404);
      case "ORDER_NOT_PAYABLE":
        return apiError("当前订单状态不允许再次确认支付。", 409, error.details);
      case "MASTER_RESUME_LIMIT_REACHED":
      case "JD_TAILOR_LIMIT_REACHED":
      case "DIAGNOSIS_LIMIT_REACHED":
      case "PDF_EXPORT_LIMIT_REACHED":
        return apiError("当前账号权益不足，请先升级套餐。", 402, error.details);
      default:
        captureServerException(error, {
          area: "commerce-api",
          tags: {
            errorType: "CommercialAccessServiceError",
            code: error.code,
          },
        });
        return apiError("套餐订单处理失败，请稍后重试。", 500);
    }
  }

  captureServerException(error, {
    area: "commerce-api",
  });

  return apiError("套餐订单处理失败，请稍后重试。", 500);
}
