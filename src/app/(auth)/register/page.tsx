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
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="注册"
          title="先创建一个账号，再把简历资料和版本长期沉淀下来"
          description="注册后的体验重点应该是尽快开始建档，而不是先接受一堆技术说明。这个页面会把重点放在“注册后你能做什么”上。"
          tone="accent"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>注册成功后会自动进入工作台，建议先完成资料建档，再生成第一份母版简历。</p>
            <p>后续的 JD 定制、诊断、版本管理和导出都会继续围绕这个账号里的简历资产展开。</p>
            <p>如果你已经有账号，可以直接登录继续当前进度。</p>
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
