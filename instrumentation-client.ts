import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

const sentryDsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
const posthogToken =
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN ??
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  "";
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    person_profiles: "identified_only",
    capture_pageview: true,
    autocapture: true,
    defaults: "2025-05-24",
    loaded(instance) {
      if (process.env.NODE_ENV === "development") {
        instance.debug();
      }
    },
  });
}

export function onRouterTransitionStart(...args: Parameters<typeof Sentry.captureRouterTransitionStart>) {
  if (!sentryDsn) {
    return;
  }

  Sentry.captureRouterTransitionStart(...args);
}
