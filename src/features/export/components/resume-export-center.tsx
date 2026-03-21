"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { SectionCard } from "@/components/section-card";
import {
  captureAnalyticsEvent,
  telemetryEvents,
} from "@/lib/telemetry/client";
import { cn } from "@/lib/utils";
import type {
  ExportFormatOption,
  ExportTemplate,
  ResumeExportRecord,
  ResumeExportType,
} from "@/types/export";
import type { ResumeVersionRecord } from "@/types/resume";

type ResumeExportCenterProps = {
  resumeId: string;
  resumeName: string;
  initialVersionId: string;
  versions: ResumeVersionRecord[];
  initialExports: ResumeExportRecord[];
  templates: ExportTemplate[];
  formats: ExportFormatOption[];
  markdownTemplateName: string;
  pdfTemplateName: string;
};

type Notice =
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number | null) {
  if (!value) {
    return "未记录";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kb = value / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function getVersionTypeLabel(versionType: ResumeVersionRecord["versionType"]) {
  switch (versionType) {
    case "master":
      return "母版";
    case "job_targeted":
      return "岗位版";
    case "manual":
      return "手动版";
    case "ai_rewrite":
      return "诊断应用版";
    default:
      return versionType;
  }
}

function getExportStatusLabel(status: ResumeExportRecord["status"]) {
  switch (status) {
    case "success":
      return "成功";
    case "failed":
      return "失败";
    case "pending":
      return "处理中";
    default:
      return status;
  }
}

function getExportSuccessMessage(format: ResumeExportType) {
  return format === "pdf"
    ? "PDF 已导出，下载将自动开始。"
    : "Markdown 已导出，下载将自动开始。";
}

function getExportRetrySuccessMessage(format: ResumeExportType) {
  return format === "pdf"
    ? "PDF 已重新导出，下载将自动开始。"
    : "Markdown 已重新导出，下载将自动开始。";
}

export function ResumeExportCenter({
  resumeId,
  resumeName,
  initialVersionId,
  versions,
  initialExports,
  templates,
  formats,
  markdownTemplateName,
  pdfTemplateName,
}: ResumeExportCenterProps) {
  const [selectedVersionId, setSelectedVersionId] = useState(initialVersionId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(pdfTemplateName);
  const [exports, setExports] = useState(initialExports);
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingFormat, setPendingFormat] = useState<ResumeExportType | null>(null);
  const [retryingExportId, setRetryingExportId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedVersion = useMemo(() => {
    return (
      versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null
    );
  }, [selectedVersionId, versions]);

  const selectedTemplate = useMemo(() => {
    return (
      templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null
    );
  }, [selectedTemplateId, templates]);

  function runExportRequest(input: {
    route: string;
    requestInit?: RequestInit;
    successMessage: string;
    fallbackErrorMessage: string;
    onStart?: () => void;
    onSuccess?: (record: ResumeExportRecord) => void;
    onFinally?: () => void;
  }) {
    startTransition(() => {
      void (async () => {
        setNotice(null);
        input.onStart?.();

        try {
          const response = await fetch(input.route, {
            method: "POST",
            ...input.requestInit,
          });
          const payload = (await response.json()) as
            | ApiSuccess<ResumeExportRecord>
            | ApiFailure;

          if (!response.ok || !payload.success) {
            setNotice({
              type: "error",
              message:
                payload.success === false
                  ? payload.error.message
                  : "导出失败，请稍后重试。",
            });
            return;
          }

          setExports((currentExports) => [payload.data, ...currentExports]);
          input.onSuccess?.(payload.data);
          setNotice({
            type: "success",
            message: input.successMessage,
          });

          if (payload.data.fileUrl) {
            window.location.assign(payload.data.fileUrl);
          }
        } catch {
          setNotice({
            type: "error",
            message: input.fallbackErrorMessage,
          });
        } finally {
          input.onFinally?.();
        }
      })();
    });
  }

  function handleExport(format: ResumeExportType) {
    if (!selectedVersion) {
      setNotice({
        type: "error",
        message: "当前没有可导出的简历版本。",
      });
      return;
    }

    const route =
      format === "pdf"
        ? `/api/resumes/${resumeId}/versions/${selectedVersion.id}/export/pdf`
        : `/api/resumes/${resumeId}/versions/${selectedVersion.id}/export/md`;
    const requestBody =
      format === "pdf"
        ? {
            templateName: selectedTemplate?.id ?? pdfTemplateName,
          }
        : {
            templateName: markdownTemplateName,
          };

    runExportRequest({
      route,
      requestInit: {
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      successMessage: getExportSuccessMessage(format),
      fallbackErrorMessage: "导出请求失败，请检查网络或稍后重试。",
      onStart: () => setPendingFormat(format),
      onSuccess: (record) => {
        if (record.exportType !== "pdf") {
          return;
        }

        captureAnalyticsEvent(telemetryEvents.exportPdfSuccess, {
          source: "create",
          resumeId,
          resumeVersionId: record.resumeVersionId,
          exportId: record.id,
          templateName: record.templateName,
        });
      },
      onFinally: () => setPendingFormat(null),
    });
  }

  function handleRetry(record: ResumeExportRecord) {
    if (record.status !== "failed") {
      return;
    }

    runExportRequest({
      route: `/api/exports/${record.id}/retry`,
      successMessage: getExportRetrySuccessMessage(record.exportType),
      fallbackErrorMessage: "重试请求失败，请检查网络或稍后重试。",
      onStart: () => setRetryingExportId(record.id),
      onSuccess: (retriedRecord) => {
        if (retriedRecord.exportType !== "pdf") {
          return;
        }

        captureAnalyticsEvent(telemetryEvents.exportPdfSuccess, {
          source: "retry",
          resumeId,
          resumeVersionId: retriedRecord.resumeVersionId,
          exportId: retriedRecord.id,
          templateName: retriedRecord.templateName,
          previousExportId: record.id,
        });
      },
      onFinally: () => setRetryingExportId(null),
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

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <div className="space-y-6">
          <SectionCard
            title="导出源版本"
            description="所有导出都围绕现有版本资产执行，不会覆盖内容。先选版本，再选择导出格式。"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="export-version" className="text-sm font-medium">
                  当前版本
                </label>
                <select
                  id="export-version"
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm"
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.versionName} / {getVersionTypeLabel(version.versionType)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVersion ? (
                <div className="rounded-2xl bg-[color:var(--accent-soft)] px-4 py-4 text-sm leading-6">
                  <p className="font-medium">{selectedVersion.versionName}</p>
                  <p className="mt-2 text-[color:var(--muted)]">
                    版本类型：{getVersionTypeLabel(selectedVersion.versionType)}
                  </p>
                  {selectedVersion.jobTargetTitle ? (
                    <p className="text-[color:var(--muted)]">
                      目标岗位：{selectedVersion.jobTargetTitle}
                    </p>
                  ) : null}
                  <p className="text-[color:var(--muted)]">
                    更新时间：{formatDate(selectedVersion.updatedAt)}
                  </p>
                </div>
              ) : null}

              {templates.length > 0 ? (
                <div className="space-y-2">
                  <label htmlFor="export-template" className="text-sm font-medium">
                    PDF 模板
                  </label>
                  <select
                    id="export-template"
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {selectedTemplate ? (
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {selectedTemplate.description}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleExport("markdown")}
                  disabled={!selectedVersion || isPending}
                  className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingFormat === "markdown" ? "导出 Markdown..." : "导出 Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  disabled={!selectedVersion || isPending}
                  className="inline-flex rounded-full border border-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingFormat === "pdf" ? "生成 PDF..." : "导出 PDF"}
                </button>
                <Link
                  href={`/resumes/${resumeId}/versions`}
                  className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                >
                  查看版本链
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="导出格式"
            description="当前 Markdown 和 PDF 都已接入真实链路，导出记录会写入 exports 表并保留下载入口。"
          >
            <div className="grid gap-3">
              {formats.map((format) => (
                <div
                  key={format.id}
                  className={cn(
                    "rounded-2xl border px-4 py-4",
                    format.available
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[color:var(--border)] bg-[color:var(--surface-strong)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{format.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        format.available
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {format.available ? "已可用" : "待接入"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {format.description}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="稳定模板"
            description="当前只保留 1 个稳定的 ATS 模板，用同一套 content_json 字段渲染 HTML，再交给服务端浏览器生成 PDF。"
          >
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
                >
                  <p className="font-medium">{template.name}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                    {template.description}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    {template.recommendedFor}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="导出历史"
            description={`${resumeName} 的导出记录会沉淀到数据库，成功记录可重新下载，失败记录可直接重试。`}
          >
            {exports.length > 0 ? (
              <div className="space-y-3">
                {exports.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{record.resumeVersionName}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {record.exportType.toUpperCase()} / {formatDate(record.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          record.status === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : record.status === "failed"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {getExportStatusLabel(record.status)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-sm leading-6 text-[color:var(--muted)]">
                      <p>版本类型：{getVersionTypeLabel(record.resumeVersionType)}</p>
                      <p>模板标识：{record.templateName}</p>
                      <p>文件大小：{formatBytes(record.fileSize)}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {record.fileUrl ? (
                        <a
                          href={record.fileUrl}
                          className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                        >
                          重新下载
                        </a>
                      ) : null}

                      {record.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => handleRetry(record)}
                          disabled={isPending}
                          className="inline-flex rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {retryingExportId === record.id ? "重试导出中..." : "重试导出"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
                还没有导出记录。选定版本后，可以先导出 Markdown，再直接生成 PDF 投递版。
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
