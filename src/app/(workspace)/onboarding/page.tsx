import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/auth";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { profileService } from "@/services/profile-service";

export default async function OnboardingPage() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const snapshot = await profileService.getProfileSnapshot(session.user.id);
  const modules = snapshot.modules.filter((item) => item.enabled);
  const optionalModules = snapshot.modules.filter(
    (item) => item.enabled && !item.required,
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Onboarding"
        title="用最少步骤把资料沉淀成可用资产"
        description={`当前已完成 ${snapshot.completion.requiredCompleted} / ${snapshot.completion.requiredTotal} 个必填模块。先把真实资料补齐，再进入后续母版简历生成会更稳。`}
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="当前必填状态"
          description="里程碑 2 已经把基础建档接到数据库，下面会直接反映你当前账号的真实完成度。"
        >
          <div className="space-y-3">
            {modules.map((item) => {
              const completed = snapshot.completion.completedSlugs.includes(item.slug);

              return (
                <div
                  key={item.slug}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{item.title}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        completed
                          ? "bg-emerald-100 text-emerald-700"
                          : item.required
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {completed ? "已完成" : item.required ? "待补齐" : "可补充"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="建议准备的资料"
          description="先把原始事实准备完整，再交给 AI 做表达优化，而不是反过来让模型帮你补事实。"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>教育经历至少准备 1 条完整时间线。</p>
            <p>项目经历优先准备职责、成果、技术栈和你自己的实际贡献。</p>
            <p>如果你有实习或校内岗位经历，建议单独建档，后续生成会更自然。</p>
            <p>奖项、证书和竞赛经历可以先存档，后续由不同版本决定是否展示。</p>
            <p>技能尽量用标准标签表达，方便后续做 JD 关键词对齐。</p>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="已沉淀的资料量"
          description="这些数字来自当前账号的真实建档数据。"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Education
              </p>
              <p className="mt-3 text-2xl font-semibold">{snapshot.counts.educations}</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Project
              </p>
              <p className="mt-3 text-2xl font-semibold">{snapshot.counts.projects}</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Experience
              </p>
              <p className="mt-3 text-2xl font-semibold">{snapshot.counts.experiences}</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Award
              </p>
              <p className="mt-3 text-2xl font-semibold">{snapshot.counts.awards}</p>
            </div>
            <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Skill
              </p>
              <p className="mt-3 text-2xl font-semibold">{snapshot.counts.skills}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="当前可选补充模块"
          description="这些模块不会阻塞母版生成，但补进去后会让后续 AI 输出更完整。"
        >
          <div className="flex flex-wrap gap-2">
            {optionalModules.map((item) => (
              <span
                key={item.slug}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-1 text-sm text-[color:var(--muted)]"
              >
                {item.title}
              </span>
            ))}
          </div>
        </SectionCard>
      </section>

      <Link
        href="/profile"
        className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
      >
        继续完善资料建档
      </Link>
    </div>
  );
}
