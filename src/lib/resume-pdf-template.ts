import type { ResumeContentJson } from "@/types/resume";

type RenderResumePdfHtmlInput = {
  content: ResumeContentJson;
  templateName: string;
};

function escapeHtml(value: string | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function renderDateRange(startDate: string, endDate: string) {
  return [cleanValue(startDate), cleanValue(endDate)].filter(Boolean).join(" - ");
}

function renderBulletList(items: string[]) {
  const normalizedItems = items.map((item) => cleanValue(item)).filter(Boolean);

  if (normalizedItems.length === 0) {
    return "";
  }

  return `<ul>${normalizedItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderSection(title: string, body: string) {
  if (!body.trim()) {
    return "";
  }

  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function renderBasicInfo(content: ResumeContentJson["basic"]) {
  const contacts = [
    cleanValue(content.phone),
    cleanValue(content.email),
    cleanValue(content.city),
    cleanValue(content.homepageUrl),
    cleanValue(content.githubUrl),
  ].filter(Boolean);

  const targetRole = cleanValue(content.targetRole);

  return `
    <header class="hero">
      <div>
        <h1>${escapeHtml(cleanValue(content.name) || "未命名简历")}</h1>
        ${
          targetRole
            ? `<p class="target-role">目标岗位：${escapeHtml(targetRole)}</p>`
            : ""
        }
      </div>
      ${
        contacts.length > 0
          ? `<div class="contact-row">${contacts
              .map((item) => `<span>${escapeHtml(item)}</span>`)
              .join("")}</div>`
          : ""
      }
    </header>
  `;
}

function renderSummary(summary: string) {
  const normalizedSummary = cleanValue(summary);

  return renderSection(
    "个人简介",
    normalizedSummary
      ? `<p class="summary">${escapeHtml(normalizedSummary)}</p>`
      : "",
  );
}

function renderEducation(items: ResumeContentJson["education"]) {
  const body = items
    .map((item) => {
      const title = [cleanValue(item.school), cleanValue(item.major), cleanValue(item.degree)]
        .filter(Boolean)
        .join(" | ");
      const meta = renderDateRange(item.startDate, item.endDate);

      return `
        <article class="entry">
          <div class="entry-header">
            <p class="entry-title">${escapeHtml(title)}</p>
            ${meta ? `<p class="entry-meta">${escapeHtml(meta)}</p>` : ""}
          </div>
          ${renderBulletList(item.highlights)}
        </article>
      `;
    })
    .join("");

  return renderSection("教育经历", body);
}

function renderProjects(items: ResumeContentJson["projects"]) {
  const body = items
    .map((item) => {
      const title = [cleanValue(item.name), cleanValue(item.role)]
        .filter(Boolean)
        .join(" | ");
      const metaParts = [
        renderDateRange(item.startDate, item.endDate),
        item.techStack.filter((entry) => cleanValue(entry)).join(" / "),
      ].filter(Boolean);

      return `
        <article class="entry">
          <div class="entry-header">
            <p class="entry-title">${escapeHtml(title)}</p>
            ${metaParts[0] ? `<p class="entry-meta">${escapeHtml(metaParts[0])}</p>` : ""}
          </div>
          ${
            metaParts[1]
              ? `<p class="entry-submeta">技术栈：${escapeHtml(metaParts[1])}</p>`
              : ""
          }
          ${renderBulletList(item.bullets)}
        </article>
      `;
    })
    .join("");

  return renderSection("项目经历", body);
}

function renderExperiences(items: ResumeContentJson["experiences"]) {
  const body = items
    .map((item) => {
      const title = [cleanValue(item.company), cleanValue(item.role)]
        .filter(Boolean)
        .join(" | ");
      const meta = renderDateRange(item.startDate, item.endDate);

      return `
        <article class="entry">
          <div class="entry-header">
            <p class="entry-title">${escapeHtml(title)}</p>
            ${meta ? `<p class="entry-meta">${escapeHtml(meta)}</p>` : ""}
          </div>
          ${renderBulletList(item.bullets)}
        </article>
      `;
    })
    .join("");

  return renderSection("实习经历", body);
}

function renderAwards(items: ResumeContentJson["awards"]) {
  const body = items
    .map((item) => {
      const title = [cleanValue(item.title), cleanValue(item.issuer)]
        .filter(Boolean)
        .join(" | ");
      const meta = cleanValue(item.awardDate);
      const description = cleanValue(item.description);

      return `
        <article class="entry compact">
          <div class="entry-header">
            <p class="entry-title">${escapeHtml(title)}</p>
            ${meta ? `<p class="entry-meta">${escapeHtml(meta)}</p>` : ""}
          </div>
          ${description ? `<p class="entry-submeta">${escapeHtml(description)}</p>` : ""}
        </article>
      `;
    })
    .join("");

  return renderSection("奖项与证书", body);
}

function renderSkills(items: ResumeContentJson["skills"]) {
  const rows = items
    .map((group) => {
      const label = cleanValue(group.category);
      const skills = group.items.map((item) => cleanValue(item)).filter(Boolean);

      if (!label || skills.length === 0) {
        return "";
      }

      return `
        <div class="skill-row">
          <p class="skill-label">${escapeHtml(label)}</p>
          <p class="skill-items">${escapeHtml(skills.join("、"))}</p>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  return renderSection("技能清单", rows ? `<div class="skills">${rows}</div>` : "");
}

export function renderResumePdfHtml({
  content,
  templateName,
}: RenderResumePdfHtmlInput) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(cleanValue(content.basic.name) || "简历导出")}</title>
    <style>
      @page {
        size: A4;
        margin: 12mm 10mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #f4f4f0;
        color: #111827;
        font-family:
          "Microsoft YaHei",
          "PingFang SC",
          "Hiragino Sans GB",
          "Noto Sans CJK SC",
          sans-serif;
      }

      body {
        font-size: 12px;
        line-height: 1.6;
      }

      main {
        background: #ffffff;
        min-height: 100vh;
        padding: 0;
      }

      .page {
        padding: 0;
      }

      .hero {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-bottom: 14px;
        border-bottom: 2px solid #0f172a;
      }

      h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.15;
        letter-spacing: 0.02em;
      }

      .target-role {
        margin: 6px 0 0;
        color: #475569;
        font-size: 13px;
      }

      .contact-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        color: #334155;
      }

      .contact-row span::after {
        content: "";
      }

      section {
        margin-top: 16px;
        break-inside: avoid;
      }

      h2 {
        margin: 0 0 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid #cbd5e1;
        color: #0f172a;
        font-size: 13px;
        letter-spacing: 0.08em;
      }

      .summary,
      .entry-submeta,
      .skill-items {
        margin: 0;
        color: #1f2937;
      }

      .summary {
        white-space: pre-wrap;
      }

      .entry {
        margin-bottom: 10px;
      }

      .entry.compact {
        margin-bottom: 8px;
      }

      .entry:last-child {
        margin-bottom: 0;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .entry-title,
      .entry-meta,
      .skill-label {
        margin: 0;
      }

      .entry-title,
      .skill-label {
        font-weight: 700;
      }

      .entry-meta {
        color: #64748b;
        white-space: nowrap;
      }

      .entry-submeta {
        margin-top: 4px;
        color: #475569;
      }

      ul {
        margin: 6px 0 0 18px;
        padding: 0;
      }

      li {
        margin: 0 0 4px;
      }

      li:last-child {
        margin-bottom: 0;
      }

      .skills {
        display: grid;
        gap: 6px;
      }

      .skill-row {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 8px;
      }
    </style>
  </head>
  <body>
    <main data-template="${escapeHtml(templateName)}">
      <div class="page">
        ${renderBasicInfo(content.basic)}
        ${renderSummary(content.summary)}
        ${renderEducation(content.education)}
        ${renderProjects(content.projects)}
        ${renderExperiences(content.experiences)}
        ${renderSkills(content.skills)}
        ${renderAwards(content.awards)}
      </div>
    </main>
  </body>
</html>`;
}
