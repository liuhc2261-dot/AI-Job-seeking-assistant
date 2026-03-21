"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    if (!sentryDsn) {
      return;
    }

    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
          <div className="w-full rounded-[32px] border border-rose-200 bg-white px-8 py-10 shadow-[0_24px_80px_-48px_rgba(13,68,72,0.55)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">
              App Error
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              页面遇到了一个意外错误
            </h1>
            <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
              {sentryDsn
                ? "错误已经写入监控。你可以先重试当前操作，若仍失败，再回到上一页继续处理。"
                : "当前未启用监控上报。你可以先重试当前操作，若仍失败，再回到上一页继续处理。"}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
              >
                重新加载
              </button>
              <a
                href="/dashboard"
                className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                返回工作台
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
