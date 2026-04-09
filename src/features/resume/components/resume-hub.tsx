"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SectionCard } from "@/components/section-card";
import {
  captureAnalyticsEvent,
  telemetryEvents,
  trackVersionCreated,
} from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import type { ResumeHubData, ResumeWorkspace } from "@/types/resume";

type ResumeHubProps = {
  initialData: ResumeHubData;
};

type HubNotice =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type ResumeWorkspaceResponse =
  | {
      success: true;
      data: ResumeWorkspace;
    }
  | {
      success: false;
      error: {
        message: string;
        details?: unknown;
      };
    };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ResumeHub({ initialData }: ResumeHubProps) {
  const router = useRouter();
  const [selectedStyle, setSelectedStyle] = useState(
    initialData.styles[0]?.id ?? "steady",
  );
  const [notice, setNotice] = useState<HubNotice>(null);
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => {
    return {
      resumeCount: initialData.resumes.length,
      versionCount: initialData.resumes.reduce(
        (sum, resume) => sum + resume.totalVersions,
        0,
      ),
      latestResume: initialData.resumes[0] ?? null,
    };
  }, [initialData.resumes]);

  function handleGenerate() {
    captureAnalyticsEvent(telemetryEvents.resumeGenerateClicked, {
      style: selectedStyle,
    });

    startTransition(() => {
      void (async () => {
        setNotice(null);

        try {
          const response = await fetch("/api/resumes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              style: selectedStyle,
            }),
          });
          const payload = (await response.json()) as ResumeWorkspaceResponse;

          if (!payload.success) {
            setNotice({
              type: "error",
              message: payload.error.message,
            });
            return;
          }

          setNotice({
            type: "success",
            message: "母版简历已生成，正在跳转到详情页。",
          });
          captureAnalyticsEvent(telemetryEvents.resumeGenerateSuccess, {
            resumeId: payload.data.resume.id,
            style: selectedStyle,
          });
          if (payload.data.currentVersion) {
            trackVersionCreated({
              source: "resume_generate",
              resumeId: payload.data.resume.id,
              versionId: payload.data.currentVersion.id,
              versionType: payload.data.currentVersion.versionType,
            });
          }
          router.push(`/resumes/${payload.data.resume.id}`);
          router.refresh();
        } catch {
          setNotice({
            type: "error",
            message: "母版简历生成失败，请检查网络后重试。",
          });
        }
      })();
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="当前生成状态"
          description="先告诉用户能不能生成、还缺什么、下一步在哪，而不是直接堆出风格卡片和版本列表。"
          tone="accent"
        >
          <div className="space-y-5">
            {!initialData.canGenerate ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                还不能生成母版简历，缺少：
                {initialData.missingProfileModules.join("、")}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-700">
                建档必填模块已补齐，可以开始生成母版简历。
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-[color:var(--border)] bg-white/76 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  简历数量
                </p>
                <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                  {totals.resumeCount}
                </p>
              </div>
              <div className="rounded-3xl border border-[color:var(--border)] bg-white/76 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  版本数量
                </p>
                <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
                  {totals.versionCount}
                </p>
              </div>
              <div className="rounded-3xl border border-[color:var(--border)] bg-white/76 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                  最近资产
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                  {totals.latestResume ? "已有简历可继续" : "等待首份母版"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!initialData.canGenerate || isPending}
                onClick={handleGenerate}
                className="inline-flex rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-white transition hover:shadow-[0_18px_34px_-18px_rgba(15,106,111,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "生成中..." : "生成母版简历"}
              </button>
              <Link
                href="/profile"
                className="inline-flex rounded-full border border-[color:var(--border-strong)] px-5 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                继续完善建档
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="为什么这里更像简历中台"
          description="把系统原则和用户收益讲清楚，用户会更理解为什么这里不是简单的一键生成器。"
        >
          <div className="space-y-3">
            {[
              "母版、岗位版、手动编辑版和诊断应用版都会沉淀在同一条版本链上。",
              "JD 优化与诊断不会覆盖母版，默认另存为新版本。",
              "Markdown 与 JSON 双存，方便继续编辑、比对和稳定导出。",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[color:var(--border)] bg-white/76 px-4 py-4 text-sm leading-6 text-[color:var(--muted-strong)]"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="选择母版风格"
        description="风格选择被放在单独区域，避免和状态提示、资产列表混在一起。用户会更容易理解自己现在做的是“生成新母版”，而不是操作已有版本。"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {initialData.styles.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelectedStyle(style.id)}
              className={cn(
                "rounded-3xl border px-5 py-5 text-left transition",
                selectedStyle === style.id
                  ? "border-[color:var(--accent)] bg-[linear-gradient(180deg,rgba(15,106,111,0.12),rgba(255,255,255,0.88))] shadow-[0_20px_42px_-32px_rgba(15,106,111,0.85)]"
                  : "border-[color:var(--border)] bg-white/76 hover:border-[color:var(--accent-soft-strong)]",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-[color:var(--foreground)]">{style.label}</p>
                {selectedStyle === style.id ? (
                  <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                    当前选择
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {style.description}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="已创建的简历资产"
          description="把最近简历资产放在更清晰的卡片里，用户能直接从这里继续编辑、定制和查看详情。"
        >
          {initialData.resumes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-5 py-8 text-sm leading-6 text-[color:var(--muted)]">
              还没有简历资产。补齐建档后可以直接生成第一份母版简历。
            </div>
          ) : (
            <div className="space-y-4">
              {initialData.resumes.map((resume) => (
                <div
                  key={resume.id}
                  className="rounded-3xl border border-[color:var(--border)] bg-white/76 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-[color:var(--foreground)]">
                        {resume.name}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {resume.totalVersions} 个版本 · 最近更新于{" "}
                        {formatDate(resume.updatedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                      {resume.status === "active" ? "进行中" : "草稿"}
                    </span>
                  </div>

                  {resume.currentVersion?.changeSummary?.generationSummary ? (
                    <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
                      {resume.currentVersion.changeSummary.generationSummary}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/resumes/${resume.id}`}
                      className="inline-flex rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
                    >
                      查看详情
                    </Link>
                    <Link
                      href={`/resumes/${resume.id}/edit`}
                      className="inline-flex rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    >
                      继续编辑
                    </Link>
                    <Link
                      href={`/resumes/${resume.id}/optimize`}
                      className="inline-flex rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                    >
                      JD 定制
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="生成与版本原则"
          description="保留里程碑逻辑，但改成更易读的操作说明，方便用户理解为什么这里的行为和普通编辑器不同。"
          tone="subtle"
        >
          <div className="space-y-5">
            <ol className="space-y-4">
              {initialData.lifecycleSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-sm font-semibold text-[color:var(--accent)]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-[color:var(--foreground)]">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white/76 px-4 py-4">
              <p className="font-medium text-[color:var(--foreground)]">当前版本原则</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {initialData.versionPrinciples.map((principle) => (
                  <p key={principle}>• {principle}</p>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
