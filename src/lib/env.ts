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
  sentryDsn:
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  sentryAuthToken: process.env.SENTRY_AUTH_TOKEN ?? "",
  posthogKey:
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN ??
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    "",
  posthogHost:
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "",
};

export function getSystemReadiness(): ReadinessItem[] {
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
      key: "pdfBrowser",
      label: "PDF browser path",
      configured: Boolean(env.puppeteerExecutablePath),
      description:
        "Required on most servers so Puppeteer can launch Chrome or Edge for PDF export.",
    },
  ];
}
