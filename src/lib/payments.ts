import { env } from "@/lib/env";
import type {
  CommercePaymentChannelKind,
  CommercePaymentSession,
} from "@/types/commercial";

export function normalizeMultilineSecret(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

export function normalizePem(value: string) {
  const trimmed = normalizeMultilineSecret(value);

  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
}

export function resolveAppUrl(pathname: string) {
  return new URL(pathname, env.appUrl).toString();
}

export function isPaymentChannelConfigured(channel: CommercePaymentChannelKind) {
  if (channel === "wechat") {
    return Boolean(
      env.wechatPayAppId &&
        env.wechatPayMerchantId &&
        env.wechatPaySerialNo &&
        env.wechatPayPrivateKey &&
        env.wechatPayApiV3Key &&
        env.wechatPayPlatformPublicKey,
    );
  }

  if (channel === "alipay") {
    return Boolean(
      env.alipayAppId &&
        env.alipayPrivateKey &&
        env.alipayPublicKey &&
        env.alipayGatewayUrl,
    );
  }

  return true;
}

export function createUnavailablePaymentSession(
  channel: CommercePaymentChannelKind,
): CommercePaymentSession {
  const providerLabel = channel === "wechat" ? "微信支付" : channel === "alipay" ? "支付宝" : "人工开通";

  return {
    channel,
    status: "not_configured",
    expiresAt: null,
    codeUrl: null,
    paymentUrl: null,
    qrCodeDataUrl: null,
    displayTitle: `${providerLabel}待配置`,
    displayDescription: `${providerLabel}环境变量尚未配置完成，当前不能创建真实支付二维码。`,
  };
}
