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
        description="围绕当前简历版本完成 JD 解析、关键词对齐和岗位版创建。所有优化结果都会另存为新的 job_targeted 版本，不覆盖源版本。"
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
