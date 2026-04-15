import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ProfileBuilder } from "@/features/profile/components/profile-builder";
import { profileService } from "@/services/profile-service";

export default async function ProfilePage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const snapshot = await profileService.getProfileSnapshot(session.user.id);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Profile"
        title="把真实经历沉淀成后续生成会一直复用的母版资料"
        description="资料建档页现在会优先告诉用户完成度、缺失项和当前资料规模，再进入具体表单。这样用户更容易理解为什么还不能生成，或者为什么某些结果不够稳。"
        actions={
          <>
            <Link
              href="/resumes"
              className="rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-hover))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(201,100,66,0.7)]"
            >
              去简历中心
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              查看建档说明
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                必填完成
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.completion.requiredCompleted}/{snapshot.completion.requiredTotal}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                教育经历
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.counts.educations}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                项目经历
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.counts.projects}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                技能条目
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.counts.skills}
              </p>
            </div>
          </div>
        }
      />
      <ProfileBuilder initialSnapshot={snapshot} />
    </div>
  );
}
