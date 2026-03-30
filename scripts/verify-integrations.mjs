import crypto from "node:crypto";
import process from "node:process";

import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

function readEnv(name, fallback = "") {
  return process.env[name] ?? fallback;
}

function hasConfiguredValue(name) {
  const value = readEnv(name).trim();

  if (!value) {
    return false;
  }

  return !/^<replace-with-.*>$/.test(value) && !/^<.*>$/.test(value);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function previewText(value, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function resolveOpenAiChatCompletionsUrl(baseUrl) {
  const normalized = (baseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  if (normalized.endsWith("/v1")) {
    return `${normalized}/chat/completions`;
  }

  return `${normalized}/v1/chat/completions`;
}

async function verifyPdfBrowser() {
  const { access } = await import("node:fs/promises");
  const candidates = [
    readEnv("PUPPETEER_EXECUTABLE_PATH"),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);

      return {
        name: "pdfBrowser",
        status: "ok",
        detail: "found browser executable for PDF export",
        executablePath: candidate,
      };
    } catch {
      continue;
    }
  }

  return {
    name: "pdfBrowser",
    status: "missing",
    detail: "no usable Chrome/Edge executable found for PDF export",
  };
}

function verifyLocalReadiness() {
  const exportStorageDriver = readEnv("EXPORT_STORAGE_DRIVER", "local")
    .trim()
    .toLowerCase();
  const exportStorageConfigured =
    exportStorageDriver === "local" ||
    (readEnv("EXPORT_STORAGE_BUCKET") &&
      (readEnv("EXPORT_STORAGE_REGION") || exportStorageDriver === "r2") &&
      readEnv("EXPORT_STORAGE_ACCESS_KEY_ID") &&
      readEnv("EXPORT_STORAGE_SECRET_ACCESS_KEY") &&
      (exportStorageDriver !== "r2" || readEnv("EXPORT_STORAGE_ENDPOINT")));

  return [
    {
      name: "databaseUrl",
      status: readEnv("DATABASE_URL") ? "ok" : "missing",
      detail: readEnv("DATABASE_URL")
        ? "DATABASE_URL configured"
        : "DATABASE_URL is empty",
    },
    {
      name: "authSecret",
      status: readEnv("AUTH_SECRET") ? "ok" : "missing",
      detail: readEnv("AUTH_SECRET")
        ? "AUTH_SECRET configured"
        : "AUTH_SECRET is empty",
    },
    {
      name: "appUrl",
      status: readEnv("NEXT_PUBLIC_APP_URL") ? "ok" : "missing",
      detail: readEnv("NEXT_PUBLIC_APP_URL")
        ? "NEXT_PUBLIC_APP_URL configured"
        : "NEXT_PUBLIC_APP_URL is empty",
    },
    {
      name: "commerceCallbackSecret",
      status: hasConfiguredValue("COMMERCE_CALLBACK_SECRET") ? "ok" : "missing",
      detail: hasConfiguredValue("COMMERCE_CALLBACK_SECRET")
        ? "COMMERCE_CALLBACK_SECRET configured"
        : "COMMERCE_CALLBACK_SECRET is empty",
    },
    {
      name: "wechatPay",
      status:
        hasConfiguredValue("WECHAT_PAY_APP_ID") &&
        hasConfiguredValue("WECHAT_PAY_MCH_ID") &&
        hasConfiguredValue("WECHAT_PAY_SERIAL_NO") &&
        hasConfiguredValue("WECHAT_PAY_PRIVATE_KEY") &&
        hasConfiguredValue("WECHAT_PAY_API_V3_KEY") &&
        hasConfiguredValue("WECHAT_PAY_PLATFORM_PUBLIC_KEY")
          ? "ok"
          : "missing",
      detail:
        hasConfiguredValue("WECHAT_PAY_APP_ID") &&
        hasConfiguredValue("WECHAT_PAY_MCH_ID") &&
        hasConfiguredValue("WECHAT_PAY_SERIAL_NO") &&
        hasConfiguredValue("WECHAT_PAY_PRIVATE_KEY") &&
        hasConfiguredValue("WECHAT_PAY_API_V3_KEY") &&
        hasConfiguredValue("WECHAT_PAY_PLATFORM_PUBLIC_KEY")
          ? "WeChat Pay Native callback and signing config present"
          : "WeChat Pay env vars are incomplete",
    },
    {
      name: "alipay",
      status:
        hasConfiguredValue("ALIPAY_APP_ID") &&
        hasConfiguredValue("ALIPAY_PRIVATE_KEY") &&
        hasConfiguredValue("ALIPAY_PUBLIC_KEY") &&
        hasConfiguredValue("ALIPAY_GATEWAY_URL")
          ? "ok"
          : "missing",
      detail:
        hasConfiguredValue("ALIPAY_APP_ID") &&
        hasConfiguredValue("ALIPAY_PRIVATE_KEY") &&
        hasConfiguredValue("ALIPAY_PUBLIC_KEY") &&
        hasConfiguredValue("ALIPAY_GATEWAY_URL")
          ? "Alipay precreate and notify verification config present"
          : "Alipay env vars are incomplete",
    },
    {
      name: "exportStorage",
      status: exportStorageConfigured ? "ok" : "missing",
      detail:
        exportStorageDriver === "local"
          ? "using local PDF export storage"
          : "S3-compatible PDF export storage is incomplete",
    },
  ];
}

async function verifyOpenAi() {
  const apiKey = readEnv("OPENAI_API_KEY");
  const baseUrl = readEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
  const trialModel = readEnv("OPENAI_TRIAL_MODEL", readEnv("OPENAI_MODEL", "gpt-4.1-mini"));
  const paidModel = readEnv("OPENAI_PAID_MODEL", readEnv("OPENAI_MODEL", "gpt-4.1-mini"));
  const model = paidModel || trialModel;

  if (!apiKey) {
    return {
      name: "openai",
      status: "missing",
      detail: "OPENAI_API_KEY is empty",
    };
  }

  const response = await fetch(resolveOpenAiChatCompletionsUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 40,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content: 'Return a compact JSON object with keys "ok" and "source".',
        },
        {
          role: "user",
          content: "Respond with JSON only for this connectivity probe.",
        },
      ],
    }),
    signal: AbortSignal.timeout(35_000),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    return {
      name: "openai",
      status: "error",
      detail: `HTTP ${response.status}`,
      responsePreview: previewText(bodyText),
    };
  }

  let content = "";

  try {
    const payload = JSON.parse(bodyText);
    content = payload.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    content = bodyText.trim();
  }

  return {
    name: "openai",
    status: content ? "ok" : "error",
    detail: content
      ? `chat completion succeeded via ${baseUrl} with paid model ${model} (trial model: ${trialModel || "n/a"})`
      : "empty response content",
    responsePreview: previewText(content || bodyText),
  };
}

