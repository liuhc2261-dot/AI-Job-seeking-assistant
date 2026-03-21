"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { loginSchema } from "@/lib/validations/auth";

type FormState = {
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  email: string;
};

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({
    email: "",
  });

  async function handleSubmit(formData: FormData) {
    const rawInput = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const parsedInput = loginSchema.safeParse(rawInput);

    if (!parsedInput.success) {
      setState({
        email: rawInput.email,
        message: "请检查登录信息。",
        fieldErrors: parsedInput.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await signIn("credentials", {
      email: parsedInput.data.email,
      password: parsedInput.data.password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (result?.error) {
      setState({
        email: parsedInput.data.email,
        message: "邮箱或密码不正确，请重新输入。",
      });
      return;
    }

    router.push(result?.url ?? "/dashboard");
    router.refresh();
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
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-[color:var(--accent)]">
            忘记密码？
          </Link>
        </p>
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
        {isPending ? "登录中..." : "登录并进入工作台"}
      </button>

      <p className="text-sm text-[color:var(--muted)]">
        还没有账号？
        <Link href="/register" className="ml-1 font-medium text-[color:var(--accent)]">
          去注册
        </Link>
      </p>
    </form>
  );
}
