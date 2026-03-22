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
          description="登录后即可进入工作台，继续完成建档、母版生成、JD 优化、诊断和导出。"
        >
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <li>登录后默认进入 `/dashboard`，当前工作台已经接通建档、简历中心和设置入口。</li>
            <li>服务端会话通过 httpOnly Cookie 维护，符合当前项目的基础鉴权方案。</li>
            <li>用户数据查询始终带 `user_id` 约束，不允许跨用户读取私有简历资产。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="登录账号"
          description="使用邮箱和密码进入当前已可运行的工作台。"
        >
          <LoginForm />
        </SectionCard>
      </main>
    </div>
  );
}
