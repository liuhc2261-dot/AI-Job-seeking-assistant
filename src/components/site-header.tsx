import Link from "next/link";

import { publicNav } from "@/lib/navigation";

type SiteHeaderProps = {
  authenticated: boolean;
};

export function SiteHeader({ authenticated }: SiteHeaderProps) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-6 lg:px-8">
      <Link href="/" className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-sm font-semibold text-white shadow-lg shadow-[rgba(21,94,99,0.24)]">
          AI
        </div>
        <div>
          <p className="text-sm font-semibold">AI 求职简历助手</p>
          <p className="text-xs text-[color:var(--muted)]">
            建档 → 生成 → 定制 → 诊断 → 导出
          </p>
        </div>
      </Link>

      <nav className="hidden items-center gap-5 text-sm text-[color:var(--muted)] md:flex">
        {publicNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="transition hover:text-[color:var(--foreground)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {authenticated ? (
          <Link
            href="/dashboard"
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
          >
            进入工作台
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              立即开始
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

