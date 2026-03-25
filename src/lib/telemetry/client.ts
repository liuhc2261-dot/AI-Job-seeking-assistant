"use client";

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

type TelemetryValue = string | number | boolean | null | undefined;

type TelemetryProperties = Record<string, TelemetryValue>;

export const telemetryEvents = {
  registerSuccess: "register_success",
  onboardingCompleted: "onboarding_completed",
  resumeGenerateClicked: "resume_generate_clicked",
  resumeGenerateSuccess: "resume_generate_success",
  checkoutStarted: "checkout_started",
  checkoutPaid: "checkout_paid",
  jdParseSuccess: "jd_parse_success",
  resumeOptimizeSuccess: "resume_optimize_success",
  diagnoseSuccess: "diagnose_success",
  exportPdfSuccess: "export_pdf_success",
  versionCreated: "version_created",
} as const;

type TelemetryEventName =
  (typeof telemetryEvents)[keyof typeof telemetryEvents];

type AnalyticsUserInput = {
  id: string;
  email?: string | null;
  name?: string | null;
  status?: string | null;
};

function isPostHogEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_KEY,
  );
}

function isSentryEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function captureAnalyticsEvent(
  eventName: TelemetryEventName,
  properties?: TelemetryProperties,
) {
  if (!isPostHogEnabled()) {
    return;
  }

  posthog.capture(eventName, properties);
}

export function trackVersionCreated(properties: TelemetryProperties) {
  captureAnalyticsEvent(telemetryEvents.versionCreated, properties);
}

export function identifyAnalyticsUser(input: AnalyticsUserInput) {
  if (!input.id) {
    return;
  }

  if (isPostHogEnabled()) {
    posthog.identify(input.id, {
      email: input.email ?? undefined,
      name: input.name ?? undefined,
      status: input.status ?? undefined,
    });
  }

  if (isSentryEnabled()) {
    Sentry.setUser({
      id: input.id,
      email: input.email ?? undefined,
      username: input.name ?? undefined,
    });
  }
}

export function resetAnalyticsUser() {
  if (isPostHogEnabled()) {
    posthog.reset();
  }

  if (isSentryEnabled()) {
    Sentry.setUser(null);
  }
}
