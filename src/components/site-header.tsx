import Link from "next/link";

import { publicNav } from "@/lib/navigation";

type SiteHeaderProps = {
  authenticated: boolean;
};

export function SiteHeader({ authenticated }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-full border border-[color:var(--border-strong)] bg-[rgba(255,252,247,0.88)] px-4 py-3 shadow-[0_20px_60px_-42px_rgba(20,20,19,0.12)] backdrop-blur-xl sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand),var(--brand-hover))] text-sm font-semibold text-white shadow-[0_4px_20px_-6px_rgba(201,100,66,0.5)]">
            AI
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
              AI 求职简历助手
            </p>
            <p className="truncate text-xs text-[color:var(--muted)]">
              建档 → 生成 → 定制 → 诊断 → 导出
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {authenticated ? (
            <Link
              href="/dashboard"
              className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              打开工作台
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-hover))] px-4 py-2 text-sm font-medium text-white transition hover:shadow-[0_16px_34px_-18px_rgba(201,100,66,0.55)]"
              >
                立即开始
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
