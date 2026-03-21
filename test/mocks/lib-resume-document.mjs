function createFallbackContent(basic = {}) {
  return {
    basic: {
      name: basic.name ?? "",
      phone: basic.phone ?? "",
      email: basic.email ?? "",
      city: basic.city ?? "",
      targetRole: basic.targetRole ?? "",
      homepageUrl: basic.homepageUrl ?? "",
      githubUrl: basic.githubUrl ?? "",
    },
    summary: "",
    education: [],
    projects: [],
    experiences: [],
    awards: [],
    skills: [],
  };
}

export function createEmptyResumeContent(input = {}) {
  if (globalThis.__testResumeDocument?.createEmptyResumeContent) {
    return globalThis.__testResumeDocument.createEmptyResumeContent(input);
  }

  return createFallbackContent(input);
}

export function renderResumeMarkdown(content) {
  if (globalThis.__testResumeDocument?.renderResumeMarkdown) {
    return globalThis.__testResumeDocument.renderResumeMarkdown(content);
  }

  return `markdown:${content.basic.name}`;
}
