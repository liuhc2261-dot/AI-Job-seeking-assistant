import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ResumeEditor } from "@/features/resume/components/resume-editor";
import { resumeService } from "@/services/resume-service";

type ResumeEditPageProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export default async function ResumeEditPage({ params }: ResumeEditPageProps) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const workspace = await resumeService.getResumeWorkspace(session.user.id, resumeId);

  if (!workspace.currentVersion) {
    redirect("/resumes");
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Edit"
        title={`编辑简历：${workspace.resume.name}`}
        description="在这里直接维护结构化简历内容，并实时查看排版效果。每次保存都会生成新的手动版本，方便继续迭代或回滚。"
        actions={
          <>
            <Link
              href={`/resumes/${resumeId}/versions`}
              className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              查看版本链
            </Link>
            <Link
              href={`/resumes/${resumeId}/export`}
              className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              导出投递版
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                当前版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.currentVersion.versionName}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                版本类型
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.currentVersion.versionType}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                历史版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.versions.length} 个
              </p>
            </div>
          </div>
        }
      />

      <ResumeEditor
        resumeId={workspace.resume.id}
        initialVersion={workspace.currentVersion}
      />
    </div>
  );
}
