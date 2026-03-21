type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
        {eyebrow}
      </p>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-3xl text-base leading-7 text-[color:var(--muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

