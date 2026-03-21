"use client";

import { useState } from "react";

import { SectionCard } from "@/components/section-card";
import {
  dangerButtonClassName,
  EmptyState,
  FormField,
  formatMonthRange,
  primaryButtonClassName,
  readApiPayload,
  secondaryButtonClassName,
  TextArea,
  TextInput,
} from "@/features/profile/components/profile-form-primitives";
import type { ProfileSnapshot, ProjectRecord } from "@/types/profile";

type ProjectManagerProps = {
  items: ProjectRecord[];
  onMutationSuccess: (snapshot: ProfileSnapshot, message: string) => void;
  onMutationError: (message: string) => void;
};

type ProjectFormState = Omit<ProjectRecord, "id">;

const emptyProjectForm: ProjectFormState = {
  name: "",
  role: "",
  startDate: "",
  endDate: "",
  descriptionRaw: "",
  techStack: "",
  contributionRaw: "",
  resultRaw: "",
  sourceType: "",
};

export function ProjectManager({
  items,
  onMutationSuccess,
  onMutationError,
}: ProjectManagerProps) {
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isBusy = busyKey !== null;

  function resetForm() {
    setEditingId(null);
    setForm(emptyProjectForm);
  }

  function beginEdit(item: ProjectRecord) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      role: item.role,
      startDate: item.startDate,
      endDate: item.endDate,
      descriptionRaw: item.descriptionRaw,
      techStack: item.techStack,
      contributionRaw: item.contributionRaw,
      resultRaw: item.resultRaw,
      sourceType: item.sourceType,
    });
  }

  async function runMutation(
    key: string,
    request: Promise<Response>,
    successMessage: string,
    shouldResetForm = false,
  ) {
    setBusyKey(key);

    try {
      const snapshot = await readApiPayload(await request);

      if (shouldResetForm) {
        resetForm();
      }

      onMutationSuccess(snapshot, successMessage);
    } catch (error) {
      onMutationError(
        error instanceof Error ? error.message : "操作失败，请稍后重试。",
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <SectionCard
      title="项目经历"
      description="这里优先保留原始事实，尤其是职责、成果和技术栈，后续 AI 才能做岗位导向改写。"
    >
      <div className="space-y-5">
        {items.length === 0 ? (
          <EmptyState
            title="还没有项目经历"
            description="课程项目、比赛、毕设、实训和个人项目都可以录入。"
          />
        ) : (
          <div className="space-y-3">
            {items.map((project) => (
              <div
                key={project.id}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-lg font-semibold">{project.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {project.role} · {formatMonthRange(project.startDate, project.endDate)}
                    </p>
                    {project.sourceType ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                        {project.sourceType}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                      {project.descriptionRaw}
                    </p>
                    {project.techStack ? (
                      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                        技术栈：{project.techStack}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => beginEdit(project)}
                      disabled={isBusy}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (!window.confirm("确认删除这条项目经历吗？")) {
                          return;
                        }

                        void runMutation(
                          `delete-${project.id}`,
                          fetch(`/api/profile/projects/${project.id}`, {
                            method: "DELETE",
                          }),
                          "项目经历已删除。",
                          editingId === project.id,
                        );
                      }}
                      disabled={isBusy}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          className="space-y-4 rounded-3xl border border-dashed border-[color:var(--border)] px-5 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            const isEditing = Boolean(editingId);

            void runMutation(
              isEditing ? `update-${editingId}` : "create",
              fetch(
                isEditing ? `/api/profile/projects/${editingId}` : "/api/profile/projects",
                {
                  method: isEditing ? "PUT" : "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(form),
                },
              ),
              isEditing ? "项目经历已更新。" : "项目经历已新增。",
              true,
            );
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {editingId ? "编辑项目经历" : "新增项目经历"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                先录原始描述，后续再由 AI 做岗位语言重写。
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={resetForm}
                disabled={isBusy}
              >
                取消编辑
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="项目名称" required>
              <TextInput
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="项目角色" required>
              <TextInput
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="项目来源">
              <TextInput
                value={form.sourceType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceType: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：课程项目 / 比赛 / 毕设"
              />
            </FormField>
            <FormField label="开始时间" required>
              <TextInput
                type="month"
                value={form.startDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="结束时间" required>
              <TextInput
                type="month"
                value={form.endDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="技术栈">
              <TextInput
                value={form.techStack}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    techStack: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：Next.js, Prisma, PostgreSQL"
              />
            </FormField>
          </div>

          <FormField label="项目描述" required>
            <TextArea
              value={form.descriptionRaw}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  descriptionRaw: event.target.value,
                }))
              }
              disabled={isBusy}
              placeholder="描述项目目标、场景和整体背景。"
            />
          </FormField>

          <div className="grid gap-4 xl:grid-cols-2">
            <FormField label="个人贡献">
              <TextArea
                value={form.contributionRaw}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contributionRaw: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="你具体负责了什么模块或工作。"
              />
            </FormField>
            <FormField label="项目成果">
              <TextArea
                value={form.resultRaw}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    resultRaw: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="结果、指标、落地效果、比赛名次等。"
              />
            </FormField>
          </div>

          <button
            type="submit"
            className={primaryButtonClassName}
            disabled={isBusy}
          >
            {editingId
              ? busyKey === `update-${editingId}`
                ? "保存中..."
                : "保存修改"
              : busyKey === "create"
                ? "新增中..."
                : "新增项目经历"}
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
