"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  captureAnalyticsEvent,
  identifyAnalyticsUser,
  telemetryEvents,
} from "@/lib/telemetry/client";
import { registerSchema } from "@/lib/validations/auth";

type FormState = {
  message?: string;
  fieldErrors?: Partial<
    Record<"email" | "password" | "confirmPassword", string[]>
  >;
  email: string;
};

type RegisterSuccessPayload = {
  success: true;
  data: {
    id: string;
    email: string;
  };
};

type RegisterFailurePayload = {
  success: false;
  error?: {
    message?: string;
  };
};

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({
    email: "",
  });

  async function handleSubmit(formData: FormData) {
    const rawInput = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    const parsedInput = registerSchema.safeParse(rawInput);

    if (!parsedInput.success) {
      setState({
        email: rawInput.email,
        message: "请检查注册信息。",
        fieldErrors: parsedInput.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedInput.data),
      });
      const payload = (await response.json().catch(() => null)) as
        | RegisterSuccessPayload
        | RegisterFailurePayload
        | null;

      if (!response.ok || !payload?.success) {
        const errorMessage =
          payload && !payload.success
            ? payload.error?.message ?? "注册失败，请稍后重试。"
            : "注册失败，请稍后重试。";

        setState({
          email: parsedInput.data.email,
          message: errorMessage,
        });
        return;
      }

      identifyAnalyticsUser({
        id: payload.data.id,
        email: payload.data.email,
      });
      captureAnalyticsEvent(telemetryEvents.registerSuccess, {
        source: "register_form",
      });

      const result = await signIn("credentials", {
        email: parsedInput.data.email,
        password: parsedInput.data.password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setState({
          email: parsedInput.data.email,
          message: "注册成功后自动登录失败，请手动登录。",
        });
        return;
      }

      router.push(result?.url ?? "/dashboard");
      router.refresh();
    } catch {
      setState({
        email: parsedInput.data.email,
        message: "注册失败，请检查网络后重试。",
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
          placeholder="school@example.com"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.fieldErrors?.email?.[0] ? (
          <p className="text-sm text-rose-600">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="至少 8 位"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.fieldErrors?.password?.[0] ? (
          <p className="text-sm text-rose-600">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          确认密码
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="再次输入密码"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
        />
        {state.fieldErrors?.confirmPassword?.[0] ? (
          <p className="text-sm text-rose-600">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        ) : null}
      </div>

      {state.message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "创建中..." : "创建账号并开始建档"}
      </button>

      <p className="text-sm text-[color:var(--muted)]">
        已有账号？
        <Link href="/login" className="ml-1 font-medium text-[color:var(--accent)]">
          去登录
        </Link>
      </p>
    </form>
  );
}