async function verifySentry() {
  const dsn = readEnv("SENTRY_DSN") || readEnv("NEXT_PUBLIC_SENTRY_DSN");

  if (!dsn) {
    return {
      name: "sentry",
      status: "missing",
      detail: "SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN are empty",
    };
  }

  const Sentry = await import("@sentry/nextjs");
  const probeId = crypto.randomUUID();

  Sentry.init({
    dsn,
    enabled: true,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV ?? "development",
  });

  const eventId = Sentry.captureMessage(`integration_probe:${probeId}`, "info");
  const flushed = await Sentry.flush(5_000);

  return {
    name: "sentry",
    status: flushed ? "ok" : "error",
    detail: flushed ? "captureMessage flushed successfully" : "flush timed out",
    eventId,
    probeId,
  };
}

async function verifyPostHog() {
  const token =
    readEnv("NEXT_PUBLIC_POSTHOG_TOKEN") || readEnv("NEXT_PUBLIC_POSTHOG_KEY");
  const host = trimTrailingSlash(
    readEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com"),
  );

  if (!token) {
    return {
      name: "posthog",
      status: "missing",
      detail: "NEXT_PUBLIC_POSTHOG_TOKEN and NEXT_PUBLIC_POSTHOG_KEY are empty",
    };
  }

  const distinctId = `integration-probe-${Date.now()}`;
  const event = "integration_preflight_probe";
  const response = await fetch(`${host}/capture/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: token,
      event,
      distinct_id: distinctId,
      properties: {
        source: "verify-integrations-script",
        project: "ai-job-seeking-assistant",
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const bodyText = await response.text();

  return {
    name: "posthog",
    status: response.ok ? "ok" : "error",
    detail: response.ok ? "capture endpoint accepted probe event" : `HTTP ${response.status}`,
    event,
    distinctId,
    responsePreview: previewText(bodyText),
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const checks = [...verifyLocalReadiness()];

  for (const verify of [verifyOpenAi, verifySentry, verifyPostHog, verifyPdfBrowser]) {
    try {
      checks.push(await verify());
    } catch (error) {
      checks.push({
        name: verify.name.replace(/^verify/, "").toLowerCase(),
        status: "error",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  const summary = {
    startedAt,
    appUrl: readEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    checks,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (checks.some((check) => check.status !== "ok")) {
    process.exitCode = 1;
  }
}

await main();
