import type {
  ResumeAwardItem,
  ResumeBasicInfo,
  ResumeContentJson,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeProjectItem,
  ResumeSkillGroup,
} from "@/types/resume";

function cleanValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function appendSection(lines: string[], title: string, sectionLines: string[]) {
  if (sectionLines.length === 0) {
    return;
  }

  if (lines.length > 0) {
    lines.push("");
  }

  lines.push(`## ${title}`);
  lines.push(...sectionLines);
}

function renderRange(startDate: string, endDate: string) {
  return [cleanValue(startDate), cleanValue(endDate)].filter(Boolean).join(" - ");
}

function renderBasicInfo(basic: ResumeBasicInfo) {
  const contactLine = [
    cleanValue(basic.phone),
    cleanValue(basic.email),
    cleanValue(basic.city),
    cleanValue(basic.homepageUrl),
    cleanValue(basic.githubUrl),
  ]
    .filter(Boolean)
    .join(" | ");

  const lines = [basic.name.trim()];

  if (contactLine) {
    lines.push(contactLine);
  }

  if (cleanValue(basic.targetRole)) {
    lines.push(`目标岗位：${cleanValue(basic.targetRole)}`);
  }

  return lines;
}

function renderEducation(items: ResumeEducationItem[]) {
  return items.flatMap((item) => {
    const header = [item.school.trim(), item.major.trim(), item.degree.trim()]
      .filter(Boolean)
      .join(" | ");
    const range = renderRange(item.startDate, item.endDate);
    const lines = [range ? `${header} | ${range}` : header].filter(Boolean);

    item.highlights
      .map((highlight) => highlight.trim())
      .filter(Boolean)
      .forEach((highlight) => {
        lines.push(`- ${highlight}`);
      });

    return lines;
  });
}

function renderProjects(items: ResumeProjectItem[]) {
  return items.flatMap((item) => {
    const header = [item.name.trim(), item.role.trim()].filter(Boolean).join(" | ");
    const range = renderRange(item.startDate, item.endDate);
    const techStack = item.techStack.map((entry) => entry.trim()).filter(Boolean);
    const lines = [range ? `${header} | ${range}` : header].filter(Boolean);

    if (techStack.length > 0) {
      lines.push(`技术栈：${techStack.join(" / ")}`);
    }

    item.bullets
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .forEach((bullet) => {
        lines.push(`- ${bullet}`);
      });

    return lines;
  });
}

function renderExperiences(items: ResumeExperienceItem[]) {
  return items.flatMap((item) => {
    const header = [item.company.trim(), item.role.trim()].filter(Boolean).join(" | ");
    const range = renderRange(item.startDate, item.endDate);
    const lines = [range ? `${header} | ${range}` : header].filter(Boolean);

    item.bullets
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .forEach((bullet) => {
        lines.push(`- ${bullet}`);
      });

    return lines;
  });
}

function renderAwards(items: ResumeAwardItem[]) {
  return items.flatMap((item) => {
    const header = [item.title.trim(), cleanValue(item.issuer)].filter(Boolean).join(" | ");
    const lines = [header];

    if (cleanValue(item.awardDate)) {
      lines.push(`时间：${cleanValue(item.awardDate)}`);
    }

    if (cleanValue(item.description)) {
      lines.push(`- ${cleanValue(item.description)}`);
    }

    return lines.filter(Boolean);
  });
}

function renderSkills(items: ResumeSkillGroup[]) {
  return items
    .map((group) => {
      const skillItems = group.items.map((item) => item.trim()).filter(Boolean);

      if (!group.category.trim() || skillItems.length === 0) {
        return "";
      }

      return `- ${group.category.trim()}：${skillItems.join("、")}`;
    })
    .filter(Boolean);
}

export function createEmptyResumeContent(
  basic?: Partial<ResumeBasicInfo>,
): ResumeContentJson {
  return {
    basic: {
      name: cleanValue(basic?.name),
      phone: cleanValue(basic?.phone),
      email: cleanValue(basic?.email),
      city: cleanValue(basic?.city),
      targetRole: cleanValue(basic?.targetRole),
      homepageUrl: cleanValue(basic?.homepageUrl),
      githubUrl: cleanValue(basic?.githubUrl),
    },
    summary: "",
    education: [],
    projects: [],
    experiences: [],
    awards: [],
    skills: [],
  };
}

export function createEducationItem(): ResumeEducationItem {
  return {
    school: "",
    major: "",
    degree: "",
    startDate: "",
    endDate: "",
    highlights: [],
  };
}

export function createProjectItem(): ResumeProjectItem {
  return {
    name: "",
    role: "",
    startDate: "",
    endDate: "",
    techStack: [],
    bullets: [],
  };
}

export function createExperienceItem(): ResumeExperienceItem {
  return {
    company: "",
    role: "",
    startDate: "",
    endDate: "",
    bullets: [],
  };
}

export function createAwardItem(): ResumeAwardItem {
  return {
    title: "",
    issuer: "",
    awardDate: "",
    description: "",
  };
}

export function createSkillGroup(): ResumeSkillGroup {
  return {
    category: "",
    items: [],
  };
}

export function renderResumeMarkdown(content: ResumeContentJson) {
  const lines = renderBasicInfo(content.basic);

  appendSection(lines, "个人简介", cleanValue(content.summary) ? [cleanValue(content.summary)] : []);
  appendSection(lines, "教育经历", renderEducation(content.education));
  appendSection(lines, "项目经历", renderProjects(content.projects));
  appendSection(lines, "实习经历", renderExperiences(content.experiences));
  appendSection(lines, "技能清单", renderSkills(content.skills));
  appendSection(lines, "奖项与证书", renderAwards(content.awards));

  return lines.join("\n").trim();
}

export function formatResumeDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
