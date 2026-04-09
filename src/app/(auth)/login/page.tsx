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
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="登录"
          title="回到你的简历工作台，继续沿着主流程推进"
          description="登录页不再强调实现细节，而是让用户明确：登录后会直接回到工作台，继续建档、生成母版、做 JD 定制、诊断和导出。"
          tone="accent"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>适合已经建过档、生成过母版，或者正在维护多个岗位版本的用户。</p>
            <p>登录后会保留你自己的资料、版本链、导出记录和诊断结果。</p>
            <p>如果只是第一次体验，可以先注册一个新账号再开始建档。</p>
          </div>
        </SectionCard>

        <SectionCard
          title="登录账号"
          description="使用邮箱和密码进入当前账号。"
        >
          <LoginForm />
        </SectionCard>
      </main>
    </div>
  );
}
