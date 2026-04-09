"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { UserTelemetrySync } from "@/components/telemetry/user-telemetry-sync";
import { workspaceFlow, workspaceNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppShellProps = {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    status?: string;
  };
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const displayName = user.name || user.email || "未命名用户";
  const primaryItems = workspaceNav.filter((item) => item.section === "workflow");
  const secondaryItems = workspaceNav.filter((item) => item.section === "system");
  const activeItem =
    workspaceNav.find((item) => {
      const prefixes = item.matchPrefixes ?? [item.href];

      return prefixes.some((prefix) =>
        prefix === "/"
          ? pathname === prefix
          : pathname === prefix || pathname.startsWith(`${prefix}/`),
      );
    }) ?? workspaceNav[0];

  function isItemActive(item: (typeof workspaceNav)[number]) {
    const prefixes = item.matchPrefixes ?? [item.href];

    return prefixes.some((prefix) =>
      prefix === "/"
        ? pathname === prefix
        : pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }

  function getLinkClassName(item: (typeof workspaceNav)[number]) {
    return cn(
      "block rounded-3xl border px-4 py-4 transition",
      isItemActive(item)
        ? "border-[color:var(--accent-soft-strong)] bg-[linear-gradient(180deg,rgba(15,106,111,0.14),rgba(255,255,255,0.86))] shadow-[0_20px_40px_-34px_rgba(15,106,111,0.7)]"
        : "border-transparent bg-transparent hover:border-[color:var(--border)] hover:bg-[rgba(255,255,255,0.52)]",
    );
  }

  return (
    <div className="min-h-screen">
      <UserTelemetrySync user={user} />
      <div className="mx-auto flex min-h-screen max-w-[1580px] gap-5 px-4 py-4 lg:px-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[300px] shrink-0 flex-col overflow-hidden rounded-[32px] border border-[color:var(--border-strong)] bg-[rgba(255,252,247,0.88)] p-5 shadow-[0_28px_90px_-56px_rgba(24,35,32,0.34)] backdrop-blur-xl lg:flex">
          <Link
            href="/dashboard"
            className="rounded-[28px] border border-[color:var(--border-strong)] bg-[linear-gradient(135deg,rgba(15,106,111,0.16),rgba(255,253,248,0.96))] p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
              Resume Workspace
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              AI 求职简历助手
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              围绕建档、母版简历、JD 定制、诊断和导出的一体化工作台。
            </p>
          </Link>

          <div className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.6)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
              主链路
            </p>
            <div className="mt-4 space-y-3">
              {workspaceFlow.map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-xs font-semibold text-[color:var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm text-[color:var(--muted-strong)]">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex-1 space-y-5 overflow-y-auto pr-1">
            <div>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
                核心页面
              </p>
              <nav className="space-y-2">
                {primaryItems.map((item) => (
                  <Link key={item.href} href={item.href} className={getLinkClassName(item)}>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {item.label}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {item.description}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
                系统
              </p>
              <nav className="space-y-2">
                {secondaryItems.map((item) => (
                  <Link key={item.href} href={item.href} className={getLinkClassName(item)}>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {item.label}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                        {item.description}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,241,230,0.9))] p-4">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {displayName}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">
              Status · {user.status ?? "ACTIVE"}
            </p>
            <div className="mt-4">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 py-1">
          <div className="mb-5 rounded-[30px] border border-[color:var(--border-strong)] bg-[rgba(255,252,247,0.86)] px-5 py-4 shadow-[0_24px_80px_-56px_rgba(24,35,32,0.34)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                  当前阶段
                </p>
                <p className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                  {activeItem?.label ?? "工作台"}
                </p>
                <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                  {activeItem?.description ??
                    "从这里继续推进建档、生成、定制、诊断与导出。"}
                </p>
              </div>

              <div className="hidden flex-wrap gap-2 lg:flex">
                {workspaceFlow.map((step, index) => (
                  <span
                    key={step}
                    className="rounded-full border border-[color:var(--border)] bg-white/70 px-3 py-2 text-xs font-medium text-[color:var(--muted)]"
                  >
                    {index + 1}. {step}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-[30px] border border-[color:var(--border-strong)] bg-[rgba(255,252,247,0.86)] px-4 py-4 shadow-[0_24px_80px_-56px_rgba(24,35,32,0.34)] backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {displayName}
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  {activeItem?.label ?? "工作台"}
                </p>
              </div>
              <LogoutButton />
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {workspaceNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition",
                    isItemActive(item)
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                      : "border-[color:var(--border)] bg-white/70 text-[color:var(--muted)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
