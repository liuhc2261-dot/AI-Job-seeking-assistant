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

function getTemplatePresentation(template: ExportTemplate) {
  const presentations: Record<string, { name: string; description: string; recommendedFor: string; preview: string }> = {
    "ats-standard": {
      name: "标准 ATS 模板",
      description: "单栏、清晰、稳健，优先保证中文排版和 ATS 可读性。",
      recommendedFor: "校招 / 实习 / 通用岗位",
      preview: "single-col",
    },
    "clean-tech": {
      name: "简洁技术岗模板",
      description: "极简等宽字体风格，强调技术栈和项目细节，适合互联网技术岗位。",
      recommendedFor: "技术岗 / 研发 / 算法 / 后端",
      preview: "clean-tech",
    },
    creative: {
      name: "创意双栏模板",
      description: "左右双栏布局，左侧彩色边栏展示联系人和技能，视觉层次丰富。",
      recommendedFor: "设计 / 产品 / 运营 / 创意类",
      preview: "dual-col",
    },
  };

  return presentations[template.id] ?? { ...template, preview: "single-col" };
}

function TemplatePreview({ type }: { type: string }) {
  if (type === "clean-tech") {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-[color:var(--border)] bg-white p-3 font-mono text-[9px]">
        <div className="border-b border-[color:var(--border)] pb-1">
          <div className="font-bold text-[color:var(--foreground)]">王小明</div>
          <div className="text-[color:var(--muted)]">前端开发工程师</div>
          <div className="mt-1 flex gap-2 text-[color:var(--muted)]">
            <span>138****0000</span>
            <span>wang@example.com</span>
          </div>
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-wider text-[color:var(--muted)]">项目经历</div>
        <div className="flex justify-between">
          <span className="font-semibold text-[color:var(--foreground)]">企业管理系统</span>
          <span className="text-[color:var(--muted)]">2022.07 - 2023.12</span>
        </div>
        <div className="text-[color:var(--muted)]">React / TypeScript / Node.js</div>
        <div className="ml-2 text-[color:var(--muted)]">· 负责前端架构设计</div>
      </div>
    );
  }

  if (type === "dual-col") {
    return (
      <div className="flex gap-0 rounded-lg border border-[color:var(--border)] overflow-hidden text-[8px]">
        <div className="w-1/3 bg-[color:var(--foreground)] p-2 text-white">
          <div className="font-bold">王小明</div>
          <div className="mt-1 text-[7px] uppercase tracking-wider opacity-60">前端工程师</div>
          <div className="mt-2 space-y-1 text-[7px] opacity-80">
            <div>138****0000</div>
            <div>wang@example.com</div>
            <div>北京</div>
          </div>
          <div className="mt-2 text-[7px] uppercase tracking-wider opacity-60">技能</div>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {["React", "Vue", "TS"].map((s) => (
              <span key={s} className="rounded-sm bg-white/20 px-1 text-white">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white p-2">
          <div className="border-l-2 border-blue-500 pl-2 text-[9px] font-bold text-[color:var(--foreground)]">项目经历</div>
          <div className="mt-1">
            <div className="flex justify-between">
              <span className="font-semibold">企业管理系统</span>
              <span className="text-[color:var(--muted)]">2022.07</span>
            </div>
            <div className="text-[7px] text-blue-500">React / TypeScript</div>
            <div className="mt-0.5 text-[color:var(--muted)]">· 负责前端架构设计</div>
          </div>
        </div>
      </div>
    );
  }

  // Default: ats-standard
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[color:var(--border)] bg-white p-3 text-[9px]">
      <div className="border-b border-[color:var(--border)] pb-1">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-bold text-[color:var(--foreground)]">王小明</div>
            <div className="text-[color:var(--muted)]">目标岗位：前端开发工程师</div>
          </div>
          <div className="text-right text-[color:var(--muted)]">
            <div>138****0000</div>
            <div>wang@example.com</div>
          </div>
        </div>
      </div>
      <div className="text-[8px] uppercase tracking-wider text-[color:var(--muted)]">项目经历</div>
      <div className="flex justify-between border-b border-dashed border-[color:var(--border)] pb-1">
        <span className="font-semibold text-[color:var(--foreground)]">企业管理系统</span>
        <span className="text-[color:var(--muted)]">2022.07 - 2023.12</span>
      </div>
      <div className="ml-2 text-[color:var(--muted)]">· 负责前端架构设计</div>
    </div>
  );
}

function getFormatPresentation(format: ExportFormatOption) {
  if (format.id === "markdown") {
    return {
      ...format,
      label: "Markdown 源稿",
      description: "保留结构化内容和可编辑性，适合继续修改或二次排版。",
    };
  }

  if (format.id === "pdf") {
    return {
      ...format,
      label: "PDF 投递版",
      description: "基于稳定模板生成最终投递文件，适合直接发送或上传。",
    };
  }

  return format;
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
              ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
              : "border-[color:var(--error)] bg-[color:var(--error-soft)] text-[color:var(--error)]",
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <div className="space-y-6">
          <SectionCard
            tone="accent"
            title="导出工作台"
            description="先选择版本和模板，再决定输出 Markdown 源稿还是 PDF 投递版。"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  当前版本
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                  {selectedVersion?.versionName ?? "未选择"}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  版本类型
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                  {selectedVersion ? getVersionTypeLabel(selectedVersion.versionType) : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  默认模板
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                  {selectedTemplate ? getTemplatePresentation(selectedTemplate).name : "未选择"}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  历史导出
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">
                  {exports.length} 条
                </p>
              </div>
            </div>
          </SectionCard>

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
                <div className="rounded-2xl bg-[color:var(--brand-soft)] px-4 py-4 text-sm leading-6">
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
                        {getTemplatePresentation(template).name}
                      </option>
                    ))}
                  </select>
                  {selectedTemplate ? (
                    <p className="text-sm leading-6 text-[color:var(--muted)]">
                      {getTemplatePresentation(selectedTemplate).description}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleExport("markdown")}
                  disabled={!selectedVersion || isPending}
                  className="inline-flex rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingFormat === "markdown" ? "导出 Markdown..." : "导出 Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  disabled={!selectedVersion || isPending}
                  className="inline-flex rounded-full border border-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[color:var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingFormat === "pdf" ? "生成 PDF..." : "导出 PDF"}
                </button>
                <Link
                  href={`/resumes/${resumeId}/versions`}
                  className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
                >
                  查看版本链
                </Link>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="导出格式"
            description="Markdown 和 PDF 都已经接入真实链路，导出记录会写入数据库并保留下载入口。"
          >
            <div className="grid gap-3">
              {formats.map((format) => {
                const presentation = getFormatPresentation(format);

                return (
                  <div
                    key={format.id}
                    className={cn(
                      "rounded-2xl border px-4 py-4",
                      format.available
                        ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface-strong)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium">{presentation.label}</p>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          format.available
                            ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {format.available ? "已可用" : "待接入"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {presentation.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="PDF 模板"
            description="选择模板后导出，3 种风格适配不同岗位类型。"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const presentation = getTemplatePresentation(template);
                const isSelected = selectedTemplateId === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "border-[color:var(--brand)] ring-2 ring-[color:var(--brand)] ring-offset-1"
                        : "border-[color:var(--border)] hover:border-[color:var(--brand)]"
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{presentation.name}</p>
                        {isSelected && (
                          <span className="rounded-full bg-[color:var(--brand)] px-2 py-0.5 text-[10px] font-semibold text-white">
                            已选
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <TemplatePreview type={presentation.preview} />
                      </div>
                      <p className="mt-2 text-[10px] leading-5 text-[color:var(--muted)]">
                        {presentation.description}
                      </p>
                      <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[color:var(--muted)]">
                        {presentation.recommendedFor}
                      </p>
                    </div>
                  </button>
                );
              })}
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
                            ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                            : record.status === "failed"
                              ? "bg-[color:var(--error-soft)] text-[color:var(--error)]"
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
                          className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
                        >
                          重新下载
                        </a>
                      ) : null}

                      {record.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => handleRetry(record)}
                          disabled={isPending}
                          className="inline-flex rounded-full bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
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
                还没有导出记录。选定版本后，可以先导出 Markdown，再生成 PDF 投递版。
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
