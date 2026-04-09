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
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="找回密码"
          title="先恢复账号访问，再回到当前求职进度"
          description="忘记密码页现在会用更直接的语言告诉用户：这里只负责恢复登录，不会影响已经沉淀的资料、版本或导出记录。"
          tone="accent"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>输入注册邮箱后，系统会为对应账号生成新的密码重置入口。</p>
            <p>重置密码只会影响登录凭证，不会改动你的简历内容和版本历史。</p>
            <p>如果已经想起密码，可以直接返回登录页继续使用。</p>
          </div>
        </SectionCard>

        <SectionCard
          title="发送重置入口"
          description="输入注册邮箱即可继续。"
        >
          <ForgotPasswordForm />
        </SectionCard>
      </main>
    </div>
  );
}
