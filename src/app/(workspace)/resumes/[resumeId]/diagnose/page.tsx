import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ResumeDiagnoseWorkbench } from "@/features/diagnosis/components/resume-diagnose-workbench";
import { resumeDiagnosisService } from "@/services/resume-diagnosis-service";
import { resumeService } from "@/services/resume-service";

type ResumePageProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export default async function ResumeDiagnosePage({ params }: ResumePageProps) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const workspace = await resumeService.getResumeWorkspace(session.user.id, resumeId);

  if (!workspace.currentVersion) {
    redirect("/resumes");
  }

  const [latestReport, recommendedAnalysis] = await Promise.all([
    resumeDiagnosisService.getLatestReport(
      session.user.id,
      resumeId,
      workspace.currentVersion.id,
    ),
    resumeDiagnosisService.getRecommendedAnalysis(
      session.user.id,
      resumeId,
      workspace.currentVersion.id,
      workspace.currentVersion.sourceVersionId,
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Diagnose"
        title={`简历诊断：${workspace.resume.name}`}
        description="围绕当前版本先做规则检查，再接入 ResumeDiagnoserAgent 生成问题证据和修改建议。支持把可自动应用的建议另存为新版本，不覆盖原版。"
        actions={
          <>
            <Link
              href={`/resumes/${resumeId}/optimize`}
              className="inline-flex rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)]"
            >
              先做岗位定制
            </Link>
            <Link
              href={`/resumes/${resumeId}/versions`}
              className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              查看版本链
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
                最近诊断
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {latestReport ? "已生成" : "未运行"}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                JD 上下文
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {recommendedAnalysis ? "已关联" : "通用诊断"}
              </p>
            </div>
          </div>
        }
      />

      <ResumeDiagnoseWorkbench
        resumeId={resumeId}
        initialSourceVersion={workspace.currentVersion}
        initialWorkspace={workspace}
        initialReport={latestReport}
        initialAnalysis={recommendedAnalysis}
      />
    </div>
  );
}
