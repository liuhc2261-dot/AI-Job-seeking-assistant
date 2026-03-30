type ReadinessItem = {
  key: string;
  label: string;
  configured: boolean;
  description: string;
};

function hasConfiguredValue(value: string | undefined | null) {
  const normalized = (value ?? "").trim();

  if (!normalized) {
    return false;
  }

  return !/^<replace-with-.*>$/.test(normalized) && !/^<.*>$/.test(normalized);
}

function hasWechatMerchantConfig() {
  return (
    hasConfiguredValue(process.env.WECHAT_PAY_APP_ID) &&
    hasConfiguredValue(process.env.WECHAT_PAY_MCH_ID) &&
    hasConfiguredValue(process.env.WECHAT_PAY_SERIAL_NO) &&
    hasConfiguredValue(process.env.WECHAT_PAY_PRIVATE_KEY) &&
    hasConfiguredValue(process.env.WECHAT_PAY_API_V3_KEY) &&
    hasConfiguredValue(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY)
  );
}

function hasAlipayMerchantConfig() {
  return (
    hasConfiguredValue(process.env.ALIPAY_APP_ID) &&
    hasConfiguredValue(process.env.ALIPAY_PRIVATE_KEY) &&
    hasConfiguredValue(process.env.ALIPAY_PUBLIC_KEY) &&
    hasConfiguredValue(process.env.ALIPAY_GATEWAY_URL)
  );
}

function hasWechatPersonalQrConfig() {
  return hasConfiguredValue(process.env.WECHAT_PERSONAL_COLLECTION_QR_URL);
}

function hasAlipayPersonalQrConfig() {
  return hasConfiguredValue(process.env.ALIPAY_PERSONAL_COLLECTION_QR_URL);
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  authTrustHost: process.env.AUTH_TRUST_HOST ?? "false",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openAiTrialModel:
    process.env.OPENAI_TRIAL_MODEL ??
    process.env.OPENAI_MODEL ??
    "gpt-4.1-mini",
  openAiPaidModel:
    process.env.OPENAI_PAID_MODEL ??
    process.env.OPENAI_MODEL ??
    "gpt-4.1-mini",
  sentryDsn:
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN ?? "",
  posthogKey:
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN ??
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    "",
  posthogHost:
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  commerceCallbackSecret: process.env.COMMERCE_CALLBACK_SECRET ?? "",
  wechatPayAppId: process.env.WECHAT_PAY_APP_ID ?? "",
  wechatPayMerchantId: process.env.WECHAT_PAY_MCH_ID ?? "",
  wechatPaySerialNo: process.env.WECHAT_PAY_SERIAL_NO ?? "",
  wechatPayPrivateKey: process.env.WECHAT_PAY_PRIVATE_KEY ?? "",
  wechatPayApiV3Key: process.env.WECHAT_PAY_API_V3_KEY ?? "",
  wechatPayPlatformPublicKey:
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY ?? "",
  wechatPayNotifyPath:
    process.env.WECHAT_PAY_NOTIFY_PATH ?? "/api/payments/wechat/notify",
  wechatPersonalCollectionQrUrl:
    process.env.WECHAT_PERSONAL_COLLECTION_QR_URL ?? "",
  alipayAppId: process.env.ALIPAY_APP_ID ?? "",
  alipayPrivateKey: process.env.ALIPAY_PRIVATE_KEY ?? "",
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY ?? "",
  alipayGatewayUrl:
    process.env.ALIPAY_GATEWAY_URL ?? "https://openapi.alipay.com/gateway.do",
  alipayNotifyPath:
    process.env.ALIPAY_NOTIFY_PATH ?? "/api/payments/alipay/notify",
  alipayPersonalCollectionQrUrl:
    process.env.ALIPAY_PERSONAL_COLLECTION_QR_URL ?? "",
  personalPaymentContact: process.env.PERSONAL_PAYMENT_CONTACT ?? "",
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "",
  exportStorageDriver: process.env.EXPORT_STORAGE_DRIVER ?? "local",
  exportStorageBucket: process.env.EXPORT_STORAGE_BUCKET ?? "",
  exportStorageRegion: process.env.EXPORT_STORAGE_REGION ?? "",
  exportStorageEndpoint: process.env.EXPORT_STORAGE_ENDPOINT ?? "",
  exportStorageAccessKeyId: process.env.EXPORT_STORAGE_ACCESS_KEY_ID ?? "",
  exportStorageSecretAccessKey:
    process.env.EXPORT_STORAGE_SECRET_ACCESS_KEY ?? "",
};

