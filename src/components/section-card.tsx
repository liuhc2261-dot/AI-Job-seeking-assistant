import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  eyebrow,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_24px_80px_-48px_rgba(13,68,72,0.55)] backdrop-blur",
        className,
      )}
    >
      {(eyebrow || title || description) && (
        <div className="mb-5 space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
              {eyebrow}
            </p>
          ) : null}
          {title ? <h2 className="text-xl font-semibold">{title}</h2> : null}
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

