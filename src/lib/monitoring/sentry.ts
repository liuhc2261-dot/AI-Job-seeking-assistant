import * as Sentry from "@sentry/nextjs";

type MonitoringContext = {
  area?: string;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

function isSentryEnabled() {
  return Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("unknown_error");
}

export function captureServerException(
  error: unknown,
  context?: MonitoringContext,
) {
  if (!isSentryEnabled()) {
    return;
  }

  const normalizedError = normalizeError(error);

  Sentry.withScope((scope) => {
    if (context?.area) {
      scope.setTag("area", context.area);
    }

    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        if (value !== undefined && value !== null) {
          scope.setTag(key, String(value));
        }
      }
    }

    if (context?.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        if (value !== undefined) {
          scope.setExtra(key, value);
        }
      }
    }

    Sentry.captureException(normalizedError);
  });
}
