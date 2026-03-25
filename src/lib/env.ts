type ReadinessItem = {
  key: string;
  label: string;
  configured: boolean;
  description: string;
};

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: process.env.AUTH_SECRET ?? "",
  authTrustHost: process.env.AUTH_TRUST_HOST ?? "false",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
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
      label: "OpenAI API key",
      configured: Boolean(env.openAiApiKey),
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
