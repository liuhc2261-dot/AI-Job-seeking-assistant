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
  TextInput,
} from "@/features/profile/components/profile-form-primitives";
import type { EducationRecord, ProfileSnapshot } from "@/types/profile";

type EducationManagerProps = {
  items: EducationRecord[];
  onMutationSuccess: (snapshot: ProfileSnapshot, message: string) => void;
  onMutationError: (message: string) => void;
};

type EducationFormState = Omit<EducationRecord, "id">;

const emptyEducationForm: EducationFormState = {
  schoolName: "",
  major: "",
  degree: "",
  startDate: "",
  endDate: "",
  gpa: "",
  ranking: "",
};

export function EducationManager({
  items,
  onMutationSuccess,
  onMutationError,
}: EducationManagerProps) {
  const [form, setForm] = useState<EducationFormState>(emptyEducationForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isBusy = busyKey !== null;

  function resetForm() {
    setEditingId(null);
    setForm(emptyEducationForm);
  }

  function beginEdit(item: EducationRecord) {
    setEditingId(item.id);
    setForm({
      schoolName: item.schoolName,
      major: item.major,
      degree: item.degree,
      startDate: item.startDate,
      endDate: item.endDate,
      gpa: item.gpa,
      ranking: item.ranking,
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
      title="教育经历"
      description="至少补齐 1 条完整教育时间线，后续生成简历时会优先读取最近的教育经历。"
    >
      <div className="space-y-5">
        {items.length === 0 ? (
          <EmptyState
            title="还没有教育经历"
            description="请先补一条学校、专业、学历和时间范围完整的记录。"
          />
        ) : (
          <div className="space-y-3">
            {items.map((education) => (
              <div
                key={education.id}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{education.schoolName}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {education.degree} · {education.major}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">
                      {formatMonthRange(education.startDate, education.endDate)}
                    </p>
                    {education.gpa || education.ranking ? (
                      <p className="mt-2 text-sm text-[color:var(--muted)]">
                        {[education.gpa && `GPA ${education.gpa}`, education.ranking]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => beginEdit(education)}
                      disabled={isBusy}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (!window.confirm("确认删除这条教育经历吗？")) {
                          return;
                        }

                        void runMutation(
                          `delete-${education.id}`,
                          fetch(`/api/profile/educations/${education.id}`, {
                            method: "DELETE",
                          }),
                          "教育经历已删除。",
                          editingId === education.id,
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
                isEditing
                  ? `/api/profile/educations/${editingId}`
                  : "/api/profile/educations",
                {
                  method: isEditing ? "PUT" : "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(form),
                },
              ),
              isEditing ? "教育经历已更新。" : "教育经历已新增。",
              true,
            );
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {editingId ? "编辑教育经历" : "新增教育经历"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                时间统一使用月粒度，格式由原生月份选择器保证。
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
            <FormField label="学校名称" required>
              <TextInput
                value={form.schoolName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    schoolName: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="专业" required>
              <TextInput
                value={form.major}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    major: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="学历" required>
              <TextInput
                value={form.degree}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    degree: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：本科 / 硕士"
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
            <FormField label="GPA">
              <TextInput
                value={form.gpa}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gpa: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：3.8/4.0"
              />
            </FormField>
            <FormField label="排名">
              <TextInput
                value={form.ranking}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ranking: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：前 10%"
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
                : "新增教育经历"}
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
