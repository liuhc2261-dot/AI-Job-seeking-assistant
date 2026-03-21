import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await getAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="pb-12">
      <SiteHeader authenticated={false} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-8 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="找回密码"
          title="先验证账号，再恢复登录入口"
          description="当前版本已经补齐 forgot-password 闭环：创建重置令牌、记录审计日志，并通过受控入口更新密码。"
        >
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <li>请求会统一返回通用提示，避免直接暴露邮箱是否已注册。</li>
            <li>重置令牌只保存哈希值，并且默认 1 小时过期。</li>
            <li>成功重置后会写入审计日志，方便后续排查账号安全问题。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="发送重置入口"
          description="输入注册邮箱，我们会为该账号生成新的密码重置入口。"
        >
          <ForgotPasswordForm />
        </SectionCard>
      </main>
    </div>
  );
}
