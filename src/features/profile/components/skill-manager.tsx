"use client";

import { useState } from "react";

import { SectionCard } from "@/components/section-card";
import {
  dangerButtonClassName,
  EmptyState,
  FormField,
  primaryButtonClassName,
  readApiPayload,
  secondaryButtonClassName,
  TextInput,
} from "@/features/profile/components/profile-form-primitives";
import type { ProfileSnapshot, SkillRecord } from "@/types/profile";

type SkillManagerProps = {
  items: SkillRecord[];
  onMutationSuccess: (snapshot: ProfileSnapshot, message: string) => void;
  onMutationError: (message: string) => void;
};

type SkillFormState = Omit<SkillRecord, "id">;

const emptySkillForm: SkillFormState = {
  category: "",
  name: "",
  level: "",
};

export function SkillManager({
  items,
  onMutationSuccess,
  onMutationError,
}: SkillManagerProps) {
  const [form, setForm] = useState<SkillFormState>(emptySkillForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isBusy = busyKey !== null;

  function resetForm() {
    setEditingId(null);
    setForm(emptySkillForm);
  }

  function beginEdit(item: SkillRecord) {
    setEditingId(item.id);
    setForm({
      category: item.category,
      name: item.name,
      level: item.level,
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
      title="技能清单"
      description="技能尽量用可检索、可对齐 JD 的标签表达，避免泛泛而谈。"
    >
      <div className="space-y-5">
        {items.length === 0 ? (
          <EmptyState
            title="还没有技能记录"
            description="建议按编程语言、框架、工具、数据分析等分类录入。"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((skill) => (
              <div
                key={skill.id}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{skill.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {skill.category}
                      {skill.level ? ` · ${skill.level}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => beginEdit(skill)}
                      disabled={isBusy}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (!window.confirm("确认删除这条技能记录吗？")) {
                          return;
                        }

                        void runMutation(
                          `delete-${skill.id}`,
                          fetch(`/api/profile/skills/${skill.id}`, {
                            method: "DELETE",
                          }),
                          "技能记录已删除。",
                          editingId === skill.id,
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
              fetch(isEditing ? `/api/profile/skills/${editingId}` : "/api/profile/skills", {
                method: isEditing ? "PUT" : "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
              }),
              isEditing ? "技能记录已更新。" : "技能记录已新增。",
              true,
            );
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {editingId ? "编辑技能记录" : "新增技能记录"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                尽量使用招聘 JD 中常见的标准名词，方便后续关键词对齐。
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

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="技能分类" required>
              <TextInput
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：语言 / 框架 / 工具"
              />
            </FormField>
            <FormField label="技能名称" required>
              <TextInput
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：TypeScript"
              />
            </FormField>
            <FormField label="熟练程度">
              <TextInput
                value={form.level}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    level: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：熟悉 / 熟练"
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
                : "新增技能记录"}
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
