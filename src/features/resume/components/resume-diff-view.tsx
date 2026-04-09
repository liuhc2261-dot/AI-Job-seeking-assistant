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
    <div className="space-y-2 text-sm leading-6 text-[color:var(--foreground)]">
      {lines.map((line, index) => (
        <p key={`${line}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

export function ResumeDiffView({
  title = "改动差异",
  description = "这里只展示和来源版本相比发生变化的模块，帮助确认本次编辑、优化或诊断应用有没有越过真实边界。",
  emptyMessage = "当前版本和来源版本之间还没有可展示的结构化差异。",
  diffSections,
}: ResumeDiffViewProps) {
  return (
    <SectionCard title={title} description={description}>
      {diffSections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-5 py-7 text-sm leading-6 text-[color:var(--muted)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {diffSections.map((section) => (
            <div
              key={section.id}
              className="rounded-[28px] border border-[color:var(--border)] bg-white/78 p-5 shadow-[0_18px_40px_-34px_rgba(24,35,32,0.22)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[color:var(--foreground)]">
                    {section.title}
                  </p>
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
                <div className="rounded-3xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                    来源版本
                  </p>
                  <div className="mt-3">
                    {renderLines(section.before, "这一块在来源版本里为空。")}
                  </div>
                </div>
                <div className="rounded-3xl border border-[color:var(--accent-soft-strong)] bg-[linear-gradient(180deg,rgba(15,106,111,0.1),rgba(255,255,255,0.88))] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
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
