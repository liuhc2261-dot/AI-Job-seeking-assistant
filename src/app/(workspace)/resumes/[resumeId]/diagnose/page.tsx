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
