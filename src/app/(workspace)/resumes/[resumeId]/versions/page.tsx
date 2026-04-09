import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ResumeVersionsBrowser } from "@/features/resume/components/resume-versions-browser";
import { resumeService } from "@/services/resume-service";

type ResumePageProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export default async function ResumeVersionsPage({ params }: ResumePageProps) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const workspace = await resumeService.getResumeWorkspace(session.user.id, resumeId);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Versions"
        title={`版本管理：${workspace.resume.name}`}
        description="浏览母版、岗位版和手动版本，查看来源链与结构化差异，并把任意版本创建副本或安全回滚为新的当前版本。"
        actions={
          <>
            <Link
              href={`/resumes/${resumeId}/edit`}
              className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              返回编辑
            </Link>
            <Link
              href={`/resumes/${resumeId}/export`}
              className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              去导出中心
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                总版本数
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.versions.length} 个
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                当前版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.currentVersion?.versionName ?? "暂无"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                当前类型
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.currentVersion?.versionType ?? "未设置"}
              </p>
            </div>
          </div>
        }
      />

      <ResumeVersionsBrowser workspace={workspace} />
    </div>
  );
}
