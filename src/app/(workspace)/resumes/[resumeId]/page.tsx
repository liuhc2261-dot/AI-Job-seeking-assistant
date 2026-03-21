import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import { ResumeVersionTimeline } from "@/features/resume/components/resume-version-timeline";
import { resumeService } from "@/services/resume-service";

type ResumePageProps = {
  params: Promise<{
    resumeId: string;
  }>;
};

export default async function ResumeDetailPage({ params }: ResumePageProps) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const workspace = await resumeService.getResumeWorkspace(session.user.id, resumeId);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Resume Detail"
        title={workspace.resume.name}
        description="这里展示当前版本预览、版本说明和沉淀情况。后续 JD 优化、简历诊断和导出都继续围绕这个版本化资产容器展开。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-6">
          <SectionCard
            title="当前版本"
            description="编辑、岗位优化和诊断应用都只会新增版本，不会直接覆盖当前内容。"
          >
            {workspace.currentVersion ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
                  <p className="text-sm font-semibold">
                    {workspace.currentVersion.versionName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {workspace.currentVersion.changeSummary?.generationSummary ??
                      "当前版本还没有补充说明。"}
                  </p>
                </div>

                {workspace.currentVersion.changeSummary?.warnings &&
                workspace.currentVersion.changeSummary.warnings.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                    {workspace.currentVersion.changeSummary.warnings.map((warning) => (
                      <p key={warning}>- {warning}</p>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/resumes/${workspace.resume.id}/optimize`}
                    className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    JD 定制优化
                  </Link>
                  <Link
                    href={`/resumes/${workspace.resume.id}/diagnose`}
                    className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    简历诊断
                  </Link>
                  <Link
                    href={`/resumes/${workspace.resume.id}/edit`}
                    className="inline-flex rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
                  >
                    打开编辑页
                  </Link>
                  <Link
                    href={`/resumes/${workspace.resume.id}/versions`}
                    className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    查看版本差异
                  </Link>
                  <Link
                    href={`/resumes/${workspace.resume.id}/export`}
                    className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    导出与交付
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">
                当前还没有可展示的版本。
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="版本时间线"
            description="母版生成、手动保存、岗位优化和诊断应用都会沿着同一条版本链沉淀。"
          >
            <ResumeVersionTimeline
              versions={workspace.versions}
              currentVersionId={workspace.currentVersion?.id}
            />
          </SectionCard>
        </div>

        <div>
          {workspace.currentVersion ? (
            <ResumePreview content={workspace.currentVersion.contentJson} />
          ) : (
            <SectionCard title="暂无预览">
              <p className="text-sm text-[color:var(--muted)]">
                当前没有可用版本，请返回简历中心重新生成母版简历。
              </p>
            </SectionCard>
          )}
        </div>
      </section>
    </div>
  );
}
