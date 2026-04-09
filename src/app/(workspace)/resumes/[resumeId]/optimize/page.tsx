import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ResumeOptimizeWorkbench } from "@/features/resume/components/resume-optimize-workbench";
import { jdAnalysisService } from "@/services/jd-analysis-service";
import { resumeService } from "@/services/resume-service";

type ResumePageProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export default async function ResumeOptimizePage({ params }: ResumePageProps) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const workspace = await resumeService.getResumeWorkspace(session.user.id, resumeId);

  if (!workspace.currentVersion) {
    redirect("/resumes");
  }

  const optimizeSourceVersion = workspace.currentVersion.sourceVersionId
    ? workspace.versions.find(
        (version) => version.id === workspace.currentVersion?.sourceVersionId,
      ) ?? workspace.currentVersion
    : workspace.currentVersion;

  const latestAnalysis = await jdAnalysisService.getLatestAnalysis(
    session.user.id,
    resumeId,
    optimizeSourceVersion.id,
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Optimize"
        title={`JD 定制优化：${workspace.resume.name}`}
        description="围绕当前简历版本完成 JD 解析、关键词对齐和岗位版本创建。所有优化结果都会另存为新的 job_targeted 版本，不覆盖源版本。"
        actions={
          <>
            <Link
              href={`/resumes/${resumeId}/edit`}
              className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
            >
              先完善源版本
            </Link>
            <Link
              href={`/resumes/${resumeId}/versions`}
              className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              查看版本链
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                优化源版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {optimizeSourceVersion.versionName}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                最近 JD 解析
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {latestAnalysis ? "已存在" : "未创建"}
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

      <ResumeOptimizeWorkbench
        resumeId={resumeId}
        initialSourceVersion={optimizeSourceVersion}
        initialWorkspace={workspace}
        initialAnalysis={latestAnalysis}
      />
    </div>
  );
}
