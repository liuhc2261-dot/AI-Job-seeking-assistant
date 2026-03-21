import * as Sentry from "@sentry/nextjs";

const sentryDsn =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}