export function getSystemReadiness(): ReadinessItem[] {
  const exportStorageDriver = env.exportStorageDriver.trim().toLowerCase();
  const exportStorageConfigured =
    exportStorageDriver === "local" ||
    (Boolean(env.exportStorageBucket) &&
      Boolean(env.exportStorageRegion || exportStorageDriver === "r2") &&
      Boolean(env.exportStorageAccessKeyId) &&
      Boolean(env.exportStorageSecretAccessKey) &&
      (exportStorageDriver !== "r2" || Boolean(env.exportStorageEndpoint)));

  const wechatConfigured =
    hasWechatMerchantConfig() || hasWechatPersonalQrConfig();
  const alipayConfigured =
    hasAlipayMerchantConfig() || hasAlipayPersonalQrConfig();

  return [
    {
      key: "database",
      label: "PostgreSQL",
      configured: Boolean(env.databaseUrl),
      description:
        "Required for Prisma, profiles, resume versions, exports, and audit logs.",
    },
    {
      key: "auth",
      label: "Auth secret",
      configured: Boolean(env.authSecret),
      description:
        "Required so NextAuth can sign and verify secure production sessions.",
    },
    {
      key: "ai",
      label: "OpenAI-compatible API",
      configured: Boolean(env.openAiApiKey && env.openAiBaseUrl),
      description:
        "Required to enable real AI generation, JD parsing, optimization, and diagnosis.",
    },
    {
      key: "sentry",
      label: "Sentry DSN",
      configured: Boolean(env.sentryDsn),
      description:
        "Required if you want server and browser errors reported to Sentry.",
    },
    {
      key: "sentrySourcemaps",
      label: "Sentry auth token",
      configured: Boolean(env.sentryAuthToken),
      description:
        "Optional but recommended in production so Next.js can upload sourcemaps during build.",
    },
    {
      key: "posthog",
      label: "PostHog token",
      configured: Boolean(env.posthogKey),
      description:
        "Required if you want register, generate, optimize, diagnose, and export events in analytics.",
    },
    {
      key: "commerceCallbackSecret",
      label: "Commerce callback secret",
      configured: Boolean(env.commerceCallbackSecret),
      description:
        "Recommended in production so payment callbacks can confirm orders and grant credits safely.",
    },
    {
      key: "wechatPay",
      label: "WeChat collection",
      configured: wechatConfigured,
      description: hasWechatMerchantConfig()
        ? "Using WeChat Pay merchant mode with callback verification."
        : "Configure a personal WeChat collection QR code for manual review mode.",
    },
    {
      key: "alipay",
      label: "Alipay collection",
      configured: alipayConfigured,
      description: hasAlipayMerchantConfig()
        ? "Using Alipay merchant mode with async notification verification."
        : "Configure a personal Alipay collection QR code for manual review mode.",
    },
    {
      key: "personalPaymentContact",
      label: "Manual payment contact",
      configured: Boolean(env.personalPaymentContact),
      description:
        "Optional contact shown to users when you use personal collection QR codes.",
    },
    {
      key: "pdfBrowser",
      label: "PDF browser path",
      configured: Boolean(env.puppeteerExecutablePath),
      description:
        "Required on most servers so Puppeteer can launch Chrome or Edge for PDF export.",
    },
    {
      key: "pdfStorage",
      label: "PDF object storage",
      configured: exportStorageConfigured,
      description:
        "Use local disk in development, or configure S3/R2 in production so PDF files survive container restarts.",
    },
  ];
}
