"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { forgotPasswordSchema } from "@/lib/validations/auth";

type FormState = {
  message?: string;
  fieldErrors?: Partial<Record<"email", string[]>>;
  email: string;
  developmentResetLink?: string | null;
};

type ForgotPasswordSuccessPayload = {
  success: true;
  data: {
    requested: true;
    developmentResetLink?: string | null;
  };
};

type ForgotPasswordFailurePayload = {
  success: false;
  error?: {
    message?: string;
  };
};

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({
    email: "",
  });

  async function handleSubmit(formData: FormData) {
    const rawInput = {
      email: String(formData.get("email") ?? ""),
    };
    const parsedInput = forgotPasswordSchema.safeParse(rawInput);

    if (!parsedInput.success) {
      setState({
        email: rawInput.email,
        message: "请检查邮箱地址。",
        fieldErrors: parsedInput.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedInput.data),
      });
      const payload = (await response.json().catch(() => null)) as
        | ForgotPasswordSuccessPayload
        | ForgotPasswordFailurePayload
        | null;

      if (!response.ok || !payload?.success) {
        setState({
          email: parsedInput.data.email,
          message:
            payload && !payload.success
              ? payload.error?.message ?? "找回密码请求失败，请稍后重试。"
              : "找回密码请求失败，请稍后重试。",
        });
        return;
      }

      setState({
        email: parsedInput.data.email,
        message: "如果该邮箱已注册，我们已经生成了重置密码入口。",
        developmentResetLink: payload.data.developmentResetLink ?? null,
      });
    } catch {
      setState({
        email: parsedInput.data.email,
        message: "找回密码请求失败，请检查网络后重试。",
      });
    }
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
        <label htmlFor="email" className="text-sm font-medium">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={state.email}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.fieldErrors?.email?.[0] ? (
          <p className="text-sm text-rose-600">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      {state.message ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <p>{state.message}</p>
          {state.developmentResetLink ? (
            <p className="break-all">
              开发环境重置链接：
              <Link
                href={state.developmentResetLink}
                className="ml-1 font-medium text-[color:var(--accent)]"
              >
                {state.developmentResetLink}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "提交中..." : "发送重置入口"}
      </button>

      <p className="text-sm text-[color:var(--muted)]">
        想起密码了？
        <Link href="/login" className="ml-1 font-medium text-[color:var(--accent)]">
          返回登录
        </Link>
      </p>
    </form>
  );
}
