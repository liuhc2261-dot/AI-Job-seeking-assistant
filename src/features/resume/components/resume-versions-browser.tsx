"use client";

import { useMemo, useState, useTransition } from "react";

import { SectionCard } from "@/components/section-card";
import { ResumeDiffView } from "@/features/resume/components/resume-diff-view";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import { ResumeVersionTimeline } from "@/features/resume/components/resume-version-timeline";
import { trackVersionCreated } from "@/lib/telemetry/client";
import { buildResumeDiffSections } from "@/lib/resume-diff";
import { cn } from "@/lib/utils";
import type { ResumeWorkspace } from "@/types/resume";

type ResumeVersionsBrowserProps = {
  workspace: ResumeWorkspace;
};

type Notice =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type PendingAction = "copy" | "rollback" | "rename" | "delete" | null;

type WorkspaceMutationSuccess = {
  success: true;
  data: {
    workspace: ResumeWorkspace;
    createdVersionId?: string;
    updatedVersionId?: string;
    deletedVersionId?: string;
    deletedWasCurrent?: boolean;
  };
};

type WorkspaceMutationFailure = {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
};

function getVersionTypeLabel(versionType: ResumeWorkspace["versions"][number]["versionType"]) {
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

export function ResumeVersionsBrowser({
  workspace: initialWorkspace,
}: ResumeVersionsBrowserProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedVersionId, setSelectedVersionId] = useState(
    initialWorkspace.currentVersion?.id ?? initialWorkspace.versions[0]?.id ?? "",
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const currentVersion = workspace.currentVersion ?? workspace.versions[0] ?? null;
  const selectedVersion =
    workspace.versions.find((version) => version.id === selectedVersionId) ??
    currentVersion ??
    workspace.versions[0] ??
    null;
  const sourceVersion = selectedVersion?.sourceVersionId
    ? workspace.versions.find((version) => version.id === selectedVersion.sourceVersionId) ?? null
    : null;
  const diffSections = useMemo(() => {
    if (!selectedVersion || !sourceVersion) {
      return [];
    }

    return buildResumeDiffSections(sourceVersion.contentJson, selectedVersion.contentJson);
  }, [selectedVersion, sourceVersion]);

  const canCopy = Boolean(selectedVersion) && !isPending;
  const canRollback =
    Boolean(selectedVersion) &&
    Boolean(currentVersion) &&
    selectedVersion.id !== currentVersion.id &&
    !isPending;
  const canDelete = Boolean(selectedVersion) && workspace.versions.length > 1 && !isPending;
  const isEditingSelectedVersion =
    Boolean(selectedVersion) && editingVersionId === selectedVersion?.id;

  function applyWorkspace(nextWorkspace: ResumeWorkspace, preferredVersionId?: string | null) {
    setWorkspace(nextWorkspace);
    setSelectedVersionId(
      preferredVersionId ??
        nextWorkspace.currentVersion?.id ??
        nextWorkspace.versions[0]?.id ??
        "",
    );
  }

  function cancelRename() {
    setEditingVersionId(null);
    setRenameValue("");
  }

  function startRename() {
    if (!selectedVersion) {
      return;
    }

    setEditingVersionId(selectedVersion.id);
    setRenameValue(selectedVersion.versionName);
    setNotice(null);
  }

  async function readWorkspacePayload(response: Response) {
    return (await response.json()) as WorkspaceMutationSuccess | WorkspaceMutationFailure;
  }

  function runVersionCreationMutation(input: {
    action: Extract<PendingAction, "copy" | "rollback">;
    endpoint: string;
    successMessage: string;
  }) {
    startTransition(() => {
      void (async () => {
        setNotice(null);
        setPendingAction(input.action);

        try {
          const response = await fetch(input.endpoint, {
            method: "POST",
          });
          const payload = await readWorkspacePayload(response);

          if (!response.ok || !payload.success) {
            setNotice({
              type: "error",
              message:
                payload.success === false
                  ? payload.error.message
                  : "版本操作失败，请稍后重试。",
            });
            return;
          }

          applyWorkspace(payload.data.workspace, payload.data.createdVersionId ?? null);
          const createdVersion = payload.data.workspace.versions.find(
            (version) => version.id === payload.data.createdVersionId,
          );

          if (payload.data.createdVersionId) {
            trackVersionCreated({
              source: input.action,
              resumeId: payload.data.workspace.resume.id,
              versionId: payload.data.createdVersionId,
              versionType:
                createdVersion?.versionType ?? selectedVersion?.versionType ?? "manual",
            });
          }

          setNotice({
            type: "success",
            message: input.successMessage,
          });
        } catch {
          setNotice({
            type: "error",
            message: "版本请求失败，请检查网络后重试。",
          });
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  function runWorkspaceMutation(input: {
    action: Extract<PendingAction, "rename" | "delete">;
    endpoint: string;
    method: "PATCH" | "DELETE";
    body?: Record<string, unknown>;
    successMessage: string;
    nextSelectedVersionId?: string | null;
  }) {
    startTransition(() => {
      void (async () => {
        setNotice(null);
        setPendingAction(input.action);

        try {
          const response = await fetch(input.endpoint, {
            method: input.method,
            headers: input.body
              ? {
                  "Content-Type": "application/json",
                }
              : undefined,
            body: input.body ? JSON.stringify(input.body) : undefined,
          });
          const payload = await readWorkspacePayload(response);

          if (!response.ok || !payload.success) {
            setNotice({
              type: "error",
              message:
                payload.success === false
                  ? payload.error.message
                  : "版本操作失败，请稍后重试。",
            });
            return;
          }

          applyWorkspace(payload.data.workspace, input.nextSelectedVersionId ?? null);
          cancelRename();
          setNotice({
            type: "success",
            message: input.successMessage,
          });
        } catch {
          setNotice({
            type: "error",
            message: "版本请求失败，请检查网络后重试。",
          });
        } finally {
          setPendingAction(null);
        }
      })();
    });
  }

  function handleCopy() {
    if (!selectedVersion) {
      return;
    }

    runVersionCreationMutation({
      action: "copy",
      endpoint: `/api/resumes/${workspace.resume.id}/versions/${selectedVersion.id}/copy`,
      successMessage: `已基于 ${selectedVersion.versionName} 创建新的副本，可继续编辑或比较差异。`,
    });
  }

  function handleRollback() {
    if (!selectedVersion) {
      return;
    }

    runVersionCreationMutation({
      action: "rollback",
      endpoint: `/api/resumes/${workspace.resume.id}/versions/${selectedVersion.id}/rollback`,
      successMessage: `已基于 ${selectedVersion.versionName} 生成新的回滚版本，历史链路保持不变。`,
    });
  }

  function handleRename() {
    if (!selectedVersion) {
      return;
    }

    const nextVersionName = renameValue.trim();

    if (!nextVersionName) {
      setNotice({
        type: "error",
        message: "版本名称不能为空。",
      });
      return;
    }

    runWorkspaceMutation({
      action: "rename",
      endpoint: `/api/resumes/${workspace.resume.id}/versions/${selectedVersion.id}`,
      method: "PATCH",
      body: {
        versionName: nextVersionName,
      },
      successMessage: `已将版本重命名为 ${nextVersionName}。`,
      nextSelectedVersionId: selectedVersion.id,
    });
  }

  function handleDelete() {
    if (!selectedVersion) {
      return;
    }

    if (
      !window.confirm(
        `确认删除版本“${selectedVersion.versionName}”吗？相关诊断、JD 解析和导出记录也会一并移除。`,
      )
    ) {
      return;
    }

    runWorkspaceMutation({
      action: "delete",
      endpoint: `/api/resumes/${workspace.resume.id}/versions/${selectedVersion.id}`,
      method: "DELETE",
      successMessage: `已删除版本 ${selectedVersion.versionName}。`,
    });
  }

  if (!selectedVersion) {
    return (
      <SectionCard title="暂无版本">
        <p className="text-sm text-[color:var(--muted)]">当前还没有可浏览的简历版本。</p>
      </SectionCard>
    );
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

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-6">
          <SectionCard
            title="版本列表"
            description="点击任意版本后，右侧会展示预览、来源版本和结构化差异。"
          >
            <div className="space-y-3">
              {workspace.versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => {
                    setSelectedVersionId(version.id);

                    if (editingVersionId && editingVersionId !== version.id) {
                      cancelRename();
                    }
                  }}
                  className={cn(
                    "w-full text-left transition",
                    version.id === selectedVersion.id ? "" : "opacity-90 hover:opacity-100",
                  )}
                >
                  <ResumeVersionTimeline
                    versions={[version]}
                    currentVersionId={currentVersion?.id ?? null}
                  />
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="版本说明"
            description="复制、回滚、重命名和删除都围绕当前选中的版本执行。"
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
              <p>当前选中类型：{getVersionTypeLabel(selectedVersion.versionType)}</p>
              <p>当前最新版本：{currentVersion?.versionName ?? "暂无"}</p>
              <p>来源版本：{sourceVersion ? sourceVersion.versionName : "当前就是源版本"}</p>
              {selectedVersion.jobTargetTitle ? (
                <p>目标岗位：{selectedVersion.jobTargetTitle}</p>
              ) : null}
              {selectedVersion.jobTargetCompany ? (
                <p>目标公司：{selectedVersion.jobTargetCompany}</p>
              ) : null}
              <p>
                版本摘要：
                {selectedVersion.changeSummary?.generationSummary ?? "当前版本还没有额外说明。"}
              </p>
            </div>

            {isEditingSelectedVersion ? (
              <div className="mt-5 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">版本名称</span>
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    disabled={isPending}
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--brand)]"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRename}
                    disabled={isPending}
                    className="inline-flex rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingAction === "rename" ? "保存中..." : "保存新名称"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    disabled={isPending}
                    className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!canCopy}
                  className="inline-flex rounded-full border border-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-[color:var(--brand)] transition hover:bg-[color:var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "copy" ? "创建中..." : "创建副本"}
                </button>
                <button
                  type="button"
                  onClick={handleRollback}
                  disabled={!canRollback}
                  className="inline-flex rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "rollback"
                    ? "回滚中..."
                    : canRollback
                      ? "回滚为新版本"
                      : "当前版本无需回滚"}
                </button>
                <button
                  type="button"
                  onClick={startRename}
                  disabled={isPending}
                  className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  重命名
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete}
                  className="inline-flex rounded-full border border-[color:var(--error)] px-5 py-3 text-sm font-medium text-[color:var(--error)] transition hover:bg-[color:var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === "delete" ? "删除中..." : "删除版本"}
                </button>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="版本预览"
            description="预览直接基于 content_json 渲染，便于比较不同版本的落地效果。"
          >
            <ResumePreview content={selectedVersion.contentJson} />
          </SectionCard>

          <ResumeDiffView
            diffSections={diffSections}
            emptyMessage="当前选中的版本没有来源版本，或者与来源版本之间没有可展示的结构化差异。"
          />
        </div>
      </section>
    </div>
  );
}
