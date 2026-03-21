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
        description="浏览母版、岗位版和手动版本，查看来源链与结构化差异，并把任意版本创建副本或安全回滚成新的当前版本。"
      />

      <ResumeVersionsBrowser workspace={workspace} />
    </div>
  );
}
