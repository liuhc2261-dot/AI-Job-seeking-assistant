import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ResumeHub } from "@/features/resume/components/resume-hub";
import { resumeService } from "@/services/resume-service";

export default async function ResumesPage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const hub = await resumeService.getResumeHub(session.user.id);
  const totalVersions = hub.resumes.reduce((sum, item) => sum + item.totalVersions, 0);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Resumes"
        title="围绕一份母版简历，继续派生岗位版本、做诊断并准备导出"
        description="简历中心现在会先展示当前是否可生成、已沉淀的简历资产和推荐动作，再进入风格选择与版本列表，减少用户看到太多功能入口时的混乱感。"
        actions={
          <>
            <Link
              href="/profile"
              className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              回到资料建档
            </Link>
            {hub.resumes[0] ? (
              <Link
                href={`/resumes/${hub.resumes[0].id}`}
                className="rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-hover))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(201,100,66,0.7)]"
              >
                打开最近简历
              </Link>
            ) : null}
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                可生成状态
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {hub.canGenerate ? "可以生成母版" : "仍需补齐资料"}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                简历数量
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {hub.resumes.length}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                版本数量
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {totalVersions}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                缺失模块
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {hub.missingProfileModules.length}
              </p>
            </div>
          </div>
        }
      />
      <ResumeHub initialData={hub} />
    </div>
  );
}
