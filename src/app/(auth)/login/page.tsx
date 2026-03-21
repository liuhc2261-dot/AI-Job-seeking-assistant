import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage() {
  const session = await getAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="pb-12">
      <SiteHeader authenticated={false} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-8 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="登录"
          title="先拿到会话，再进入求职主链路"
          description="当前初始化阶段已经接好 Credentials 认证基础能力：注册、登录、会话保持与受保护工作台入口。"
        >
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <li>登录后默认进入 `/dashboard`，后续建档与简历路由将在工作台内逐步接入。</li>
            <li>服务端会话通过 httpOnly Cookie 维护，符合 TechDesign 的基础鉴权方向。</li>
            <li>用户数据后续会统一走 `user_id` 隔离查询，不允许跨用户读取私有简历资产。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="登录账号"
          description="使用邮箱和密码进入当前初始化好的工作台。"
        >
          <LoginForm />
        </SectionCard>
      </main>
    </div>
  );
}
