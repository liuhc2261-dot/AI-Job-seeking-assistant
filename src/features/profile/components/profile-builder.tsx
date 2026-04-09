"use client";

import Link from "next/link";
import { useState } from "react";

import { SectionCard } from "@/components/section-card";
import { AwardManager } from "@/features/profile/components/award-manager";
import { BasicProfileForm } from "@/features/profile/components/basic-profile-form";
import { EducationManager } from "@/features/profile/components/education-manager";
import { ExperienceManager } from "@/features/profile/components/experience-manager";
import { ProjectManager } from "@/features/profile/components/project-manager";
import { SkillManager } from "@/features/profile/components/skill-manager";
import { captureAnalyticsEvent, telemetryEvents } from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import type { ProfileModule, ProfileSnapshot } from "@/types/profile";

type ProfileBuilderProps = {
  initialSnapshot: ProfileSnapshot;
};

type BuilderNotice =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

function getModuleLabel(modules: ProfileModule[], slug: string) {
  return modules.find((module) => module.slug === slug)?.title ?? slug;
}

export function ProfileBuilder({ initialSnapshot }: ProfileBuilderProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [notice, setNotice] = useState<BuilderNotice>(null);

  const requiredModules = snapshot.modules.filter(
    (module) => module.required && module.enabled,
  );
  const optionalModules = snapshot.modules.filter(
    (module) => module.enabled && !module.required,
  );
  const progress =
    snapshot.completion.requiredTotal === 0
      ? 0
      : Math.round(
          (snapshot.completion.requiredCompleted /
            snapshot.completion.requiredTotal) *
            100,
        );

  function handleMutationSuccess(nextSnapshot: ProfileSnapshot, message: string) {
    const wasCompleted =
      snapshot.completion.requiredTotal > 0 &&
      snapshot.completion.requiredCompleted >= snapshot.completion.requiredTotal;
    const isCompleted =
      nextSnapshot.completion.requiredTotal > 0 &&
      nextSnapshot.completion.requiredCompleted >=
        nextSnapshot.completion.requiredTotal;

    if (!wasCompleted && isCompleted) {
      captureAnalyticsEvent(telemetryEvents.onboardingCompleted, {
        requiredModules: nextSnapshot.completion.requiredTotal,
        educations: nextSnapshot.counts.educations,
        projects: nextSnapshot.counts.projects,
        experiences: nextSnapshot.counts.experiences,
        awards: nextSnapshot.counts.awards,
        skills: nextSnapshot.counts.skills,
      });
    }

    setSnapshot(nextSnapshot);
    setNotice({
      type: "success",
      message,
    });
  }

  function handleMutationError(message: string) {
    setNotice({
      type: "error",
      message,
    });
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={cn(
            "rounded-3xl border px-5 py-4 text-sm leading-6",
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="建档进度"
          description="先把必填资料补齐，再进入母版生成会更稳。顶部摘要区会优先说明当前完成度和缺失项，而不是让用户直接淹没在表单里。"
          tone="accent"
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-[color:var(--foreground)]">
                  必填模块完成度
                </span>
                <span className="text-[color:var(--muted)]">
                  {snapshot.completion.requiredCompleted} /{" "}
                  {snapshot.completion.requiredTotal}
                </span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {requiredModules.map((module) => {
                const completed = snapshot.completion.completedSlugs.includes(
                  module.slug,
                );

                return (
                  <div
                    key={module.slug}
                    className="rounded-2xl border border-[color:var(--border)] bg-white/76 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{module.title}</p>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          completed
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {completed ? "已完成" : "待补齐"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {module.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="当前资料概览"
            description="用户最需要先理解的是：自己已经沉淀了多少资料，缺口在哪里。"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Education", value: snapshot.counts.educations, accent: true },
                { label: "Project", value: snapshot.counts.projects, accent: true },
                { label: "Skill", value: snapshot.counts.skills, accent: true },
                { label: "Experience", value: snapshot.counts.experiences, accent: false },
                { label: "Award", value: snapshot.counts.awards, accent: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-2xl border px-4 py-4",
                    item.accent
                      ? "border-[color:var(--accent-soft-strong)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--border)] bg-white/76",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-[0.18em]",
                      item.accent
                        ? "text-[color:var(--accent)]"
                        : "text-[color:var(--muted)]",
                    )}
                  >
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
            title="下一步建议"
            description="把缺失信息和推荐动作放在一起，用户更容易知道下一步应该去哪里。"
            tone="subtle"
          >
            <div className="space-y-4">
              {optionalModules.length > 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-4">
                  <p className="font-medium text-[color:var(--foreground)]">
                    当前开放的可选模块
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {optionalModules.map((module) => (
                      <span
                        key={module.slug}
                        className="rounded-full border border-[color:var(--border)] bg-white/76 px-3 py-1 text-xs font-medium text-[color:var(--muted)]"
                      >
                        {module.title}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {snapshot.completion.missingSlugs.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                  还缺少：
                  {snapshot.completion.missingSlugs
                    .map((slug) => getModuleLabel(snapshot.modules, slug))
                    .join("、")}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-700">
                  建档必填模块已经补齐，可以继续进入母版简历生成链路。
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/resumes"
                  className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)]"
                >
                  去简历中心
                </Link>
                <Link
                  href="/onboarding"
                  className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                >
                  返回引导页
                </Link>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>

      <BasicProfileForm
        value={snapshot.profile}
        onMutationSuccess={handleMutationSuccess}
        onMutationError={handleMutationError}
      />
      <EducationManager
        items={snapshot.educations}
        onMutationSuccess={handleMutationSuccess}
        onMutationError={handleMutationError}
      />
      <ProjectManager
        items={snapshot.projects}
        onMutationSuccess={handleMutationSuccess}
        onMutationError={handleMutationError}
      />
      <ExperienceManager
        items={snapshot.experiences}
        onMutationSuccess={handleMutationSuccess}
        onMutationError={handleMutationError}
      />
      <AwardManager
        items={snapshot.awards}
        onMutationSuccess={handleMutationSuccess}
        onMutationError={handleMutationError}
      />
      <SkillManager
        items={snapshot.skills}
        onMutationSuccess={handleMutationSuccess}
        onMutationError={handleMutationError}
      />
    </div>
  );
}
