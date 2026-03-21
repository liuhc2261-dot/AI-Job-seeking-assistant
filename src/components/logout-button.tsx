"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";

import { resetAnalyticsUser } from "@/lib/telemetry/client";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          resetAnalyticsUser();
          await signOut({ callbackUrl: "/" });
        })
      }
      className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
    >
      {isPending ? "退出中..." : "退出登录"}
    </button>
  );
}
