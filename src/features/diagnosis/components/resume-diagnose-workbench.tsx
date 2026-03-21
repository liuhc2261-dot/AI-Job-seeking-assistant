"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

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
import type {
  DiagnosisCategory,
  DiagnosisIssueRecord,
  DiagnosisReportRecord,
} from "@/types/diagnosis";
import type { ResumeVersionRecord, ResumeWorkspace } from "@/types/resume";

type ResumeDiagnoseWorkbenchProps = {
  resumeId: string;
  initialSourceVersion: ResumeVersionRecord;
  initialWorkspace: ResumeWorkspace;
  initialReport: DiagnosisReportRecord | null;
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

type DiagnosisApplyResponse = {
  workspace: ResumeWorkspace;
  appliedSuggestionIds: string[];
};

const categoryOrder: DiagnosisCategory[] = [
  "content",
  "expression",
  "structure",
  "match",
  "ats",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getCategoryLabel(category: DiagnosisCategory) {
  switch (category) {
    case "content":
      return "内容";
    case "expression":
      return "表达";
    case "structure":
      return "结构";
    case "match":
      return "匹配";
    case "ats":
      return "ATS";
    default:
      return category;
  }
}

function getSeverityLabel(severity: DiagnosisIssueRecord["severity"]) {
  switch (severity) {
    case "high":
      return "高优先级";
    case "medium":
      return "中优先级";
    case "low":
      return "低优先级";
    default:
      return severity;
  }
}

function getSeverityClassName(severity: DiagnosisIssueRecord["severity"]) {
  switch (severity) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "low":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getAutoApplicableSuggestionIds(report: DiagnosisReportRecord | null) {
  if (!report) {
    return [];
  }

  return report.suggestions
    .filter((suggestion) => suggestion.canAutoApply && suggestion.patch)
    .map((suggestion) => suggestion.id);
}

function groupIssuesByCategory(issues: DiagnosisIssueRecord[]) {
  return categoryOrder
    .map((category) => ({
      category,
      items: issues.filter((issue) => issue.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

export function ResumeDiagnoseWorkbench({
  resumeId,
  initialSourceVersion,
  initialWorkspace,
  initialReport,
  initialAnalysis,
}: ResumeDiagnoseWorkbenchProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [sourceVersion] = useState(initialSourceVersion);
  const [analysis] = useState(initialAnalysis);
  const [report, setReport] = useState<DiagnosisReportRecord | null>(initialReport);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>(
    getAutoApplicableSuggestionIds(initialReport),
  );
  const [appliedVersion, setAppliedVersion] = useState<ResumeVersionRecord | null>(null);
  const [notice, setNotice] = useState<WorkbenchNotice>(null);
  const [isDiagnosing, startDiagnoseTransition] = useTransition();
  const [isApplying, startApplyTransition] = useTransition();

  const issueGroups = useMemo(() => {
    return report ? groupIssuesByCategory(report.issues) : [];
  }, [report]);

  const autoApplicableSuggestions = useMemo(() => {
    return report?.suggestions.filter(
      (suggestion) => suggestion.canAutoApply && suggestion.patch,
    ) ?? [];
  }, [report]);

  const diffSections = useMemo(() => {
    if (!appliedVersion) {
      return [];
    }

    return buildResumeDiffSections(sourceVersion.contentJson, appliedVersion.contentJson);
  }, [appliedVersion, sourceVersion.contentJson]);

  function toggleSuggestion(suggestionId: string) {
    setSelectedSuggestionIds((currentIds) =>
      currentIds.includes(suggestionId)
        ? currentIds.filter((item) => item !== suggestionId)
        : [...currentIds, suggestionId],
    );
  }

  function handleDiagnose() {
    startDiagnoseTransition(() => {
      void (async () => {
        setNotice(null);

        try {
          const response = await fetch(
            `/api/resumes/${resumeId}/versions/${sourceVersion.id}/diagnose`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                analysisId: analysis?.id,
              }),
            },
          );
          const payload = (await response.json()) as
            | ApiSuccess<DiagnosisReportRecord>
            | ApiFailure;

          if (!payload.success) {
            setNotice({
              type: "error",
              message: payload.error.message,
            });
            return;
          }

          setReport(payload.data);
          setAppliedVersion(null);
          setSelectedSuggestionIds(getAutoApplicableSuggestionIds(payload.data));
          captureAnalyticsEvent(telemetryEvents.diagnoseSuccess, {
            resumeId,
            resumeVersionId: sourceVersion.id,
            reportId: payload.data.id,
            analysisId: analysis?.id ?? null,
          });
          setNotice({
            type: "success",
            message: "诊断已完成，问题分类和建议列表已更新。",
          });
        } catch {
          setNotice({
            type: "error",
            message: "简历诊断失败，请检查网络后重试。",
          });
        }
      })();
    });
  }

  function handleApplySuggestions() {
    if (!report) {
      setNotice({
        type: "error",
        message: "请先完成诊断，再应用建议。",
      });
      return;
    }

    if (selectedSuggestionIds.length === 0) {
      setNotice({
        type: "error",
        message: "请至少勾选一条可自动应用的建议。",
      });
      return;
    }

    startApplyTransition(() => {
      void (async () => {
        setNotice(null);

        try {
          const response = await fetch("/api/diagnose/apply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              resumeId,
              resumeVersionId: sourceVersion.id,
              reportId: report.id,
              suggestionIds: selectedSuggestionIds,
            }),
          });
          const payload = (await response.json()) as
            | ApiSuccess<DiagnosisApplyResponse>
            | ApiFailure;

          if (!payload.success || !payload.data.workspace.currentVersion) {
            setNotice({
              type: "error",
              message: payload.success
                ? "诊断建议应用失败，请稍后重试。"
                : payload.error.message,
            });
            return;
          }

          setWorkspace(payload.data.workspace);
          setAppliedVersion(payload.data.workspace.currentVersion);
          trackVersionCreated({
            source: "diagnosis_apply",
            resumeId,
            versionId: payload.data.workspace.currentVersion.id,
            versionType: payload.data.workspace.currentVersion.versionType,
            appliedSuggestionCount: payload.data.appliedSuggestionIds.length,
          });
          setNotice({
            type: "success",
            message: `已应用 ${payload.data.appliedSuggestionIds.length} 条建议，并生成新的可回滚版本。`,
          });
        } catch {
          setNotice({
            type: "error",
            message: "诊断建议应用失败，请检查网络后重试。",
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
            title="诊断源版本"
            description="本次诊断基于当前版本执行，诊断建议应用后会新建版本，不会覆盖源版本。"
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <p>版本名称：{sourceVersion.versionName}</p>
              <p>版本类型：{sourceVersion.versionType}</p>
              <p>最近更新：{formatDate(sourceVersion.updatedAt)}</p>
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
                查看版本链
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            title="诊断控制台"
            description="先跑规则引擎，再接入 ResumeDiagnoserAgent 做语义诊断。"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                <p>规则检查覆盖内容、表达、结构、匹配和 ATS 五个维度。</p>
                <p className="mt-2">
                  诊断建议只会在真实信息边界内给出，可自动应用的建议也会另存为新版本。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDiagnose}
                  disabled={isDiagnosing}
                  className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDiagnosing ? "诊断中..." : "运行简历诊断"}
                </button>
                <button
                  type="button"
                  onClick={handleApplySuggestions}
                  disabled={selectedSuggestionIds.length === 0 || isApplying}
                  className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isApplying ? "应用中..." : "应用已勾选建议"}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="JD 上下文"
            description="如果当前版本关联过 JD 分析，诊断会把岗位匹配问题一起纳入。"
          >
            {analysis ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      关联分析
                    </p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
                      <p>岗位名称：{analysis.jobTitle || "未识别"}</p>
                      <p>公司名称：{analysis.companyName || "未识别"}</p>
                      <p>分析时间：{formatDate(analysis.createdAt)}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      当前缺口
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
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
                        <p className="text-sm text-[color:var(--muted)]">
                          当前版本已覆盖主要关键词。
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {analysis.parsedKeywords.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">岗位关键词</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis.parsedKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                当前没有关联的 JD 分析，本次会先进行通用简历诊断。
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="源版本预览"
          description="右侧始终展示当前诊断源版本，方便对照问题和后续应用结果。"
        >
          <ResumePreview content={sourceVersion.contentJson} />
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <SectionCard
            title="诊断总览"
            description="评分只作辅助参考，更重要的是下面的问题证据和建议。"
          >
            {!report ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                还没有诊断结果。点击上方按钮后，这里会展示评分和问题分类。
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      Overall
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-[color:var(--accent)]">
                      {report.scoreOverview.overall}
                    </p>
                  </div>
                  {categoryOrder.map((category) => (
                    <div
                      key={category}
                      className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                        {getCategoryLabel(category)}
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">
                        {report.scoreOverview[category]}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                  <p>{report.scoreOverview.summary}</p>
                  <p className="mt-2">
                    最近诊断时间：{formatDate(report.createdAt)} · 模型标识：
                    {report.modelName ?? "local-template"}
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="问题清单"
            description="问题先按维度分组，再按优先级展示，方便你决定先改哪里。"
          >
            {!report ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                诊断完成后，这里会列出内容、表达、结构、匹配和 ATS 五类问题。
              </div>
            ) : issueGroups.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-sm leading-6 text-emerald-700">
                当前没有识别到明显高风险问题，可以继续围绕目标岗位做手动润色。
              </div>
            ) : (
              <div className="space-y-5">
                {issueGroups.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                        {getCategoryLabel(group.category)}
                      </span>
                      <p className="text-sm text-[color:var(--muted)]">
                        {group.items.length} 条问题
                      </p>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((issue) => (
                        <div
                          key={issue.id}
                          className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{issue.title}</p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                                {issue.evidence}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-semibold",
                                getSeverityClassName(issue.severity),
                              )}
                            >
                              {getSeverityLabel(issue.severity)}
                            </span>
                          </div>
                          <div className="mt-3 rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3 text-sm leading-6 text-slate-700">
                            建议：{issue.suggestion}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="建议列表"
            description="支持自动应用的建议可以勾选后生成新版本；其余建议保留给你手动确认。"
          >
            {!report ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                诊断完成后，这里会展示建议和可自动应用入口。
              </div>
            ) : report.suggestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                当前没有额外建议，可以直接继续编辑或导出。
              </div>
            ) : (
              <div className="space-y-3">
                {report.suggestions.map((suggestion) => {
                  const isSelected = selectedSuggestionIds.includes(suggestion.id);

                  return (
                    <label
                      key={suggestion.id}
                      className={cn(
                        "block rounded-2xl border px-4 py-4 transition",
                        suggestion.canAutoApply && suggestion.patch
                          ? isSelected
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                            : "border-[color:var(--border)] bg-white hover:border-[color:var(--accent)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface-strong)]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSuggestion(suggestion.id)}
                          disabled={!suggestion.canAutoApply || !suggestion.patch}
                          className="mt-1 h-4 w-4 rounded border-[color:var(--border)] text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-900">
                              {suggestion.title}
                            </p>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                              {getCategoryLabel(suggestion.category)}
                            </span>
                            {suggestion.canAutoApply && suggestion.patch ? (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                可自动应用
                              </span>
                            ) : null}
                            {suggestion.requiresUserConfirmation ? (
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                需人工确认
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                            {suggestion.rationale}
                          </p>
                          <p className="mt-3 text-sm font-medium text-slate-700">
                            操作建议：{suggestion.actionText}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}

                {autoApplicableSuggestions.length > 0 ? (
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                    当前共有 {autoApplicableSuggestions.length} 条建议支持自动应用，默认勾选。
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="最新应用结果"
            description="自动应用建议后，新版本会立刻出现在这里，并同步进入版本链。"
          >
            {appliedVersion ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4">
                  <p className="font-medium">{appliedVersion.versionName}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {appliedVersion.changeSummary?.generationSummary ??
                      "新的诊断应用版本已生成。"}
                  </p>
                </div>
                <ResumePreview content={appliedVersion.contentJson} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                还没有应用结果。勾选支持自动应用的建议后即可生成新版本。
              </div>
            )}
          </SectionCard>
        </div>
      </section>

      <ResumeDiffView
        diffSections={diffSections}
        title="诊断应用差异"
        description="这里只展示应用建议前后的结构化差异，方便确认没有越过真实边界。"
        emptyMessage="应用建议后，这里会展示相对源版本的结构化差异。"
      />

      <SectionCard
        title="当前版本链"
        description="诊断应用生成的新版本已经纳入当前简历资产，可以继续回看和比较。"
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
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                  {version.createdBy}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
