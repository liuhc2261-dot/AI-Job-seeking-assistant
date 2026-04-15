"use client";

import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { SectionCard } from "@/components/section-card";
import {
  createAwardItem,
  createEducationItem,
  createExperienceItem,
  createProjectItem,
  createSkillGroup,
  formatResumeDate,
} from "@/lib/resume-document";
import { cn } from "@/lib/utils";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import type {
  ResumeContentJson,
  ResumeVersionRecord,
  ResumeWorkspace,
} from "@/types/resume";

type RewriteStyle = "concise" | "quantitative" | "professional";

type ParagraphRewriteState = {
  isOpen: boolean;
  originalText: string;
  rewrittenText: string;
  context: string;
  rewriteStyle: RewriteStyle;
  changeType: "improved" | "polished" | "unchanged" | null;
  explanation: string;
  sectionType: "project" | "experience" | null;
  sectionIndex: number | null;
  bulletIndex: number | null;
};

type ResumeEditorProps = {
  resumeId: string;
  initialVersion: ResumeVersionRecord;
};

type EditorNotice =
  | {
      type: "success" | "error";
      message: string;
    }
  | null;

type ResumeWorkspaceResponse =
  | {
      success: true;
      data: ResumeWorkspace;
    }
  | {
      success: false;
      error: {
        message: string;
      };
    };

type RewriteApiResponse =
  | {
      success: true;
      data: {
        rewrittenText: string;
        changeType: "improved" | "polished" | "unchanged";
        explanation: string;
        meta: {
          provider: string;
          model: string;
          usedFallback: boolean;
        };
      };
    }
  | {
      success: false;
      error: {
        message: string;
      };
    };

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft-strong)]";

const textareaClassName =
  "w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft-strong)]";

const secondaryButtonClassName =
  "inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]";

const removeButtonClassName =
  "text-sm font-medium text-[color:var(--error)] transition hover:text-[color:var(--error)]";

function replaceAtIndex<T>(items: T[], index: number, nextValue: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextValue : item));
}

