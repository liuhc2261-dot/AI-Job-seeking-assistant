import Link from "next/link";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { getSystemReadiness } from "@/lib/env";
import { profileService } from "@/services/profile-service";
import { resumeService } from "@/services/resume-service";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const session = await getAuthSession();
  const displayName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "同学";
  const readiness = getSystemReadiness();
  const [snapshot, resumes] = await Promise.all([
    profileService.getProfileSnapshot(session!.user!.id),
    resumeService.listResumes(session!.user!.id),
  ]);

  const profileReady =
    snapshot.completion.requiredTotal > 0 &&
    snapshot.completion.requiredCompleted >= snapshot.completion.requiredTotal;
  const totalVersions = resumes.reduce((sum, item) => sum + item.totalVersions, 0);
  const latestResume = resumes[0] ?? null;
  const nextAction = !profileReady
    ? {
        title: "先补齐建档必填模块",
        description: `当前已完成 ${snapshot.completion.requiredCompleted} / ${snapshot.completion.requiredTotal}，建议先完善基础信息、教育、项目和技能，再生成母版简历。`,
        href: "/profile",
        action: "继续建档",
      }
    : !latestResume
      ? {
          title: "生成第一份母版简历",
          description: "建档已经达到可生成条件，下一步就是在简历中心选择风格并生成你的第一份母版简历。",
          href: "/resumes",
          action: "去生成母版",
        }
      : {
          title: "继续围绕现有简历做岗位定制",
          description: `${latestResume.name} 最近更新于 ${formatDate(latestResume.updatedAt)}，可以继续做 JD 定制、诊断或直接导出。`,
          href: `/resumes/${latestResume.id}`,
          action: "打开当前简历",
        };

  const actionCards = [
    {
      title: "资料建档",
      description: "把真实经历沉淀进资料库，避免后续生成没有依据。",
      href: "/profile",
      action: profileReady ? "继续完善资料" : "优先处理",
      status: profileReady ? "已可生成" : "待补齐",
    },
    {
      title: "母版简历",
      description: "围绕建档快照生成第一份可编辑、可回滚的母版简历。",
      href: "/resumes",
      action: resumes.length > 0 ? "查看简历中心" : "去生成母版",
      status: resumes.length > 0 ? `${resumes.length} 份简历` : "尚未生成",
    },
    {
      title: "JD 定制与导出",
      description: "从现有版本继续做岗位定制、诊断、版本管理和导出。",
      href: latestResume ? `/resumes/${latestResume.id}` : "/resumes",
      action: latestResume ? "继续推进" : "先创建简历",
      status: latestResume ? `${totalVersions} 个版本` : "等待母版",
    },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Dashboard"
        title={`${displayName}，现在最重要的是把下一步做对`}
        description="工作台不再只是罗列功能，而是优先告诉你当前准备度、下一步建议和最近在推进的简历资产。这样用户进入系统后能更快完成“建档 → 生成 → 定制 → 诊断 → 导出”主链路。"
        actions={
          <>
            <Link
              href={nextAction.href}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(15,106,111,0.7)]"
            >
              {nextAction.action}
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              查看主流程
            </Link>
          </>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                建档完成度
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.completion.requiredCompleted}/{snapshot.completion.requiredTotal}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                简历数量
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {resumes.length}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                版本数量
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {totalVersions}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                当前建议
              </p>
              <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                {nextAction.action}
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <SectionCard
          title={nextAction.title}
          description={nextAction.description}
          tone="accent"
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href={nextAction.href}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(15,106,111,0.7)]"
            >
              {nextAction.action}
            </Link>
            {latestResume ? (
              <Link
                href={`/resumes/${latestResume.id}/export`}
                className="rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                继续导出
              </Link>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="系统就绪度"
          description="环境配置仍然保留，但从主视图退到辅助位置，避免用户第一次进入工作台时被技术状态打断。"
        >
          <div className="space-y-3">
            {readiness.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-[color:var(--border)] bg-white/72 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-[color:var(--foreground)]">{item.label}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.configured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.configured ? "已配置" : "待配置"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {actionCards.map((card) => (
          <SectionCard
            key={card.title}
            title={card.title}
            description={card.description}
            className="h-full"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--muted-strong)]">
                {card.status}
              </span>
              <Link
                href={card.href}
                className="text-sm font-semibold text-[color:var(--accent)] transition hover:text-[color:var(--accent-strong)]"
              >
                {card.action}
              </Link>
            </div>
          </SectionCard>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
        <SectionCard
          title="最近在推进的简历资产"
          description="把最近更新的简历放到前面，用户不用再先想自己该去哪个页面找当前版本。"
        >
          {resumes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-5 py-8 text-sm leading-6 text-[color:var(--muted)]">
              还没有简历资产。先补齐建档，再去简历中心生成第一份母版简历。
            </div>
          ) : (
            <div className="space-y-3">
              {resumes.slice(0, 3).map((resume) => (
                <div
                  key={resume.id}
                  className="rounded-3xl border border-[color:var(--border)] bg-white/76 px-5 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-[color:var(--foreground)]">
                        {resume.name}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {resume.totalVersions} 个版本 · 最近更新于 {formatDate(resume.updatedAt)}
                      </p>
                    </div>
                    <Link
                      href={`/resumes/${resume.id}`}
                      className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    >
                      继续推进
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="当前资料储备"
          description="把建档规模展示成清晰摘要，用户更容易判断自己为什么还不能生成，或者为什么生成质量不稳定。"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "教育经历", value: snapshot.counts.educations },
              { label: "项目经历", value: snapshot.counts.projects },
              { label: "实习经历", value: snapshot.counts.experiences },
              { label: "技能条目", value: snapshot.counts.skills },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
