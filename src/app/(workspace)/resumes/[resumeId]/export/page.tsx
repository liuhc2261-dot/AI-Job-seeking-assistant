import Link from "next/link";
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
        description="当前导出中心已经打通 Markdown 和 PDF 两条链路。Markdown 保留源稿可编辑性，PDF 通过稳定 HTML 模板生成投递版，并将状态沉淀到导出记录中。"
        actions={
          <>
            <Link
              href={`/resumes/${resumeId}/versions`}
              className="inline-flex rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)]"
            >
              先挑选版本
            </Link>
            <Link
              href={`/resumes/${resumeId}/diagnose`}
              className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              返回诊断
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                默认导出版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.currentVersion.versionName}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                历史导出
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {exportHistory.length} 条
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                可导出版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.versions.length} 个
              </p>
            </div>
          </div>
        }
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
