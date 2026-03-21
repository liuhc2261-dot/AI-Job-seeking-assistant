import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { UserTelemetrySync } from "@/components/telemetry/user-telemetry-sync";
import { workspaceNav } from "@/lib/navigation";

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
  const displayName = user.name || user.email || "未命名用户";

  return (
    <div className="min-h-screen">
      <UserTelemetrySync user={user} />
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 flex-col rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_24px_80px_-48px_rgba(13,68,72,0.55)] backdrop-blur lg:flex">
          <Link
            href="/dashboard"
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
              Workspace
            </p>
            <h1 className="mt-2 text-lg font-semibold">AI 求职简历助手</h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              围绕建档、简历版本、JD 优化与导出的一条主链路工作台。
            </p>
          </Link>

          <nav className="mt-6 space-y-2">
            {workspaceNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
              状态 {user.status ?? "ACTIVE"}
            </p>
            <div className="mt-4">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="flex min-h-[calc(100vh-3rem)] flex-1 flex-col gap-6">
          <div className="flex items-center justify-between rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-[0_24px_80px_-48px_rgba(13,68,72,0.55)] backdrop-blur lg:hidden">
            <div>
              <p className="text-sm font-semibold">AI 求职简历助手</p>
              <p className="text-xs text-[color:var(--muted)]">{displayName}</p>
            </div>
            <LogoutButton />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