function removeAtIndex<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitTags(value: string) {
  return value
    .split(/[、,，/]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-white/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{hint}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-medium text-slate-800">{children}</span>;
}

export function ResumeEditor({ resumeId, initialVersion }: ResumeEditorProps) {
  const router = useRouter();
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [draft, setDraft] = useState<ResumeContentJson>(initialVersion.contentJson);
  const deferredDraft = useDeferredValue(draft);
  const [notice, setNotice] = useState<EditorNotice>(null);
  const [isPending, startTransition] = useTransition();
  const [rewriteState, setRewriteState] = useState<ParagraphRewriteState>({
    isOpen: false,
    originalText: "",
    rewrittenText: "",
    context: "",
    rewriteStyle: "concise",
    changeType: null,
    explanation: "",
    sectionType: null,
    sectionIndex: null,
    bulletIndex: null,
  });
  const [isRewriting, startRewriteTransition] = useTransition();

  const contentStats = useMemo(
    () => [
      {
        label: "教育",
        value: `${draft.education.length}`,
        hint: "学校、专业、时间和亮点建议保持完整。",
      },
      {
        label: "项目",
        value: `${draft.projects.length}`,
        hint: "优先保留最能证明岗位能力的项目。",
      },
      {
        label: "实习",
        value: `${draft.experiences.length}`,
        hint: "没有实习也可以用校园职责或社团项目补足。",
      },
      {
        label: "技能组",
        value: `${draft.skills.length}`,
        hint: "按语言、工具、框架分组会更好读。",
      },
    ],
    [draft.education.length, draft.experiences.length, draft.projects.length, draft.skills.length],
  );

  const openRewriteModal = useCallback(
    (
      sectionType: "project" | "experience",
      sectionIndex: number,
      bulletIndex: number,
      originalText: string,
      context: string,
    ) => {
      setRewriteState({
        isOpen: true,
        originalText,
        rewrittenText: "",
        context,
        rewriteStyle: "concise",
        changeType: null,
        explanation: "",
        sectionType,
        sectionIndex,
        bulletIndex,
      });
    },
    [],
  );

  const closeRewriteModal = useCallback(() => {
    setRewriteState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const handleRewrite = useCallback(() => {
    if (!rewriteState.originalText.trim()) {
      return;
    }

    startRewriteTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/resumes/${resumeId}/versions/${currentVersion.id}/rewrite-paragraph`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sectionType: rewriteState.sectionType,
                sectionIndex: rewriteState.sectionIndex,
                bulletIndex: rewriteState.bulletIndex,
                originalText: rewriteState.originalText,
                context: rewriteState.context,
                rewriteStyle: rewriteState.rewriteStyle,
              }),
            },
          );
          const payload = (await response.json()) as RewriteApiResponse;

          if (!payload.success) {
            setNotice({
              type: "error",
              message: payload.error.message,
            });
            return;
          }

          setRewriteState((prev) => ({
            ...prev,
            rewrittenText: payload.data.rewrittenText,
            changeType: payload.data.changeType,
            explanation: payload.data.explanation,
          }));
        } catch {
          setNotice({
            type: "error",
            message: "改写失败，请稍后重试。",
          });
        }
      })();
    });
  }, [rewriteState, resumeId, currentVersion.id]);

  const applyRewrite = useCallback(() => {
    if (!rewriteState.rewrittenText || rewriteState.sectionType === null) {
      return;
    }

    setDraft((prev) => {
      if (rewriteState.sectionType === "project" && rewriteState.sectionIndex !== null) {
        const project = prev.projects[rewriteState.sectionIndex];

        if (!project || rewriteState.bulletIndex === null) {
          return prev;
        }

        const newBullets = [...project.bullets];
        newBullets[rewriteState.bulletIndex] = rewriteState.rewrittenText;

        return {
          ...prev,
          projects: replaceAtIndex(prev.projects, rewriteState.sectionIndex, {
            ...project,
            bullets: newBullets,
          }),
        };
      }

      if (rewriteState.sectionType === "experience" && rewriteState.sectionIndex !== null) {
        const experience = prev.experiences[rewriteState.sectionIndex];

        if (!experience || rewriteState.bulletIndex === null) {
          return prev;
        }

        const newBullets = [...experience.bullets];
        newBullets[rewriteState.bulletIndex] = rewriteState.rewrittenText;

        return {
          ...prev,
          experiences: replaceAtIndex(prev.experiences, rewriteState.sectionIndex, {
            ...experience,
            bullets: newBullets,
          }),
        };
      }

      return prev;
    });

    closeRewriteModal();
    setNotice({
      type: "success",
      message: "已应用改写结果。保存后将生成新版本。",
    });
  }, [rewriteState, closeRewriteModal]);

  const saveDraft = useCallback(() => {
    startTransition(() => {
      void (async () => {
        setNotice(null);

        try {
          const response = await fetch(
            `/api/resumes/${resumeId}/versions/${currentVersion.id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contentJson: draft,
              }),
            },
          );
          const payload = (await response.json()) as ResumeWorkspaceResponse;

          if (!payload.success || !payload.data.currentVersion) {
            setNotice({
              type: "error",
              message: payload.success
                ? "保存失败，请稍后重试。"
                : payload.error.message,
            });
            return;
          }

          setCurrentVersion(payload.data.currentVersion);
          setDraft(payload.data.currentVersion.contentJson);
          setNotice({
            type: "success",
            message: "已保存为新的手动版本，原有版本链保持不变。",
          });
          router.refresh();
        } catch {
          setNotice({
            type: "error",
            message: "保存失败，请检查网络后重试。",
          });
        }
      })();
    });
  }, [draft, resumeId, currentVersion.id, router]);

  return (
    <>
      {rewriteState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">STAR 改写助手</h2>
              <button
                type="button"
                onClick={closeRewriteModal}
                className="text-sm text-[color:var(--muted)] transition hover:text-slate-900"
              >
                关闭
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  原文
                </label>
                <textarea
                  value={rewriteState.originalText}
                  onChange={(event) =>
                    setRewriteState((prev) => ({
                      ...prev,
                      originalText: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[color:var(--brand)]"
                  placeholder="输入你想要改写的段落..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  改写风格
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "concise", label: "更简洁" },
                      { value: "quantitative", label: "更量化" },
                      { value: "professional", label: "更专业" },
                    ] as const
                  ).map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() =>
                        setRewriteState((prev) => ({
                          ...prev,
                          rewriteStyle: style.value,
                        }))
                      }
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition",
                        rewriteState.rewriteStyle === style.value
                          ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                          : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--brand)]",
                      )}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleRewrite}
                disabled={!rewriteState.originalText.trim() || isRewriting}
                className="w-full rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRewriting ? "改写中..." : "改写"}
              </button>

              {rewriteState.rewrittenText && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      改写结果
                    </label>
                    <textarea
                      value={rewriteState.rewrittenText}
                      onChange={(event) =>
                        setRewriteState((prev) => ({
                          ...prev,
                          rewrittenText: event.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-2xl border border-[color:var(--brand)] bg-[color:var(--brand-soft)] px-4 py-3 text-sm leading-6 text-slate-900 outline-none"
                    />
                  </div>
                  {rewriteState.explanation && (
                    <p className="text-xs text-[color:var(--muted)]">
                      {rewriteState.explanation}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={applyRewrite}
                      className="flex-1 rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)]"
                    >
                      应用改写
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRewriteState((prev) => ({
                          ...prev,
                          rewrittenText: "",
                          changeType: null,
                          explanation: "",
                        }))
                      }
                      className="flex-1 rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--muted)] transition hover:border-[color:var(--brand)] hover:text-[color:var(--brand)]"
                    >
                      重新改写
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
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

        <SectionCard
          tone="accent"
          eyebrow="Editor"
          title="编辑工作台"
          description="左侧维护结构化内容，右侧实时查看简历排版。每次保存都会另存为新的 manual 版本，方便随时回退和比较。"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {contentStats.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                hint={item.hint}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-white/70 px-4 py-4">
            <div className="space-y-1 text-sm leading-6 text-[color:var(--muted)]">
              <p>当前编辑源版本：{currentVersion.versionName}</p>
              <p>最近更新时间：{formatResumeDate(currentVersion.updatedAt)}</p>
            </div>
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="inline-flex rounded-full bg-[color:var(--brand)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "正在保存..." : "保存为新版本"}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="基础信息"
          description="先把姓名、联系方式和目标岗位填完整，再去打磨项目与经历。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <FieldLabel>姓名</FieldLabel>
              <input
                value={draft.basic.name}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      name: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <FieldLabel>目标岗位</FieldLabel>
              <input
                value={draft.basic.targetRole ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      targetRole: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <FieldLabel>手机号</FieldLabel>
              <input
                value={draft.basic.phone}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      phone: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <FieldLabel>邮箱</FieldLabel>
              <input
                value={draft.basic.email}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      email: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <FieldLabel>城市</FieldLabel>
              <input
                value={draft.basic.city ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      city: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <FieldLabel>个人主页</FieldLabel>
              <input
                value={draft.basic.homepageUrl ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      homepageUrl: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <FieldLabel>GitHub / 作品集链接</FieldLabel>
              <input
                value={draft.basic.githubUrl ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    basic: {
                      ...prev.basic,
                      githubUrl: event.target.value,
                    },
                  }))
                }
                className={inputClassName}
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <FieldLabel>个人简介</FieldLabel>
            <textarea
              value={draft.summary}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  summary: event.target.value,
                }))
              }
              rows={5}
              className={textareaClassName}
              placeholder="用 2-4 句概括你的方向、能力与最有代表性的经历。"
            />
          </label>
        </SectionCard>

        <SectionCard
          title="教育经历"
          description="建议每段都写清学校、专业、时间范围，并补 1-3 条亮点。"
        >
          <div className="space-y-4">
            {draft.education.map((education, index) => (
              <div
                key={`${education.school}-${index}`}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={education.school}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        education: replaceAtIndex(prev.education, index, {
                          ...education,
                          school: event.target.value,
                        }),
                      }))
                    }
                    placeholder="学校"
                    className={inputClassName}
                  />
                  <input
                    value={education.major}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        education: replaceAtIndex(prev.education, index, {
                          ...education,
                          major: event.target.value,
                        }),
                      }))
                    }
                    placeholder="专业"
                    className={inputClassName}
                  />
                  <input
                    value={education.degree}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        education: replaceAtIndex(prev.education, index, {
                          ...education,
                          degree: event.target.value,
                        }),
                      }))
                    }
                    placeholder="学历"
                    className={inputClassName}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={education.startDate}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          education: replaceAtIndex(prev.education, index, {
                            ...education,
                            startDate: event.target.value,
                          }),
                        }))
                      }
                      placeholder="开始时间"
                      className={inputClassName}
                    />
                    <input
                      value={education.endDate}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          education: replaceAtIndex(prev.education, index, {
                            ...education,
                            endDate: event.target.value,
                          }),
                        }))
                      }
                      placeholder="结束时间"
                      className={inputClassName}
                    />
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={joinLines(education.highlights)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      education: replaceAtIndex(prev.education, index, {
                        ...education,
                        highlights: splitLines(event.target.value),
                      }),
                    }))
                  }
                  placeholder="教育亮点，每行一条"
                  className={`mt-4 ${textareaClassName}`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      education: removeAtIndex(prev.education, index),
                    }))
                  }
                  className={`mt-4 ${removeButtonClassName}`}
                >
                  删除这段教育经历
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  education: [...prev.education, createEducationItem()],
                }))
              }
              className={secondaryButtonClassName}
            >
              新增教育经历
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="项目经历"
          description="优先写清你的角色、技术栈和结果导向的贡献。"
        >
          <div className="space-y-4">
            {draft.projects.map((project, index) => (
              <div
                key={`${project.name}-${index}`}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    value={project.name}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        projects: replaceAtIndex(prev.projects, index, {
                          ...project,
                          name: event.target.value,
                        }),
                      }))
                    }
                    placeholder="项目名称"
                    className={inputClassName}
                  />
                  <input
                    value={project.role}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        projects: replaceAtIndex(prev.projects, index, {
                          ...project,
                          role: event.target.value,
                        }),
                      }))
                    }
                    placeholder="角色"
                    className={inputClassName}
                  />
                  <input
                    value={project.startDate}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        projects: replaceAtIndex(prev.projects, index, {
                          ...project,
                          startDate: event.target.value,
                        }),
                      }))
                    }
                    placeholder="开始时间"
                    className={inputClassName}
                  />
                  <input
                    value={project.endDate}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        projects: replaceAtIndex(prev.projects, index, {
                          ...project,
                          endDate: event.target.value,
                        }),
                      }))
                    }
                    placeholder="结束时间"
                    className={inputClassName}
                  />
                </div>

                <input
                  value={project.techStack.join("、")}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      projects: replaceAtIndex(prev.projects, index, {
                        ...project,
                        techStack: splitTags(event.target.value),
                      }),
                    }))
                  }
                  placeholder="技术栈，用顿号、逗号或斜杠分隔"
                  className={`mt-4 ${inputClassName}`}
                />

                <textarea
                  rows={5}
                  value={joinLines(project.bullets)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      projects: replaceAtIndex(prev.projects, index, {
                        ...project,
                        bullets: splitLines(event.target.value),
                      }),
                    }))
                  }
                  placeholder="项目要点，每行一条"
                  className={`mt-4 ${textareaClassName}`}
                />

                {project.bullets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.bullets.map((bullet, bulletIndex) => (
                      <button
                        key={`${bullet}-${bulletIndex}`}
                        type="button"
                        onClick={() =>
                          openRewriteModal(
                            "project",
                            index,
                            bulletIndex,
                            bullet,
                            `${project.name} - ${project.role}`,
                          )
                        }
                        className="inline-flex rounded-full border border-[color:var(--brand)] bg-[color:var(--brand-soft)] px-3 py-1 text-xs font-medium text-[color:var(--brand)] transition hover:bg-[color:var(--brand)] hover:text-white"
                      >
                        改写第 {bulletIndex + 1} 条
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      projects: removeAtIndex(prev.projects, index),
                    }))
                  }
                  className={`mt-4 ${removeButtonClassName}`}
                >
                  删除这段项目经历
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  projects: [...prev.projects, createProjectItem()],
                }))
              }
              className={secondaryButtonClassName}
            >
              新增项目经历
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="技能清单"
          description="建议按语言、框架、工具、设计或数据分析等类别分组。"
        >
          <div className="space-y-4">
            {draft.skills.map((group, index) => (
              <div
                key={`${group.category}-${index}`}
                className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"
              >
                <input
                  value={group.category}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      skills: replaceAtIndex(prev.skills, index, {
                        ...group,
                        category: event.target.value,
                      }),
                    }))
                  }
                  placeholder="技能分类"
                  className={inputClassName}
                />
                <input
                  value={group.items.join("、")}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      skills: replaceAtIndex(prev.skills, index, {
                        ...group,
                        items: splitTags(event.target.value),
                      }),
                    }))
                  }
                  placeholder="技能项，用顿号、逗号或斜杠分隔"
                  className={`mt-4 ${inputClassName}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      skills: removeAtIndex(prev.skills, index),
                    }))
                  }
                  className={`mt-4 ${removeButtonClassName}`}
                >
                  删除这一组技能
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  skills: [...prev.skills, createSkillGroup()],
                }))
              }
              className={secondaryButtonClassName}
            >
              新增技能分组
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="补充模块"
          description="这里适合补充实习经历、奖项证书等可选内容，让版本更完整。"
        >
          <div className="grid gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="font-medium text-slate-900">实习经历</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      experiences: [...prev.experiences, createExperienceItem()],
                    }))
                  }
                  className="text-sm font-medium text-[color:var(--brand)]"
                >
                  新增
                </button>
              </div>
              <div className="space-y-4">
                {draft.experiences.map((experience, index) => (
                  <div
                    key={`${experience.company}-${index}`}
                    className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        value={experience.company}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            experiences: replaceAtIndex(prev.experiences, index, {
                              ...experience,
                              company: event.target.value,
                            }),
                          }))
                        }
                        placeholder="公司名称"
                        className={inputClassName}
                      />
                      <input
                        value={experience.role}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            experiences: replaceAtIndex(prev.experiences, index, {
                              ...experience,
                              role: event.target.value,
                            }),
                          }))
                        }
                        placeholder="岗位名称"
                        className={inputClassName}
                      />
                      <input
                        value={experience.startDate}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            experiences: replaceAtIndex(prev.experiences, index, {
                              ...experience,
                              startDate: event.target.value,
                            }),
                          }))
                        }
                        placeholder="开始时间"
                        className={inputClassName}
                      />
                      <input
                        value={experience.endDate}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            experiences: replaceAtIndex(prev.experiences, index, {
                              ...experience,
                              endDate: event.target.value,
                            }),
                          }))
                        }
                        placeholder="结束时间"
                        className={inputClassName}
                      />
                    </div>
                    <textarea
                      rows={4}
                      value={joinLines(experience.bullets)}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          experiences: replaceAtIndex(prev.experiences, index, {
                            ...experience,
                            bullets: splitLines(event.target.value),
                          }),
                        }))
                      }
                      placeholder="工作要点，每行一条"
                      className={`mt-4 ${textareaClassName}`}
                    />

                    {experience.bullets.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {experience.bullets.map((bullet, bulletIndex) => (
                          <button
                            key={`${bullet}-${bulletIndex}`}
                            type="button"
                            onClick={() =>
                              openRewriteModal(
                                "experience",
                                index,
                                bulletIndex,
                                bullet,
                                `${experience.company} - ${experience.role}`,
                              )
                            }
                            className="inline-flex rounded-full border border-[color:var(--brand)] bg-[color:var(--brand-soft)] px-3 py-1 text-xs font-medium text-[color:var(--brand)] transition hover:bg-[color:var(--brand)] hover:text-white"
                          >
                            改写第 {bulletIndex + 1} 条
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          experiences: removeAtIndex(prev.experiences, index),
                        }))
                      }
                      className={`mt-4 ${removeButtonClassName}`}
                    >
                      删除这段实习经历
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="font-medium text-slate-900">奖项与证书</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      awards: [...prev.awards, createAwardItem()],
                    }))
                  }
                  className="text-sm font-medium text-[color:var(--brand)]"
                >
                  新增
                </button>
              </div>
              <div className="space-y-4">
                {draft.awards.map((award, index) => (
                  <div
                    key={`${award.title}-${index}`}
                    className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        value={award.title}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            awards: replaceAtIndex(prev.awards, index, {
                              ...award,
                              title: event.target.value,
                            }),
                          }))
                        }
                        placeholder="奖项名称"
                        className={inputClassName}
                      />
                      <input
                        value={award.issuer ?? ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            awards: replaceAtIndex(prev.awards, index, {
                              ...award,
                              issuer: event.target.value,
                            }),
                          }))
                        }
                        placeholder="颁发方"
                        className={inputClassName}
                      />
                      <input
                        value={award.awardDate ?? ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            awards: replaceAtIndex(prev.awards, index, {
                              ...award,
                              awardDate: event.target.value,
                            }),
                          }))
                        }
                        placeholder="获奖时间"
                        className={`${inputClassName} md:col-span-2`}
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={award.description ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          awards: replaceAtIndex(prev.awards, index, {
                            ...award,
                            description: event.target.value,
                          }),
                        }))
                      }
                      placeholder="补充说明"
                      className={`mt-4 ${textareaClassName}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          awards: removeAtIndex(prev.awards, index),
                        }))
                      }
                      className={`mt-4 ${removeButtonClassName}`}
                    >
                      删除这条奖项或证书
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <SectionCard
          tone="subtle"
          title="编辑原则"
          description="先保证信息真实，再优化表达。这里的保存只会生成新版本，不会覆盖你的母版。"
        >
          <div className="space-y-3 text-sm leading-6 text-[color:var(--muted)]">
            <p>联系方式与目标岗位决定阅读入口，建议优先确认。</p>
            <p>项目和实习要尽量写出动作、方法和结果，避免空泛描述。</p>
            <p>技能清单建议按类别组织，避免长串堆叠。</p>
          </div>
        </SectionCard>

        <SectionCard
          title="实时预览"
          description="右侧预览直接基于 content_json 渲染，保存后会同步生成 Markdown。"
        >
          <ResumePreview content={deferredDraft} />
        </SectionCard>

        <SectionCard
          title="版本备注"
          description="这里展示当前版本的生成摘要和风险提醒，方便继续编辑时对齐边界。"
        >
          {currentVersion.changeSummary?.generationSummary ? (
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {currentVersion.changeSummary.generationSummary}
            </p>
          ) : (
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              当前版本还没有额外备注。
            </p>
          )}

          {currentVersion.changeSummary?.warnings &&
          currentVersion.changeSummary.warnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
              {currentVersion.changeSummary.warnings.map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
    </>
  );
}
