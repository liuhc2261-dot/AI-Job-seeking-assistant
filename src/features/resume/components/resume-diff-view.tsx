import { SectionCard } from "@/components/section-card";
import { cn } from "@/lib/utils";
import type { ResumeDiffSection } from "@/types/jd";

type ResumeDiffViewProps = {
  title?: string;
  description?: string;
  emptyMessage?: string;
  diffSections: ResumeDiffSection[];
};

function getSectionLabel(section: ResumeDiffSection["section"]) {
  switch (section) {
    case "basic":
      return "基础信息";
    case "summary":
      return "个人简介";
    case "education":
      return "教育经历";
    case "projects":
      return "项目经历";
    case "experiences":
      return "实习经历";
    case "skills":
      return "技能清单";
    case "awards":
      return "奖项与证书";
    default:
      return section;
  }
}

function getChangeLabel(changeKind: ResumeDiffSection["changeKind"]) {
  switch (changeKind) {
    case "added":
      return "新增";
    case "removed":
      return "移除";
    case "updated":
      return "改写";
    default:
      return changeKind;
  }
}

function renderLines(lines: string[], emptyText: string) {
  if (lines.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-slate-800">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

export function ResumeDiffView({
  title = "改动差异",
  description = "仅展示与来源版本存在变化的模块，帮助快速确认岗位定制是否越界。",
  emptyMessage = "当前版本与来源版本之间还没有结构化差异可展示。",
  diffSections,
}: ResumeDiffViewProps) {
  return (
    <SectionCard title={title} description={description}>
      {diffSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm leading-6 text-[color:var(--muted)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {diffSections.map((section) => (
            <div
              key={section.id}
              className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{section.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {getSectionLabel(section.section)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    section.changeKind === "updated"
                      ? "bg-amber-50 text-amber-700"
                      : section.changeKind === "added"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700",
                  )}
                >
                  {getChangeLabel(section.changeKind)}
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    原版本
                  </p>
                  <div className="mt-3">
                    {renderLines(section.before, "这一块在来源版本里为空。")}
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                    当前版本
                  </p>
                  <div className="mt-3">
                    {renderLines(section.after, "这一块在当前版本里为空。")}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
