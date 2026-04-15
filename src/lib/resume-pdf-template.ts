import type { ResumeContentJson } from "@/types/resume";

type RenderResumePdfHtmlInput = {
  content: ResumeContentJson;
  templateName: string;
};

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Template: ATS Standard (original, stable)
// ---------------------------------------------------------------------------

function renderAtsStandardHtml(content: ResumeContentJson, templateName: string) {
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

// ---------------------------------------------------------------------------
// Template: Clean Tech (minimalist, code-focused)
// ---------------------------------------------------------------------------

function renderCleanTechHtml(content: ResumeContentJson, templateName: string) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(cleanValue(content.basic.name) || "简历导出")}</title>
    <style>
      @page {
        size: A4;
        margin: 14mm 12mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #1e293b;
        font-family:
          "SF Mono",
          "Cascadia Code",
          "Fira Code",
          "Consolas",
          "Microsoft YaHei",
          monospace;
      }

      body {
        font-size: 11.5px;
        line-height: 1.7;
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
        padding: 0 0 16px;
        border-bottom: 1.5px solid #e2e8f0;
        margin-bottom: 16px;
      }

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: #0f172a;
      }

      .target-role {
        margin: 4px 0 0;
        color: #64748b;
        font-size: 12px;
      }

      .contact-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
        margin-top: 8px;
        color: #64748b;
        font-size: 11px;
      }

      .contact-row span {
        font-family: monospace;
      }

      section {
        margin-top: 14px;
        break-inside: avoid;
      }

      h2 {
        margin: 0 0 8px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #94a3b8;
      }

      .summary {
        white-space: pre-wrap;
        color: #334155;
        line-height: 1.7;
      }

      .entry {
        margin-bottom: 10px;
      }

      .entry:last-child {
        margin-bottom: 0;
      }

      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
      }

      .entry-title {
        margin: 0;
        font-weight: 600;
        color: #1e293b;
        font-size: 12px;
      }

      .entry-meta {
        margin: 0;
        color: #94a3b8;
        font-size: 10px;
        white-space: nowrap;
        font-family: monospace;
      }

      .entry-submeta {
        margin: 2px 0 0;
        color: #64748b;
        font-size: 10.5px;
      }

      .entry-submeta::before {
        content: "// ";
        color: #cbd5e1;
      }

      ul {
        margin: 5px 0 0 16px;
        padding: 0;
      }

      li {
        margin: 0 0 3px;
        color: #334155;
      }

      li:last-child {
        margin-bottom: 0;
      }

      .skills {
        display: grid;
        gap: 4px;
      }

      .skill-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      .skill-label {
        margin: 0;
        font-weight: 600;
        color: #475569;
        font-size: 10.5px;
        min-width: 72px;
      }

      .skill-items {
        margin: 0;
        color: #64748b;
        font-size: 10.5px;
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

// ---------------------------------------------------------------------------
// Template: Creative (dual-column, visually rich)
// ---------------------------------------------------------------------------

function renderCreativeHtml(content: ResumeContentJson, templateName: string) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(cleanValue(content.basic.name) || "简历导出")}</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #f8fafc;
        color: #1e293b;
        font-family:
          "Microsoft YaHei",
          "PingFang SC",
          "Hiragino Sans GB",
          sans-serif;
      }

      body {
        font-size: 11px;
        line-height: 1.6;
      }

      main {
        display: grid;
        grid-template-columns: 200px 1fr;
        min-height: 297mm;
      }

      .sidebar {
        background: #1e293b;
        color: #e2e8f0;
        padding: 20px 16px;
        break-inside: avoid;
      }

      .content {
        background: #ffffff;
        padding: 20px 20px 20px 18px;
        break-inside: avoid;
      }

      .sidebar h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: 0.02em;
      }

      .sidebar .target-role {
        margin: 6px 0 0;
        color: #94a3b8;
        font-size: 10px;
      }

      .sidebar-section {
        margin-top: 18px;
      }

      .sidebar h3 {
        margin: 0 0 6px;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #64748b;
      }

      .sidebar .contact-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 4px;
      }

      .sidebar .contact-item {
        color: #cbd5e1;
        font-size: 10px;
        word-break: break-all;
      }

      .sidebar p,
      .sidebar .summary-text {
        margin: 0;
        color: #cbd5e1;
        font-size: 10px;
        line-height: 1.6;
        white-space: pre-wrap;
      }

      .sidebar .skill-group {
        margin-bottom: 8px;
      }

      .sidebar .skill-group-label {
        color: #94a3b8;
        font-size: 9px;
        margin-bottom: 3px;
      }

      .sidebar .skill-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
      }

      .sidebar .skill-tag {
        background: #334155;
        color: #e2e8f0;
        border-radius: 3px;
        padding: 2px 5px;
        font-size: 9px;
      }

      .content h2 {
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 700;
        color: #1e293b;
        letter-spacing: 0.05em;
        border-left: 3px solid #3b82f6;
        padding-left: 8px;
      }

      .content section {
        margin-top: 14px;
        break-inside: avoid;
      }

      .content .entry {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid #f1f5f9;
      }

      .content .entry:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }

      .content .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 4px;
      }

      .content .entry-title {
        margin: 0;
        font-weight: 700;
        color: #0f172a;
        font-size: 11.5px;
      }

      .content .entry-meta {
        margin: 0;
        color: #64748b;
        font-size: 9.5px;
        white-space: nowrap;
      }

      .content .entry-submeta {
        margin: 2px 0 4px;
        color: #3b82f6;
        font-size: 9.5px;
        font-weight: 500;
      }

      .content ul {
        margin: 0;
        padding-left: 14px;
      }

      .content li {
        margin: 0 0 3px;
        color: #334155;
        font-size: 10.5px;
      }

      .content li:last-child {
        margin-bottom: 0;
      }

      .content .award-title {
        margin: 0;
        font-weight: 600;
        color: #0f172a;
        font-size: 11px;
      }

      .content .award-meta {
        margin: 2px 0 0;
        color: #64748b;
        font-size: 9.5px;
      }
    </style>
  </head>
  <body>
    <main data-template="${escapeHtml(templateName)}">
      <aside class="sidebar">
        <h1>${escapeHtml(cleanValue(content.basic.name) || "姓名")}</h1>
        ${
          cleanValue(content.basic.targetRole)
            ? `<p class="target-role">${escapeHtml(content.basic.targetRole)}</p>`
            : ""
        }

        <div class="sidebar-section">
          <h3>联系方式</h3>
          <div class="contact-row">
            ${
              cleanValue(content.basic.phone)
                ? `<span class="contact-item">${escapeHtml(content.basic.phone)}</span>`
                : ""
            }
            ${
              cleanValue(content.basic.email)
                ? `<span class="contact-item">${escapeHtml(content.basic.email)}</span>`
                : ""
            }
            ${
              cleanValue(content.basic.city)
                ? `<span class="contact-item">${escapeHtml(content.basic.city)}</span>`
                : ""
            }
            ${
              cleanValue(content.basic.githubUrl)
                ? `<span class="contact-item">${escapeHtml(content.basic.githubUrl)}</span>`
                : ""
            }
            ${
              cleanValue(content.basic.homepageUrl)
                ? `<span class="contact-item">${escapeHtml(content.basic.homepageUrl)}</span>`
                : ""
            }
          </div>
        </div>

        ${
          cleanValue(content.summary)
            ? `
        <div class="sidebar-section">
          <h3>个人简介</h3>
          <p class="summary-text">${escapeHtml(content.summary)}</p>
        </div>
        `
            : ""
        }

        ${
          content.skills.length > 0
            ? `
        <div class="sidebar-section">
          <h3>技能清单</h3>
          ${content.skills
            .map(
              (group) => `
              <div class="skill-group">
                <p class="skill-group-label">${escapeHtml(group.category)}</p>
                <div class="skill-tags">
                  ${group.items
                    .map((item) => `<span class="skill-tag">${escapeHtml(item)}</span>`)
                    .join("")}
                </div>
              </div>
            `,
            )
            .join("")}
        </div>
        `
            : ""
        }
      </aside>

      <div class="content">
        ${
          content.education.length > 0
            ? `
          <section>
            <h2>教育经历</h2>
            ${content.education
              .map(
                (item) => `
                <div class="entry">
                  <div class="entry-header">
                    <p class="entry-title">${escapeHtml(item.school)} · ${escapeHtml(item.major)} · ${escapeHtml(item.degree)}</p>
                    <p class="entry-meta">${escapeHtml(renderDateRange(item.startDate, item.endDate))}</p>
                  </div>
                  ${renderBulletList(item.highlights)}
                </div>
              `,
              )
              .join("")}
          </section>
        `
            : ""
        }

        ${
          content.projects.length > 0
            ? `
          <section>
            <h2>项目经历</h2>
            ${content.projects
              .map(
                (item) => `
                <div class="entry">
                  <div class="entry-header">
                    <p class="entry-title">${escapeHtml(item.name)}</p>
                    <p class="entry-meta">${escapeHtml(renderDateRange(item.startDate, item.endDate))}</p>
                  </div>
                  ${
                    item.techStack.filter(Boolean).length > 0
                      ? `<p class="entry-submeta">${escapeHtml(item.techStack.filter(Boolean).join(" / "))}</p>`
                      : ""
                  }
                  ${renderBulletList(item.bullets)}
                </div>
              `,
              )
              .join("")}
          </section>
        `
            : ""
        }

        ${
          content.experiences.length > 0
            ? `
          <section>
            <h2>实习经历</h2>
            ${content.experiences
              .map(
                (item) => `
                <div class="entry">
                  <div class="entry-header">
                    <p class="entry-title">${escapeHtml(item.company)} · ${escapeHtml(item.role)}</p>
                    <p class="entry-meta">${escapeHtml(renderDateRange(item.startDate, item.endDate))}</p>
                  </div>
                  ${renderBulletList(item.bullets)}
                </div>
              `,
              )
              .join("")}
          </section>
        `
            : ""
        }

        ${
          content.awards.length > 0
            ? `
          <section>
            <h2>奖项荣誉</h2>
            ${content.awards
              .map(
                (item) => `
                <div class="entry">
                  <p class="award-title">${escapeHtml(item.title)}</p>
                  <p class="award-meta">${[escapeHtml(item.issuer), escapeHtml(item.awardDate)].filter(Boolean).join(" · ")}</p>
                </div>
              `,
              )
              .join("")}
          </section>
        `
            : ""
        }
      </div>
    </main>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

type TemplateRenderer = (content: ResumeContentJson, templateName: string) => string;

const templateRenderers: Record<string, TemplateRenderer> = {
  "ats-standard": renderAtsStandardHtml,
  "clean-tech": renderCleanTechHtml,
  creative: renderCreativeHtml,
};

/**
 * Renders resume content to HTML using the specified template.
 * Falls back to 'ats-standard' if the template is not found.
 */
export function renderResumePdfHtml({ content, templateName }: RenderResumePdfHtmlInput) {
  const renderer = templateRenderers[templateName] ?? templateRenderers["ats-standard"];

  return renderer(content, templateName);
}

/**
 * Returns the list of registered template IDs.
 */
export function listPdfTemplateIds() {
  return Object.keys(templateRenderers);
}
