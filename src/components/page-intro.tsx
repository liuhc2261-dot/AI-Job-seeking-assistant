import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: PageIntroProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[color:var(--border-strong)] bg-[linear-gradient(135deg,rgba(255,253,248,0.98),rgba(244,235,220,0.92))] p-6 shadow-[0_30px_100px_-58px_rgba(24,35,32,0.34)] sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,106,111,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(183,111,60,0.16),transparent_24%)]" />
      <div className="relative space-y-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--accent)]">
          {eyebrow}
        </p>
        <div className="space-y-3">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl lg:text-[2.7rem]">
            {title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-[color:var(--muted)]">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        {meta ? <div>{meta}</div> : null}
      </div>
    </section>
  );
}
