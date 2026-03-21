export type ProfileModule = {
  slug: string;
  title: string;
  description: string;
  required: boolean;
  enabled: boolean;
};

export type BasicProfileRecord = {
  fullName: string;
  phone: string;
  email: string;
  targetRole: string;
  city: string;
  homepageUrl: string;
  githubUrl: string;
  summary: string;
};

export type EducationRecord = {
  id: string;
  schoolName: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  gpa: string;
  ranking: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  descriptionRaw: string;
  techStack: string;
  contributionRaw: string;
  resultRaw: string;
  sourceType: string;
};

export type ExperienceRecord = {
  id: string;
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  descriptionRaw: string;
  resultRaw: string;
};

export type AwardRecord = {
  id: string;
  title: string;
  issuer: string;
  awardDate: string;
  description: string;
};

export type SkillRecord = {
  id: string;
  category: string;
  name: string;
  level: string;
};

export type ProfileCompletion = {
  requiredCompleted: number;
  requiredTotal: number;
  completedSlugs: string[];
  missingSlugs: string[];
};

export type ProfileSnapshot = {
  modules: ProfileModule[];
  profile: BasicProfileRecord;
  educations: EducationRecord[];
  projects: ProjectRecord[];
  experiences: ExperienceRecord[];
  awards: AwardRecord[];
  skills: SkillRecord[];
  counts: {
    educations: number;
    projects: number;
    experiences: number;
    awards: number;
    skills: number;
  };
  completion: ProfileCompletion;
};
