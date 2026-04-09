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
        title="先看清主流程和资料准备项，再开始填写会更顺"
        description={`当前必填模块已完成 ${snapshot.completion.requiredCompleted} / ${snapshot.completion.requiredTotal}。这页会先告诉用户需要准备什么、哪些是必填、哪些是可选，降低一上来就面对大量表单的压迫感。`}
        actions={
          <Link
            href="/profile"
            className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(15,106,111,0.7)]"
          >
            继续完善资料建档
          </Link>
        }
        meta={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                必填模块
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.completion.requiredTotal}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                已完成
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {snapshot.completion.requiredCompleted}
              </p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                可选模块
              </p>
              <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                {optionalModules.length}
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="当前必填状态"
          description="先把建档拆成清晰模块，再告诉用户是否已经满足生成母版的最低条件。"
        >
          <div className="space-y-3">
            {modules.map((item) => {
              const completed = snapshot.completion.completedSlugs.includes(item.slug);

              return (
                <div
                  key={item.slug}
                  className="rounded-2xl border border-[color:var(--border)] bg-white/76 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
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
          title="开始前建议先准备这些信息"
          description="引导用户先准备事实，再交给 AI 做表达优化，比直接让模型“猜”经历更可靠。"
          tone="subtle"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>教育经历至少准备 1 条完整时间线，包含学校、专业、学历和起止时间。</p>
            <p>项目经历尽量写清职责、成果、技术栈和你的真实贡献，后续生成质量会更稳。</p>
            <p>如果有实习、社团或校内岗位经历，建议单独建档，后面做岗位版时更容易被调用。</p>
            <p>技能请优先使用标准标签表达，便于后面做 JD 关键词对齐。</p>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="已沉淀的资料量"
          description="把资料规模可视化后，用户更容易知道自己的简历生成基础是不是足够。"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Education", value: snapshot.counts.educations },
              { label: "Project", value: snapshot.counts.projects },
              { label: "Experience", value: snapshot.counts.experiences },
              { label: "Award", value: snapshot.counts.awards },
              { label: "Skill", value: snapshot.counts.skills },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[color:var(--border)] bg-white/76 px-4 py-4"
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

        <SectionCard
          title="当前开放的可选模块"
          description="这些模块不会阻止母版生成，但补进去以后会让后续岗位优化和诊断更完整。"
        >
          <div className="flex flex-wrap gap-2">
            {optionalModules.map((item) => (
              <span
                key={item.slug}
                className="rounded-full border border-[color:var(--border)] bg-white/76 px-3 py-2 text-sm font-medium text-[color:var(--muted)]"
              >
                {item.title}
              </span>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
