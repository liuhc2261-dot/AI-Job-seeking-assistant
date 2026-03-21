"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { resetPasswordSchema } from "@/lib/validations/auth";

type ResetPasswordFormProps = {
  token: string;
};

type FormState = {
  message?: string;
  success?: boolean;
  fieldErrors?: Partial<Record<"token" | "password" | "confirmPassword", string[]>>;
};

type ResetPasswordSuccessPayload = {
  success: true;
  data: {
    reset: true;
  };
};

type ResetPasswordFailurePayload = {
  success: false;
  error?: {
    message?: string;
  };
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({});

  async function handleSubmit(formData: FormData) {
    const rawInput = {
      token,
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };
    const parsedInput = resetPasswordSchema.safeParse(rawInput);

    if (!parsedInput.success) {
      setState({
        message: "请检查新的密码设置。",
        fieldErrors: parsedInput.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedInput.data),
      });
      const payload = (await response.json().catch(() => null)) as
        | ResetPasswordSuccessPayload
        | ResetPasswordFailurePayload
        | null;

      if (!response.ok || !payload?.success) {
        setState({
          message:
            payload && !payload.success
              ? payload.error?.message ?? "重置密码失败，请稍后重试。"
              : "重置密码失败，请稍后重试。",
        });
        return;
      }

      setState({
        success: true,
        message: "密码已重置成功，请使用新密码重新登录。",
      });
    } catch {
      setState({
        message: "重置密码失败，请检查网络后重试。",
      });
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          当前缺少有效的重置令牌，请先返回找回密码页面重新获取入口。
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
        >
          去找回密码
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          await handleSubmit(formData);
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          新密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="至少 8 位"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.fieldErrors?.password?.[0] ? (
          <p className="text-sm text-rose-600">{state.fieldErrors.password[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          确认新密码
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="再次输入新密码"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.fieldErrors?.confirmPassword?.[0] ? (
          <p className="text-sm text-rose-600">{state.fieldErrors.confirmPassword[0]}</p>
        ) : null}
      </div>

      {state.message ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || state.success}
        className="w-full rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "重置中..." : "确认重置密码"}
      </button>

      <p className="text-sm text-[color:var(--muted)]">
        <Link href="/login" className="font-medium text-[color:var(--accent)]">
          返回登录
        </Link>
      </p>
    </form>
  );
}
