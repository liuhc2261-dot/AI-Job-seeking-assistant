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

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Resumes"
        title="简历资产中心"
        description="这里负责里程碑 3 的主链路：基于建档快照生成母版简历，沉淀为可编辑、可回滚的版本资产。"
      />
      <ResumeHub initialData={hub} />
    </div>
  );
}
