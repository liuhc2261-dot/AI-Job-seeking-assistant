"use client";

import { useEffect, useState } from "react";

import { SectionCard } from "@/components/section-card";
import {
  FormField,
  TextArea,
  TextInput,
  primaryButtonClassName,
  readApiPayload,
} from "@/features/profile/components/profile-form-primitives";
import type { BasicProfileRecord, ProfileSnapshot } from "@/types/profile";

type BasicProfileFormProps = {
  value: BasicProfileRecord;
  onMutationSuccess: (snapshot: ProfileSnapshot, message: string) => void;
  onMutationError: (message: string) => void;
};

export function BasicProfileForm({
  value,
  onMutationSuccess,
  onMutationError,
}: BasicProfileFormProps) {
  const [form, setForm] = useState<BasicProfileRecord>(value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(value);
  }, [value]);

  return (
    <SectionCard
      title="基本信息"
      description="保存后会作为后续 profile snapshot 的基线。联系邮箱允许与登录邮箱不同，用于投递和对外展示。"
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setIsSubmitting(true);

          void fetch("/api/profile", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
          })
            .then(readApiPayload)
            .then((snapshot) => {
              onMutationSuccess(snapshot, "基本信息已保存。");
            })
            .catch((error) => {
              onMutationError(
                error instanceof Error ? error.message : "保存失败，请稍后重试。",
              );
            })
            .finally(() => {
              setIsSubmitting(false);
            });
        }}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="姓名" required>
            <TextInput
              value={form.fullName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="例如：张三"
            />
          </FormField>
          <FormField label="联系电话" required>
            <TextInput
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="用于简历展示和联系"
            />
          </FormField>
          <FormField label="联系邮箱" required>
            <TextInput
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="example@email.com"
            />
          </FormField>
          <FormField label="目标岗位">
            <TextInput
              value={form.targetRole}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetRole: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="例如：前端开发实习生"
            />
          </FormField>
          <FormField label="所在城市">
            <TextInput
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="例如：杭州"
            />
          </FormField>
          <FormField label="个人主页">
            <TextInput
              value={form.homepageUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  homepageUrl: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="https://portfolio.example.com"
            />
          </FormField>
          <FormField label="GitHub">
            <TextInput
              value={form.githubUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  githubUrl: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="https://github.com/username"
            />
          </FormField>
        </div>

        <FormField
          label="个人概述"
          hint="建议只写事实性的方向、能力标签和求职意向，不急着写成最终简历文案。"
        >
          <TextArea
            value={form.summary}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                summary: event.target.value,
              }))
            }
            disabled={isSubmitting}
            placeholder="例如：计算机专业本科生，持续参与 Web 与 AI 应用方向项目，正在寻找前端 / AI 应用开发相关实习。"
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={primaryButtonClassName}
            disabled={isSubmitting}
          >
            {isSubmitting ? "保存中..." : "保存基本信息"}
          </button>
          <span className="text-sm text-[color:var(--muted)]">
            资料页刷新后会重新读取数据库内容。
          </span>
        </div>
      </form>
    </SectionCard>
  );
}
