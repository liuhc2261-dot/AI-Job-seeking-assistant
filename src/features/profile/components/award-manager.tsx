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
  TextArea,
  TextInput,
} from "@/features/profile/components/profile-form-primitives";
import type { AwardRecord, ProfileSnapshot } from "@/types/profile";

type AwardManagerProps = {
  items: AwardRecord[];
  onMutationSuccess: (snapshot: ProfileSnapshot, message: string) => void;
  onMutationError: (message: string) => void;
};

type AwardFormState = Omit<AwardRecord, "id">;

const emptyAwardForm: AwardFormState = {
  title: "",
  issuer: "",
  awardDate: "",
  description: "",
};

export function AwardManager({
  items,
  onMutationSuccess,
  onMutationError,
}: AwardManagerProps) {
  const [form, setForm] = useState<AwardFormState>(emptyAwardForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const isBusy = busyKey !== null;

  function resetForm() {
    setEditingId(null);
    setForm(emptyAwardForm);
  }

  function beginEdit(item: AwardRecord) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      issuer: item.issuer,
      awardDate: item.awardDate,
      description: item.description,
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
      title="奖项与证书"
      description="这些内容不一定每次都出现在简历里，但提前沉淀下来，后续生成和导出时会更完整。"
    >
      <div className="space-y-5">
        {items.length === 0 ? (
          <EmptyState
            title="还没有奖项或证书"
            description="竞赛奖项、荣誉称号、资格证书都可以记录在这里，后续由版本和模板决定是否展示。"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((award) => (
              <div
                key={award.id}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{award.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {[award.issuer, award.awardDate].filter(Boolean).join(" 路 ")}
                    </p>
                    {award.description ? (
                      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                        {award.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => beginEdit(award)}
                      disabled={isBusy}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (!window.confirm("确认删除这条奖项记录吗？")) {
                          return;
                        }

                        void runMutation(
                          `delete-${award.id}`,
                          fetch(`/api/profile/awards/${award.id}`, {
                            method: "DELETE",
                          }),
                          "奖项记录已删除。",
                          editingId === award.id,
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
                isEditing ? `/api/profile/awards/${editingId}` : "/api/profile/awards",
                {
                  method: isEditing ? "PUT" : "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(form),
                },
              ),
              isEditing ? "奖项记录已更新。" : "奖项记录已新增。",
              true,
            );
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {editingId ? "编辑奖项记录" : "新增奖项记录"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                奖项日期是可选项，先保证标题、来源和可验证信息准确即可。
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
            <FormField label="奖项名称" required>
              <TextInput
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField label="颁发方">
              <TextInput
                value={form.issuer}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    issuer: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="例如：学院 / 竞赛组委会"
              />
            </FormField>
            <FormField label="获奖时间">
              <TextInput
                type="month"
                value={form.awardDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    awardDate: event.target.value,
                  }))
                }
                disabled={isBusy}
              />
            </FormField>
          </div>

          <FormField label="补充说明">
            <TextArea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              disabled={isBusy}
              placeholder="补充奖项等级、名次、证书编号或与岗位相关的亮点。"
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
                : "新增奖项记录"}
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
