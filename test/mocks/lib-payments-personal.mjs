export function normalizeMultilineSecret(value) {
  return value;
}

export function normalizePem(value) {
  return value;
}

export function resolveAppUrl(pathname) {
  return `https://example.com${pathname}`;
}

export function hasMerchantPaymentConfig() {
  return false;
}

export function getPersonalCollectionQrUrl(channel) {
  if (channel === "wechat") {
    return "https://example.com/payments/wechat-qr.png";
  }

  return "";
}

export function hasPersonalCollectionQr(channel) {
  return channel === "wechat";
}

export function isPaymentChannelConfigured(channel) {
  return channel === "manual" || channel === "wechat";
}

export function createUnavailablePaymentSession(channel) {
  return {
    channel,
    status: "not_configured",
    expiresAt: null,
    codeUrl: null,
    paymentUrl: null,
    qrCodeDataUrl: null,
    displayTitle: "未配置",
    displayDescription: "未配置",
  };
}
