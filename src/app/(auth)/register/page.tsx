import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";
import { RegisterForm } from "@/features/auth/components/register-form";

export default async function RegisterPage() {
  const session = await getAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="pb-12">
      <SiteHeader authenticated={false} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-8 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="注册"
          title="用一个账号串起你的简历资产"
          description="注册成功后会自动创建 `users` 与 `user_profiles` 的最小记录，为里程碑 2 的资料建档和简历资产沉淀打底。"
        >
          <div className="grid gap-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>当前只开放邮箱注册，符合 PRD 中“邮箱优先”的 MVP 约束。</p>
            <p>密码会使用哈希存储，不在日志和普通响应中暴露敏感信息。</p>
            <p>后续可在不破坏现有结构的前提下继续扩展邮箱验证与找回密码。</p>
          </div>
        </SectionCard>

        <SectionCard
          title="创建账号"
          description="注册后会自动跳转到工作台。"
        >
          <RegisterForm />
        </SectionCard>
      </main>
    </div>
  );
}
