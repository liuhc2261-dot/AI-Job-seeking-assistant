import { cn } from "@/lib/utils";

type SectionCardTone = "default" | "accent" | "subtle";

type SectionCardProps = {
  title?: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  tone?: SectionCardTone;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  eyebrow,
  className,
  tone = "default",
  children,
}: SectionCardProps) {
  const toneClassName =
    tone === "accent"
      ? "border-[color:var(--border-warm)] bg-[linear-gradient(180deg,rgba(201,100,66,0.08),rgba(255,252,247,0.96)_28%,rgba(255,252,247,0.98)_100%)]"
      : tone === "subtle"
        ? "border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(250,249,245,0.94))]"
        : "border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(250,249,245,0.98))]";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[30px] border p-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)] backdrop-blur",
        toneClassName,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,100,66,0.08),transparent_34%)]" />
      <div className="relative">
        {(eyebrow || title || description) && (
          <div className="mb-5 space-y-2">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--brand)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
