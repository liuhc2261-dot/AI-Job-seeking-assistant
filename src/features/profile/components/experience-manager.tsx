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
import type { ExperienceRecord, ProfileSnapshot } from "@/types/profile";

type ExperienceManagerProps = {
  items: ExperienceRecord[];
  onMutationSuccess: (snapshot: ProfileSnapshot, message: string) => void;
  onMutationError: (message: string) => void;
};

type ExperienceFormState = Omit<ExperienceRecord, "id">;

const emptyExperienceForm: ExperienceFormState = {
  companyName: "",
  jobTitle: "",
  startDate: "",
  endDate: "",
  descriptionRaw: "",
  resultRaw: "",
};

export function ExperienceManager({
  items,
  onMutationSuccess,
  onMutationError,
}: ExperienceManagerProps) {
  const [form, setForm] = useState<ExperienceFormState>(emptyExperienceForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isBusy = busyKey !== null;

  function resetForm() {
    setEditingId(null);
    setForm(emptyExperienceForm);
  }

  function beginEdit(item: ExperienceRecord) {
    setEditingId(item.id);
    setForm({
      companyName: item.companyName,
      jobTitle: item.jobTitle,
      startDate: item.startDate,
      endDate: item.endDate,
      descriptionRaw: item.descriptionRaw,
      resultRaw: item.resultRaw,
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
      title="实习经历"
      description="把真实的公司、岗位、职责和结果先沉淀下来，后续母版生成和 JD 优化才能正确复用。"
    >
      <div className="space-y-5">
        {items.length === 0 ? (
          <EmptyState
            title="还没有实习经历"
            description="如果你有实习、兼职或校内岗位经历，建议在这里单独沉淀，避免和项目经历混在一起。"
          />
        ) : (
          <div className="space-y-3">
            {items.map((experience) => (
              <div
                key={experience.id}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-lg font-semibold">{experience.companyName}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {experience.jobTitle} 路{" "}
                      {formatMonthRange(experience.startDate, experience.endDate)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                      {experience.descriptionRaw}
                    </p>
                    {experience.resultRaw ? (
                      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                        结果补充：{experience.resultRaw}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => beginEdit(experience)}
                      disabled={isBusy}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (!window.confirm("确认删除这条实习经历吗？")) {
                          return;
                        }

                        void runMutation(
                          `delete-${experience.id}`,
                          fetch(`/api/profile/experiences/${experience.id}`, {
                            method: "DELETE",
                          }),
                          "实习经历已删除。",
                          editingId === experience.id,
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
                  ? `/api/profile/experiences/${editingId}`
                  : "/api/profile/experiences",
                {
                  method: isEditing ? "PUT" : "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(form),
                },
              ),
              isEditing ? "实习经历已更新。" : "实习经历已新增。",
              true,
            );
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {editingId ? "编辑实习经历" : "新增实习经历"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                先录事实，再让后续 AI 做表达优化，不要一开始就压缩成简历口吻。
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="公司名称" required>
              <TextInput
                value={form.companyName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    companyName: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="岗位名称" required>
              <TextInput
                value={form.jobTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    jobTitle: event.target.value,
                  }))
                }
                disabled={isBusy}
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
          </div>

          <FormField label="工作内容" required>
            <TextArea
              value={form.descriptionRaw}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  descriptionRaw: event.target.value,
                }))
              }
              disabled={isBusy}
              placeholder="描述你负责的工作范围、协作对象、交付内容。"
            />
          </FormField>

          <FormField label="结果补充">
            <TextArea
              value={form.resultRaw}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resultRaw: event.target.value,
                }))
              }
              disabled={isBusy}
              placeholder="补充结果、指标、业务影响或被认可的证据。"
            />
          </FormField>

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
                : "新增实习经历"}
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
