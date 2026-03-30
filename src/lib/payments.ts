import { env } from "@/lib/env";
import type {
  CommercePaymentChannelKind,
  CommercePaymentSession,
} from "@/types/commercial";

function hasConfiguredValue(value: string | undefined | null) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return false;
  }

  return !/^<replace-with-.*>$/.test(normalized) && !/^<.*>$/.test(normalized);
}

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

export function hasMerchantPaymentConfig(channel: CommercePaymentChannelKind) {
  if (channel === "wechat") {
    return (
      hasConfiguredValue(env.wechatPayAppId) &&
      hasConfiguredValue(env.wechatPayMerchantId) &&
      hasConfiguredValue(env.wechatPaySerialNo) &&
      hasConfiguredValue(env.wechatPayPrivateKey) &&
      hasConfiguredValue(env.wechatPayApiV3Key) &&
      hasConfiguredValue(env.wechatPayPlatformPublicKey)
    );
  }

  if (channel === "alipay") {
    return (
      hasConfiguredValue(env.alipayAppId) &&
      hasConfiguredValue(env.alipayPrivateKey) &&
      hasConfiguredValue(env.alipayPublicKey) &&
      hasConfiguredValue(env.alipayGatewayUrl)
    );
  }

  return false;
}

export function getPersonalCollectionQrUrl(
  channel: CommercePaymentChannelKind,
) {
  if (channel === "wechat") {
    return env.wechatPersonalCollectionQrUrl.trim();
  }

  if (channel === "alipay") {
    return env.alipayPersonalCollectionQrUrl.trim();
  }

  return "";
}

export function hasPersonalCollectionQr(channel: CommercePaymentChannelKind) {
  return hasConfiguredValue(getPersonalCollectionQrUrl(channel));
}

export function isPaymentChannelConfigured(channel: CommercePaymentChannelKind) {
  if (channel === "manual") {
    return true;
  }

  return hasMerchantPaymentConfig(channel) || hasPersonalCollectionQr(channel);
}

export function createUnavailablePaymentSession(
  channel: CommercePaymentChannelKind,
): CommercePaymentSession {
  const providerLabel =
    channel === "wechat"
      ? "微信支付"
      : channel === "alipay"
        ? "支付宝"
        : "人工开通";

  return {
    channel,
    status: "not_configured",
    expiresAt: null,
    codeUrl: null,
    paymentUrl: null,
    qrCodeDataUrl: null,
    displayTitle: `${providerLabel}暂未配置`,
    displayDescription: `当前环境还没有完成 ${providerLabel} 配置，请补充商户参数或个人收款码后再创建订单。`,
  };
}
