"use client";

import { useDeferredValue, useState, useTransition } from "react";
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
import type {
  ResumeContentJson,
  ResumeVersionRecord,
  ResumeWorkspace,
} from "@/types/resume";
import { ResumePreview } from "@/features/resume/components/resume-preview";

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

export function ResumeEditor({ resumeId, initialVersion }: ResumeEditorProps) {
  const router = useRouter();
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [draft, setDraft] = useState<ResumeContentJson>(initialVersion.contentJson);
  const deferredDraft = useDeferredValue(draft);
  const [notice, setNotice] = useState<EditorNotice>(null);
  const [isPending, startTransition] = useTransition();

  function saveDraft() {
    startTransition(() => {
      void (async () => {
        setNotice(null);

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
          message: "已保存为新的手动版本，母版历史没有被覆盖。",
        });
        router.refresh();
      })();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
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

        <SectionCard
          title="编辑说明"
          description="这里保存时不会直接覆盖当前版本，而是新增一个 manual 版本，便于后续回滚和对比。"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 text-sm text-[color:var(--muted)]">
              <p>当前编辑源版本：{currentVersion.versionName}</p>
              <p>生成时间：{formatResumeDate(currentVersion.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="inline-flex rounded-full bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "保存中..." : "保存为新版本"}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="基本信息" description="建议先确认姓名、联系方式和目标岗位。">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">姓名</span>
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">目标岗位</span>
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">电话</span>
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">邮箱</span>
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">城市</span>
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">个人主页</span>
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
                className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium">个人简介</span>
            <textarea
              value={draft.summary}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  summary: event.target.value,
                }))
              }
              rows={5}
              className="w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-3"
            />
          </label>
        </SectionCard>

        <SectionCard title="教育经历">
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                      className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                  placeholder="补充亮点，每行一条"
                  className="mt-4 w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-3"
                />

                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      education: removeAtIndex(prev.education, index),
                    }))
                  }
                  className="mt-4 text-sm font-medium text-rose-600"
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
              className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)]"
            >
              新增教育经历
            </button>
          </div>
        </SectionCard>

        <SectionCard title="项目经历">
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                  placeholder="技术栈，用逗号分隔"
                  className="mt-4 w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                  className="mt-4 w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-3"
                />

                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      projects: removeAtIndex(prev.projects, index),
                    }))
                  }
                  className="mt-4 text-sm font-medium text-rose-600"
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
              className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)]"
            >
              新增项目经历
            </button>
          </div>
        </SectionCard>

        <SectionCard title="技能清单">
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
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                  placeholder="技能项，用逗号分隔"
                  className="mt-4 w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      skills: removeAtIndex(prev.skills, index),
                    }))
                  }
                  className="mt-4 text-sm font-medium text-rose-600"
                >
                  删除这组技能
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
              className="inline-flex rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)]"
            >
              新增技能分组
            </button>
          </div>
        </SectionCard>

        <SectionCard title="可选模块">
          <div className="grid gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="font-medium">实习经历</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      experiences: [...prev.experiences, createExperienceItem()],
                    }))
                  }
                  className="text-sm font-medium text-[color:var(--accent)]"
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
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                      className="mt-4 w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-3"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 className="font-medium">奖项与证书</h3>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      awards: [...prev.awards, createAwardItem()],
                    }))
                  }
                  className="text-sm font-medium text-[color:var(--accent)]"
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
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                        className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3"
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
                      className="mt-4 w-full rounded-3xl border border-[color:var(--border)] bg-white px-4 py-3"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <SectionCard
          title="实时预览"
          description="右侧预览直接基于 content_json 渲染，保存时会同步生成 Markdown。"
        >
          <ResumePreview content={deferredDraft} />
        </SectionCard>

        <SectionCard title="版本备注">
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
  );
}
