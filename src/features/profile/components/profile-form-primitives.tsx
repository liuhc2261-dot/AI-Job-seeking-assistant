"use client";

import { cn } from "@/lib/utils";
import type { ProfileSnapshot } from "@/types/profile";

export const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60";

export async function readApiPayload(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "请求失败，请稍后重试。");
  }

  return payload.data as ProfileSnapshot;
}

export function formatMonthRange(startDate: string, endDate: string) {
  return `${startDate} - ${endDate}`;
}

export function FormField({
  label,
  required,
  children,
  hint,
}: Readonly<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-[color:var(--foreground)]">
        {label}
        {required ? <span className="ml-1 text-[color:var(--accent)]">*</span> : null}
      </span>
      {children}
      {hint ? (
        <p className="text-xs leading-5 text-[color:var(--muted)]">{hint}</p>
      ) : null}
    </label>
  );
}

export function TextInput(
  props: Readonly<React.InputHTMLAttributes<HTMLInputElement>>,
) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]",
        props.className,
      )}
    />
  );
}

export function TextArea(
  props: Readonly<React.TextareaHTMLAttributes<HTMLTextAreaElement>>,
) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]",
        props.className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
}: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-6">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {description}
      </p>
    </div>
  );
}
