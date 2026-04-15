import { formatResumeDate } from "@/lib/resume-document";
import { cn } from "@/lib/utils";
import type { ResumeVersionRecord } from "@/types/resume";

type ResumeVersionTimelineProps = {
  versions: ResumeVersionRecord[];
  currentVersionId?: string | null;
};

function getVersionTypeLabel(type: ResumeVersionRecord["versionType"]) {
  switch (type) {
    case "master":
      return "母版";
    case "manual":
      return "手动编辑";
    case "job_targeted":
      return "岗位版本";
    case "ai_rewrite":
      return "诊断应用";
    default:
      return type;
  }
}

function getCreatedByLabel(type: ResumeVersionRecord["createdBy"]) {
  switch (type) {
    case "manual":
      return "人工保存";
    case "ai_generate":
      return "AI 生成";
    case "ai_optimize":
      return "AI 定制";
    case "ai_diagnose_apply":
      return "应用诊断建议";
    default:
      return type;
  }
}

export function ResumeVersionTimeline({
  versions,
  currentVersionId,
}: ResumeVersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-5 py-5 text-sm text-[color:var(--muted)]">
        还没有可展示的版本记录。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => (
        <div
          key={version.id}
          className={cn(
            "rounded-[26px] border px-4 py-4 transition",
            version.id === currentVersionId
              ? "border-[color:var(--brand-soft-strong)] bg-[linear-gradient(180deg,rgba(201,100,66,0.14),rgba(255,255,255,0.9))] shadow-[0_20px_44px_-34px_rgba(201,100,66,0.7)]"
              : "border-[color:var(--border)] bg-white/76",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[color:var(--foreground)]">
                {version.versionName}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {getCreatedByLabel(version.createdBy)} · {formatResumeDate(version.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[color:var(--brand)]">
                {getVersionTypeLabel(version.versionType)}
              </span>
              {version.id === currentVersionId ? (
                <span className="rounded-full bg-[color:var(--brand)] px-3 py-1 text-xs font-semibold text-white">
                  当前版本
                </span>
              ) : null}
            </div>
          </div>
          {version.changeSummary?.generationSummary ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {version.changeSummary.generationSummary}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
