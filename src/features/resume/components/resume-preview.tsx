import type { ResumeContentJson } from "@/types/resume";

type ResumePreviewProps = {
  content: ResumeContentJson;
};

function renderRange(startDate: string, endDate: string) {
  return [startDate.trim(), endDate.trim()].filter(Boolean).join(" - ");
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-b border-[color:var(--border)] pb-2">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--accent)]">
        {title}
      </h3>
    </div>
  );
}

export function ResumePreview({ content }: ResumePreviewProps) {
  const contactItems = [
    content.basic.phone,
    content.basic.email,
    content.basic.city,
    content.basic.homepageUrl,
    content.basic.githubUrl,
  ].filter(Boolean);

  return (
    <article className="rounded-[28px] border border-[color:var(--border)] bg-white p-8 shadow-[0_24px_80px_-56px_rgba(13,68,72,0.65)]">
      <header className="border-b border-[color:var(--border)] pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {content.basic.name || "未命名简历"}
            </h2>
            {content.basic.targetRole ? (
              <p className="mt-2 text-sm font-medium text-[color:var(--accent)]">
                {content.basic.targetRole}
              </p>
            ) : null}
          </div>
          {contactItems.length > 0 ? (
            <div className="max-w-xl text-right text-sm leading-6 text-[color:var(--muted)]">
              {contactItems.join(" | ")}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mt-6 space-y-6 text-sm leading-6 text-slate-800">
        {content.summary ? (
          <section className="space-y-3">
            <SectionTitle title="个人简介" />
            <p>{content.summary}</p>
          </section>
        ) : null}

        {content.education.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle title="教育经历" />
            <div className="space-y-4">
              {content.education.map((education, index) => (
                <div key={`${education.school}-${index}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{education.school}</p>
                      <p className="text-[color:var(--muted)]">
                        {[education.major, education.degree].filter(Boolean).join(" | ")}
                      </p>
                    </div>
                    <p className="text-[color:var(--muted)]">
                      {renderRange(education.startDate, education.endDate)}
                    </p>
                  </div>
                  {education.highlights.length > 0 ? (
                    <ul className="space-y-1">
                      {education.highlights.map((highlight) => (
                        <li key={highlight}>• {highlight}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.projects.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle title="项目经历" />
            <div className="space-y-5">
              {content.projects.map((project, index) => (
                <div key={`${project.name}-${index}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-[color:var(--muted)]">{project.role}</p>
                    </div>
                    <p className="text-[color:var(--muted)]">
                      {renderRange(project.startDate, project.endDate)}
                    </p>
                  </div>
                  {project.techStack.length > 0 ? (
                    <p className="text-[color:var(--muted)]">
                      技术栈：{project.techStack.join(" / ")}
                    </p>
                  ) : null}
                  {project.bullets.length > 0 ? (
                    <ul className="space-y-1">
                      {project.bullets.map((bullet) => (
                        <li key={bullet}>• {bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.experiences.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle title="实习经历" />
            <div className="space-y-5">
              {content.experiences.map((experience, index) => (
                <div key={`${experience.company}-${index}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{experience.company}</p>
                      <p className="text-[color:var(--muted)]">{experience.role}</p>
                    </div>
                    <p className="text-[color:var(--muted)]">
                      {renderRange(experience.startDate, experience.endDate)}
                    </p>
                  </div>
                  {experience.bullets.length > 0 ? (
                    <ul className="space-y-1">
                      {experience.bullets.map((bullet) => (
                        <li key={bullet}>• {bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {content.skills.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle title="技能清单" />
            <div className="space-y-2">
              {content.skills.map((group, index) => (
                <p key={`${group.category}-${index}`}>
                  <span className="font-semibold">{group.category}：</span>
                  {group.items.join("、")}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {content.awards.length > 0 ? (
          <section className="space-y-3">
            <SectionTitle title="奖项与证书" />
            <div className="space-y-3">
              {content.awards.map((award, index) => (
                <div key={`${award.title}-${index}`} className="space-y-1">
                  <p className="font-semibold">
                    {[award.title, award.issuer].filter(Boolean).join(" | ")}
                  </p>
                  {award.awardDate ? (
                    <p className="text-[color:var(--muted)]">{award.awardDate}</p>
                  ) : null}
                  {award.description ? <p>{award.description}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
