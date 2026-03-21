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
        title={`编辑：${workspace.resume.name}`}
        description="左侧直接编辑结构化内容，右侧实时预览。每次保存都会新增 manual 版本，不会覆盖现有母版。"
      />

      <ResumeEditor
        resumeId={workspace.resume.id}
        initialVersion={workspace.currentVersion}
      />
    </div>
  );
}
