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
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 pt-8 lg:grid-cols-[1fr_440px] lg:px-8">
        <SectionCard
          eyebrow="重置密码"
          title="设置新的登录密码"
          description="重置成功后，新的密码会立即写回账号系统，并保留完整的审计记录。"
        >
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <li>令牌失效或被使用后，需要重新回到找回密码页生成新的入口。</li>
            <li>本次修改只更新密码，不会改动你的简历、建档或版本数据。</li>
          </ul>
        </SectionCard>

        <SectionCard
          title="确认新密码"
          description="请输入一个新的密码，用于后续正常登录。"
        >
          <ResetPasswordForm token={token} />
        </SectionCard>
      </main>
    </div>
  );
}
