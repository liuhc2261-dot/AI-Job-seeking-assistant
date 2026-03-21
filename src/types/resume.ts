export const resumeGenerationStyles = [
  "steady",
  "campus",
  "technical",
] as const;

export type ResumeGenerationStyle = (typeof resumeGenerationStyles)[number];

export type ResumeGenerationStyleOption = {
  id: ResumeGenerationStyle;
  label: string;
  description: string;
  tone: string;
};

export const resumeGenerationStyleOptions: ResumeGenerationStyleOption[] = [
  {
    id: "steady",
    label: "稳健版",
    description: "语气克制、模块标准，优先保证校招与通用投递的稳定性。",
    tone: "简洁、稳健、专业，突出事实和结果，不堆砌形容词。",
  },
  {
    id: "campus",
    label: "校招版",
    description: "突出教育与项目潜力，适合学生、应届生和实习求职场景。",
    tone: "强调成长性、项目贡献和学习能力，但保持真实边界。",
  },
  {
    id: "technical",
    label: "技术版",
    description: "更强调技术栈、工程实践和实现细节，适合研发方向岗位。",
    tone: "突出技术关键词、实现路径和结果导向表达。",
  },
];

export type ResumeLifecycleStep = {
  title: string;
  description: string;
};

export type ResumeVersionKind =
  | "master"
  | "job_targeted"
  | "manual"
  | "ai_rewrite";

export type ResumeVersionStatus = "draft" | "ready" | "archived";

export type ResumeCreatedByKind =
  | "manual"
  | "ai_generate"
  | "ai_optimize"
  | "ai_diagnose_apply";

export type ResumeStatusKind = "draft" | "active" | "archived";

export type ResumeChangeType =
  | "preserved"
  | "rewritten"
  | "keyword_aligned"
  | "needs_user_confirmation";

export type ResumeChangeSummary = {
  type: ResumeChangeType;
  reason: string;
  affectedSection: string;
};

export type ResumeVersionNotes = {
  generationSummary?: string;
  items: ResumeChangeSummary[];
  warnings: string[];
};

export type ResumeBasicInfo = {
  name: string;
  phone: string;
  email: string;
  city?: string;
  targetRole?: string;
  homepageUrl?: string;
  githubUrl?: string;
};

export type ResumeEducationItem = {
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  highlights: string[];
};

export type ResumeProjectItem = {
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  techStack: string[];
  bullets: string[];
};

export type ResumeExperienceItem = {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};

export type ResumeAwardItem = {
  title: string;
  issuer?: string;
  awardDate?: string;
  description?: string;
};

export type ResumeSkillGroup = {
  category: string;
  items: string[];
};

export type ResumeContentJson = {
  basic: ResumeBasicInfo;
  summary: string;
  education: ResumeEducationItem[];
  projects: ResumeProjectItem[];
  experiences: ResumeExperienceItem[];
  awards: ResumeAwardItem[];
  skills: ResumeSkillGroup[];
};

export type ResumeVersionRecord = {
  id: string;
  resumeId: string;
  versionName: string;
  versionType: ResumeVersionKind;
  status: ResumeVersionStatus;
  sourceVersionId: string | null;
  jobTargetTitle: string | null;
  jobTargetCompany: string | null;
  contentMarkdown: string;
  contentJson: ResumeContentJson;
  changeSummary: ResumeVersionNotes | null;
  createdBy: ResumeCreatedByKind;
  createdAt: string;
  updatedAt: string;
};

export type ResumeListItem = {
  id: string;
  name: string;
  status: ResumeStatusKind;
  updatedAt: string;
  totalVersions: number;
  currentVersion: ResumeVersionRecord | null;
};

export type ResumeWorkspace = {
  resume: ResumeListItem;
  versions: ResumeVersionRecord[];
  currentVersion: ResumeVersionRecord | null;
  styles: ResumeGenerationStyleOption[];
};

export type ResumeHubData = {
  resumes: ResumeListItem[];
  styles: ResumeGenerationStyleOption[];
  canGenerate: boolean;
  missingProfileModules: string[];
  lifecycleSteps: ResumeLifecycleStep[];
  versionPrinciples: string[];
};
