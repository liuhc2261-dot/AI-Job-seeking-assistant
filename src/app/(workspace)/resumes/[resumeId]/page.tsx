import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import { ResumeVersionTimeline } from "@/features/resume/components/resume-version-timeline";
import { resumeService } from "@/services/resume-service";

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { resumeId } = await params;
  const workspace = await resumeService.getResumeWorkspace(session.user.id, resumeId);
  const currentVersion = workspace.currentVersion;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Resume Detail"
        title={workspace.resume.name}
        description="简历详情页现在更强调“当前版本、下一步操作和版本来源关系”，避免用户点进来后只能看到一份预览，却不知道接下来应该编辑、定制、诊断还是导出。"
        actions={
          <>
            <Link
              href={`/resumes/${workspace.resume.id}/edit`}
              className="rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-hover))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(201,100,66,0.7)]"
            >
              编辑当前版本
            </Link>
            <Link
              href={`/resumes/${workspace.resume.id}/versions`}
              className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
            >
              管理版本链
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                当前版本
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {currentVersion?.versionName ?? "暂无"}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                版本数量
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {workspace.versions.length}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                当前状态
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {workspace.resume.status === "active" ? "进行中" : "草稿"}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                下一步
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {currentVersion ? "定制 / 诊断 / 导出" : "先生成版本"}
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <SectionCard
            title="当前版本说明"
            description="编辑、JD 优化和诊断应用都会新建版本，不会直接覆盖当前版本。"
            tone="accent"
          >
            {currentVersion ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[color:var(--border-strong)] bg-white/76 px-4 py-4">
                  <p className="font-semibold text-[color:var(--foreground)]">
                    {currentVersion.versionName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {currentVersion.changeSummary?.generationSummary ??
                      "当前版本还没有额外摘要说明。"}
                  </p>
                </div>

                {currentVersion.changeSummary?.warnings &&
                currentVersion.changeSummary.warnings.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                    {currentVersion.changeSummary.warnings.map((warning) => (
                      <p key={warning}>- {warning}</p>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/resumes/${workspace.resume.id}/optimize`}
                    className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
                  >
                    做 JD 定制
                  </Link>
                  <Link
                    href={`/resumes/${workspace.resume.id}/diagnose`}
                    className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
                  >
                    运行诊断
                  </Link>
                  <Link
                    href={`/resumes/${workspace.resume.id}/export`}
                    className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
                  >
                    导出投递版
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
            description="把母版、手动编辑、岗位优化和诊断应用放进同一条时间线，方便理解当前版本是怎么来的。"
          >
            <ResumeVersionTimeline
              versions={workspace.versions}
              currentVersionId={workspace.currentVersion?.id}
            />
          </SectionCard>
        </div>

        <div>
          {currentVersion ? (
            <ResumePreview content={currentVersion.contentJson} />
          ) : (
            <SectionCard title="暂无预览">
              <p className="text-sm text-[color:var(--muted)]">
                当前没有可用版本，请先回到简历中心重新生成母版简历。
              </p>
            </SectionCard>
          )}
        </div>
      </section>
    </div>
  );
}
