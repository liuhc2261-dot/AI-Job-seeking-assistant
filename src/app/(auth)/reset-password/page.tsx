import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { SectionCard } from "@/components/section-card";
import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const session = await getAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const token = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0] ?? ""
    : resolvedSearchParams.token ?? "";

  return (
    <div className="pb-12">
      <SiteHeader authenticated={false} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="重置密码"
          title="设置新的登录密码，然后继续回到工作台"
          description="用户完成重置后，后续的资料、简历版本和导出记录都还在，所以页面只保留最必要的信息，降低操作负担。"
          tone="accent"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>本次修改只会更新登录密码，不会覆盖已有简历和版本链。</p>
            <p>如果重置入口失效，可以回到找回密码页重新申请一次。</p>
          </div>
        </SectionCard>

        <SectionCard
          title="确认新密码"
          description="输入一个新的密码用于后续登录。"
        >
          <ResetPasswordForm token={token} />
        </SectionCard>
      </main>
    </div>
  );
}
