"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
          title="生成母版简历"
          description="里程碑 3 会把建档快照送入 ResumeGeneratorAgent，产出 master 版本并存入 resume_versions。"
        >
          <div className="space-y-4">
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

            <div className="grid gap-3">
              {initialData.styles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    selectedStyle === style.id
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{style.label}</p>
                    {selectedStyle === style.id ? (
                      <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                        当前选择
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {style.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!initialData.canGenerate || isPending}
                onClick={handleGenerate}
                className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "生成中..." : "生成母版简历"}
              </button>
              <Link
                href="/profile"
                className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                继续完善建档
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="生成链路说明"
          description="当前实现遵循 TechDesign 里的母版生成流程，并保留版本化能力。"
        >
          <ol className="space-y-4">
            {initialData.lifecycleSteps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-sm font-semibold text-[color:var(--accent)]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4">
            <p className="font-medium">当前版本原则</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
              {initialData.versionPrinciples.map((principle) => (
                <p key={principle}>• {principle}</p>
              ))}
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="已创建的简历资产"
        description="母版简历和后续手动保存的版本都会沉淀在这里。"
      >
        {initialData.resumes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-8 text-sm leading-6 text-[color:var(--muted)]">
            还没有简历资产。补齐建档后可以直接生成第一份母版简历。
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {initialData.resumes.map((resume) => (
              <div
                key={resume.id}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{resume.name}</p>
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
                    className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    继续编辑
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
