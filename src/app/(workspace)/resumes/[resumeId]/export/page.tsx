import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { ResumeExportCenter } from "@/features/export/components/resume-export-center";
import { exportService } from "@/services/export-service";
import { resumeService } from "@/services/resume-service";

type ResumePageProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export default async function ResumeExportPage({ params }: ResumePageProps) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const [workspace, exportHistory] = await Promise.all([
    resumeService.getResumeWorkspace(session.user.id, resumeId),
    exportService.listResumeExports(session.user.id, resumeId),
  ]);

  if (!workspace.currentVersion) {
    redirect(`/resumes/${resumeId}`);
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Export"
        title={`导出与交付：${workspace.resume.name}`}
        description="当前导出中心已经打通 Markdown 与 PDF 两条链路：Markdown 保留源稿可编辑性，PDF 通过稳定 HTML 模板生成可投递版本，并将状态沉淀到 exports 表。"
      />

      <ResumeExportCenter
        resumeId={resumeId}
        resumeName={workspace.resume.name}
        initialVersionId={workspace.currentVersion.id}
        versions={workspace.versions}
        initialExports={exportHistory}
        templates={exportService.listTemplates()}
        formats={exportService.listFormatOptions()}
        markdownTemplateName={exportService.getMarkdownTemplateName()}
        pdfTemplateName={exportService.getPdfTemplateName()}
      />
    </div>
  );
}
