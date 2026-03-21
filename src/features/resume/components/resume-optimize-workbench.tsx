"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SectionCard } from "@/components/section-card";
import { ResumeDiffView } from "@/features/resume/components/resume-diff-view";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import {
  captureAnalyticsEvent,
  telemetryEvents,
  trackVersionCreated,
} from "@/lib/telemetry/client";
import { buildResumeDiffSections } from "@/lib/resume-diff";
import { cn } from "@/lib/utils";
import type { JDAnalysisRecord } from "@/types/jd";
import type { ResumeVersionRecord, ResumeWorkspace } from "@/types/resume";

type ResumeOptimizeWorkbenchProps = {
  resumeId: string;
  initialSourceVersion: ResumeVersionRecord;
  initialWorkspace: ResumeWorkspace;
  initialAnalysis: JDAnalysisRecord | null;
};

type WorkbenchNotice =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
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

export function ResumeOptimizeWorkbench({
  resumeId,
  initialSourceVersion,
  initialWorkspace,
  initialAnalysis,
}: ResumeOptimizeWorkbenchProps) {
  const router = useRouter();
  const [jdText, setJdText] = useState(initialAnalysis?.rawJdText ?? "");
  const [analysis, setAnalysis] = useState<JDAnalysisRecord | null>(initialAnalysis);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [sourceVersion] = useState(initialSourceVersion);
  const [generatedVersion, setGeneratedVersion] = useState<ResumeVersionRecord | null>(
    initialWorkspace.currentVersion?.sourceVersionId === initialSourceVersion.id
      ? initialWorkspace.currentVersion
      : null,
  );
  const [notice, setNotice] = useState<WorkbenchNotice>(null);
  const [isParsing, startParseTransition] = useTransition();
  const [isOptimizing, startOptimizeTransition] = useTransition();

  const diffSections = useMemo(() => {
    if (!generatedVersion) {
      return [];
    }

    return buildResumeDiffSections(sourceVersion.contentJson, generatedVersion.contentJson);
  }, [generatedVersion, sourceVersion.contentJson]);

  function handleParseJd() {
    startParseTransition(() => {
      void (async () => {
        setNotice(null);

        try {
          const response = await fetch("/api/jd/parse", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              resumeId,
              resumeVersionId: sourceVersion.id,
              jdText,
            }),
          });
          const payload = (await response.json()) as
            | ApiSuccess<JDAnalysisRecord>
            | ApiFailure;

          if (!payload.success) {
            setNotice({
              type: "error",
              message: payload.error.message,
            });
            return;
          }

          setAnalysis(payload.data);
          setGeneratedVersion(null);
          setNotice({
            type: "success",
            message: "JD 已解析完成，可以继续生成岗位定制版本。",
          });
          captureAnalyticsEvent(telemetryEvents.jdParseSuccess, {
            resumeId,
            resumeVersionId: sourceVersion.id,
            analysisId: payload.data.id,
          });
        } catch {
          setNotice({
            type: "error",
            message: "JD 解析失败，请检查网络后重试。",
          });
        }
      })();
    });
  }

  function handleOptimize() {
    if (!analysis) {
      setNotice({
        type: "error",
        message: "请先完成 JD 解析。",
      });
      return;
    }

    startOptimizeTransition(() => {
      void (async () => {
        setNotice(null);

        try {
          const response = await fetch(
            `/api/resumes/${resumeId}/versions/${sourceVersion.id}/optimize`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                analysisId: analysis.id,
              }),
            },
          );
          const payload = (await response.json()) as
            | ApiSuccess<ResumeWorkspace>
            | ApiFailure;

          if (!payload.success || !payload.data.currentVersion) {
            setNotice({
              type: "error",
              message: payload.success
                ? "岗位版本生成失败，请稍后重试。"
                : payload.error.message,
            });
            return;
          }

          setWorkspace(payload.data);
          setGeneratedVersion(payload.data.currentVersion);
          setNotice({
            type: "success",
            message: "岗位定制版本已生成，差异和新版本预览已更新。",
          });
          captureAnalyticsEvent(telemetryEvents.resumeOptimizeSuccess, {
            resumeId,
            resumeVersionId: payload.data.currentVersion.id,
            analysisId: analysis.id,
          });
          trackVersionCreated({
            source: "resume_optimize",
            resumeId,
            versionId: payload.data.currentVersion.id,
            versionType: payload.data.currentVersion.versionType,
          });
          router.refresh();
        } catch {
          setNotice({
            type: "error",
            message: "岗位版本生成失败，请检查网络后重试。",
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

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <SectionCard
            title="当前优化源版本"
            description="岗位优化默认基于当前版本生成新的 job_targeted 版本，不会覆盖源版本。"
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <p>版本名称：{sourceVersion.versionName}</p>
              <p>版本类型：{sourceVersion.versionType}</p>
              <p>更新时间：{formatDate(sourceVersion.updatedAt)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/resumes/${resumeId}/edit`}
                className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                先去编辑源版本
              </Link>
              <Link
                href={`/resumes/${resumeId}/versions`}
                className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                查看所有版本
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            title="JD 输入"
            description="粘贴目标岗位 JD 后，系统会先提取关键词与匹配差距，再允许创建岗位版本。"
          >
            <textarea
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              rows={16}
              placeholder="请粘贴完整 JD 文本..."
              className="w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-4 text-sm leading-6"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleParseJd}
                disabled={isParsing}
                className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isParsing ? "解析中..." : "解析 JD"}
              </button>
              <button
                type="button"
                onClick={handleOptimize}
                disabled={!analysis || isOptimizing}
                className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOptimizing ? "生成中..." : "生成岗位版本"}
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="JD 解析结果"
            description="这里展示结构化关键词、职责、技能要求和当前版本的匹配差距。"
          >
            {!analysis ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                还没有解析结果。先粘贴 JD 并执行解析。
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      岗位信息
                    </p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
                      <p>岗位名称：{analysis.jobTitle || "未识别"}</p>
                      <p>公司名称：{analysis.companyName || "未识别"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      最近解析
                    </p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
                      <p>创建时间：{formatDate(analysis.createdAt)}</p>
                      <p>模型标识：{analysis.modelName ?? "local-template"}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                    <p className="font-medium">核心关键词</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.parsedKeywords.length > 0 ? (
                        analysis.parsedKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]"
                          >
                            {keyword}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-[color:var(--muted)]">暂无。</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                    <p className="font-medium">职责要求</p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
                      {analysis.responsibilities.length > 0 ? (
                        analysis.responsibilities.map((item) => <p key={item}>• {item}</p>)
                      ) : (
                        <p className="text-[color:var(--muted)]">暂无。</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                    <p className="font-medium">技能要求与差距</p>
                    <div className="mt-3 space-y-3 text-sm leading-6">
                      <div>
                        <p className="text-[color:var(--muted)]">JD 技能要求</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {analysis.requiredSkills.length > 0 ? (
                            analysis.requiredSkills.map((skill) => (
                              <span
                                key={skill}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                {skill}
                              </span>
                            ))
                          ) : (
                            <p className="text-[color:var(--muted)]">暂无。</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[color:var(--muted)]">当前版本缺口</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {analysis.matchGaps.length > 0 ? (
                            analysis.matchGaps.map((gap) => (
                              <span
                                key={gap}
                                className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                              >
                                {gap}
                              </span>
                            ))
                          ) : (
                            <p className="text-[color:var(--muted)]">
                              当前版本已覆盖主要关键词。
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="源版本预览"
            description="先确认源版本内容，再决定是否生成新的岗位定制版。"
          >
            <ResumePreview content={sourceVersion.contentJson} />
          </SectionCard>

          <SectionCard
            title="最新岗位版本"
            description="每次生成都会沉淀为新的 job_targeted 版本，并出现在版本链上。"
          >
            {generatedVersion ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
                  <p className="font-medium">{generatedVersion.versionName}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {generatedVersion.changeSummary?.generationSummary ??
                      "当前岗位版本还没有额外摘要。"}
                  </p>
                </div>
                <ResumePreview content={generatedVersion.contentJson} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                还没有生成岗位定制版。完成 JD 解析后即可创建。
              </div>
            )}
          </SectionCard>
        </div>
      </section>

      <ResumeDiffView
        diffSections={diffSections}
        emptyMessage="生成岗位版本后，这里会展示相对源版本的结构化差异。"
      />

      <SectionCard
        title="当前版本链"
        description="新生成的岗位版本已经合入当前简历资产，可以直接进入版本页继续查看。"
      >
        <div className="space-y-3">
          {workspace.versions.slice(0, 5).map((version) => (
            <div
              key={version.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{version.versionName}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {formatDate(version.createdAt)}
                  </p>
                </div>
                {version.jobTargetTitle ? (
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                    {version.jobTargetTitle}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
