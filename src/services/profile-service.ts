import { prisma } from "@/lib/db";
import type {
  AwardInput,
  BasicProfileInput,
  EducationInput,
  ExperienceInput,
  ProjectInput,
  SkillInput,
} from "@/lib/validations/profile";
import { auditLogService } from "@/services/audit-log-service";
import type {
  AwardRecord,
  BasicProfileRecord,
  EducationRecord,
  ExperienceRecord,
  ProfileModule,
  ProfileSnapshot,
  ProjectRecord,
  SkillRecord,
} from "@/types/profile";

const profileModules: ProfileModule[] = [
  {
    slug: "basic",
    title: "基本信息",
    description: "姓名、联系方式、城市、目标岗位和个人主页。",
    required: true,
    enabled: true,
  },
  {
    slug: "education",
    title: "教育经历",
    description: "学校、专业、学历、时间范围及可选 GPA / 排名。",
    required: true,
    enabled: true,
  },
  {
    slug: "projects",
    title: "项目经历",
    description: "项目名称、角色、职责、成果、技术栈与项目来源。",
    required: true,
    enabled: true,
  },
  {
    slug: "experiences",
    title: "实习经历",
    description: "公司、岗位、时间、工作内容与结果描述。",
    required: false,
    enabled: true,
  },
  {
    slug: "awards",
    title: "奖项与证书",
    description: "竞赛、荣誉、证书等可证明能力的附加信息。",
    required: false,
    enabled: true,
  },
  {
    slug: "skills",
    title: "技能清单",
    description: "语言、框架、工具和其他求职相关技能标签。",
    required: true,
    enabled: true,
  },
];

export class ProfileServiceError extends Error {
  constructor(
    public readonly code:
      | "USER_NOT_FOUND"
      | "EDUCATION_NOT_FOUND"
      | "PROJECT_NOT_FOUND"
      | "EXPERIENCE_NOT_FOUND"
      | "AWARD_NOT_FOUND"
      | "SKILL_NOT_FOUND",
  ) {
    super(code);
  }
}

function toNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function monthToDate(value: string) {
  const [year, month] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1));
}

function optionalMonthToDate(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? monthToDate(trimmed) : null;
}

function dateToMonth(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function nullableDateToMonth(value: Date | null | undefined) {
  return value ? dateToMonth(value) : "";
}

class ProfileService {
  getProfileModules(): ProfileModule[] {
    return profileModules;
  }

  async getProfileSnapshot(userId: string): Promise<ProfileSnapshot> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        profile: true,
        educations: {
          orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
        },
        projects: {
          orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
        },
        experiences: {
          orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
        },
        awards: {
          orderBy: [{ awardDate: "desc" }, { createdAt: "desc" }],
        },
        skills: {
          orderBy: [{ category: "asc" }, { name: "asc" }],
        },
      },
    });

    if (!user) {
      throw new ProfileServiceError("USER_NOT_FOUND");
    }

    const profile = this.mapProfileRecord(user.profile, user.email);
    const educations = user.educations.map((education) =>
      this.mapEducationRecord(education),
    );
    const projects = user.projects.map((project) => this.mapProjectRecord(project));
    const experiences = user.experiences.map((experience) =>
      this.mapExperienceRecord(experience),
    );
    const awards = user.awards.map((award) => this.mapAwardRecord(award));
    const skills = user.skills.map((skill) => this.mapSkillRecord(skill));
    const completion = this.getCompletionState({
      profile,
      educations,
      projects,
      experiences,
      awards,
      skills,
    });

    return {
      modules: this.getProfileModules(),
      profile,
      educations,
      projects,
      experiences,
      awards,
      skills,
      counts: {
        educations: educations.length,
        projects: projects.length,
        experiences: experiences.length,
        awards: awards.length,
        skills: skills.length,
      },
      completion,
    };
  }

  async upsertBasicProfile(userId: string, input: BasicProfileInput) {
    await this.ensureUserExists(userId);

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        targetRole: toNullable(input.targetRole),
        city: toNullable(input.city),
        homepageUrl: toNullable(input.homepageUrl),
        githubUrl: toNullable(input.githubUrl),
        summary: toNullable(input.summary),
      },
      create: {
        userId,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        targetRole: toNullable(input.targetRole),
        city: toNullable(input.city),
        homepageUrl: toNullable(input.homepageUrl),
        githubUrl: toNullable(input.githubUrl),
        summary: toNullable(input.summary),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "PROFILE_UPDATED",
      resourceType: "USER_PROFILE",
      resourceId: profile.id,
      payload: {
        section: "basic",
      },
    });

    return this.mapProfileRecord(profile, input.email);
  }

  async createEducation(userId: string, input: EducationInput) {
    await this.ensureUserExists(userId);

    const education = await prisma.education.create({
      data: {
        userId,
        schoolName: input.schoolName,
        major: input.major,
        degree: input.degree,
        startDate: monthToDate(input.startDate),
        endDate: monthToDate(input.endDate),
        gpa: toNullable(input.gpa),
        ranking: toNullable(input.ranking),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "EDUCATION_CREATED",
      resourceType: "EDUCATION",
      resourceId: education.id,
    });

    return this.mapEducationRecord(education);
  }

  async updateEducation(userId: string, educationId: string, input: EducationInput) {
    const existingEducation = await prisma.education.findFirst({
      where: {
        id: educationId,
        userId,
      },
      select: { id: true },
    });

    if (!existingEducation) {
      throw new ProfileServiceError("EDUCATION_NOT_FOUND");
    }

    const education = await prisma.education.update({
      where: { id: educationId },
      data: {
        schoolName: input.schoolName,
        major: input.major,
        degree: input.degree,
        startDate: monthToDate(input.startDate),
        endDate: monthToDate(input.endDate),
        gpa: toNullable(input.gpa),
        ranking: toNullable(input.ranking),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "EDUCATION_UPDATED",
      resourceType: "EDUCATION",
      resourceId: education.id,
    });

    return this.mapEducationRecord(education);
  }

  async deleteEducation(userId: string, educationId: string) {
    const existingEducation = await prisma.education.findFirst({
      where: {
        id: educationId,
        userId,
      },
      select: { id: true },
    });

    if (!existingEducation) {
      throw new ProfileServiceError("EDUCATION_NOT_FOUND");
    }

    await prisma.education.delete({
      where: { id: educationId },
    });

    await auditLogService.createLog({
      userId,
      actionType: "EDUCATION_DELETED",
      resourceType: "EDUCATION",
      resourceId: educationId,
    });
  }

  async createProject(userId: string, input: ProjectInput) {
    await this.ensureUserExists(userId);

    const project = await prisma.project.create({
      data: {
        userId,
        name: input.name,
        role: input.role,
        startDate: monthToDate(input.startDate),
        endDate: monthToDate(input.endDate),
        descriptionRaw: input.descriptionRaw,
        techStack: toNullable(input.techStack),
        contributionRaw: toNullable(input.contributionRaw),
        resultRaw: toNullable(input.resultRaw),
        sourceType: toNullable(input.sourceType),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "PROJECT_CREATED",
      resourceType: "PROJECT",
      resourceId: project.id,
    });

    return this.mapProjectRecord(project);
  }

  async updateProject(userId: string, projectId: string, input: ProjectInput) {
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: { id: true },
    });

    if (!existingProject) {
      throw new ProfileServiceError("PROJECT_NOT_FOUND");
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        role: input.role,
        startDate: monthToDate(input.startDate),
        endDate: monthToDate(input.endDate),
        descriptionRaw: input.descriptionRaw,
        techStack: toNullable(input.techStack),
        contributionRaw: toNullable(input.contributionRaw),
        resultRaw: toNullable(input.resultRaw),
        sourceType: toNullable(input.sourceType),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "PROJECT_UPDATED",
      resourceType: "PROJECT",
      resourceId: project.id,
    });

    return this.mapProjectRecord(project);
  }

  async deleteProject(userId: string, projectId: string) {
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      select: { id: true },
    });

    if (!existingProject) {
      throw new ProfileServiceError("PROJECT_NOT_FOUND");
    }

    await prisma.project.delete({
      where: { id: projectId },
    });

    await auditLogService.createLog({
      userId,
      actionType: "PROJECT_DELETED",
      resourceType: "PROJECT",
      resourceId: projectId,
    });
  }

  async createExperience(userId: string, input: ExperienceInput) {
    await this.ensureUserExists(userId);

    const experience = await prisma.experience.create({
      data: {
        userId,
        companyName: input.companyName,
        jobTitle: input.jobTitle,
        startDate: monthToDate(input.startDate),
        endDate: monthToDate(input.endDate),
        descriptionRaw: input.descriptionRaw,
        resultRaw: toNullable(input.resultRaw),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "EXPERIENCE_CREATED",
      resourceType: "EXPERIENCE",
      resourceId: experience.id,
    });

    return this.mapExperienceRecord(experience);
  }

  async updateExperience(userId: string, experienceId: string, input: ExperienceInput) {
    const existingExperience = await prisma.experience.findFirst({
      where: {
        id: experienceId,
        userId,
      },
      select: { id: true },
    });

    if (!existingExperience) {
      throw new ProfileServiceError("EXPERIENCE_NOT_FOUND");
    }

    const experience = await prisma.experience.update({
      where: { id: experienceId },
      data: {
        companyName: input.companyName,
        jobTitle: input.jobTitle,
        startDate: monthToDate(input.startDate),
        endDate: monthToDate(input.endDate),
        descriptionRaw: input.descriptionRaw,
        resultRaw: toNullable(input.resultRaw),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "EXPERIENCE_UPDATED",
      resourceType: "EXPERIENCE",
      resourceId: experience.id,
    });

    return this.mapExperienceRecord(experience);
  }

  async deleteExperience(userId: string, experienceId: string) {
    const existingExperience = await prisma.experience.findFirst({
      where: {
        id: experienceId,
        userId,
      },
      select: { id: true },
    });

    if (!existingExperience) {
      throw new ProfileServiceError("EXPERIENCE_NOT_FOUND");
    }

    await prisma.experience.delete({
      where: { id: experienceId },
    });

    await auditLogService.createLog({
      userId,
      actionType: "EXPERIENCE_DELETED",
      resourceType: "EXPERIENCE",
      resourceId: experienceId,
    });
  }

  async createAward(userId: string, input: AwardInput) {
    await this.ensureUserExists(userId);

    const award = await prisma.award.create({
      data: {
        userId,
        title: input.title,
        issuer: toNullable(input.issuer),
        awardDate: optionalMonthToDate(input.awardDate),
        description: toNullable(input.description),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "AWARD_CREATED",
      resourceType: "AWARD",
      resourceId: award.id,
    });

    return this.mapAwardRecord(award);
  }

  async updateAward(userId: string, awardId: string, input: AwardInput) {
    const existingAward = await prisma.award.findFirst({
      where: {
        id: awardId,
        userId,
      },
      select: { id: true },
    });

    if (!existingAward) {
      throw new ProfileServiceError("AWARD_NOT_FOUND");
    }

    const award = await prisma.award.update({
      where: { id: awardId },
      data: {
        title: input.title,
        issuer: toNullable(input.issuer),
        awardDate: optionalMonthToDate(input.awardDate),
        description: toNullable(input.description),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "AWARD_UPDATED",
      resourceType: "AWARD",
      resourceId: award.id,
    });

    return this.mapAwardRecord(award);
  }

  async deleteAward(userId: string, awardId: string) {
    const existingAward = await prisma.award.findFirst({
      where: {
        id: awardId,
        userId,
      },
      select: { id: true },
    });

    if (!existingAward) {
      throw new ProfileServiceError("AWARD_NOT_FOUND");
    }

    await prisma.award.delete({
      where: { id: awardId },
    });

    await auditLogService.createLog({
      userId,
      actionType: "AWARD_DELETED",
      resourceType: "AWARD",
      resourceId: awardId,
    });
  }

  async createSkill(userId: string, input: SkillInput) {
    await this.ensureUserExists(userId);

    const skill = await prisma.skill.create({
      data: {
        userId,
        category: input.category,
        name: input.name,
        level: toNullable(input.level),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "SKILL_CREATED",
      resourceType: "SKILL",
      resourceId: skill.id,
    });

    return this.mapSkillRecord(skill);
  }

  async updateSkill(userId: string, skillId: string, input: SkillInput) {
    const existingSkill = await prisma.skill.findFirst({
      where: {
        id: skillId,
        userId,
      },
      select: { id: true },
    });

    if (!existingSkill) {
      throw new ProfileServiceError("SKILL_NOT_FOUND");
    }

    const skill = await prisma.skill.update({
      where: { id: skillId },
      data: {
        category: input.category,
        name: input.name,
        level: toNullable(input.level),
      },
    });

    await auditLogService.createLog({
      userId,
      actionType: "SKILL_UPDATED",
      resourceType: "SKILL",
      resourceId: skill.id,
    });

    return this.mapSkillRecord(skill);
  }

  async deleteSkill(userId: string, skillId: string) {
    const existingSkill = await prisma.skill.findFirst({
      where: {
        id: skillId,
        userId,
      },
      select: { id: true },
    });

    if (!existingSkill) {
      throw new ProfileServiceError("SKILL_NOT_FOUND");
    }

    await prisma.skill.delete({
      where: { id: skillId },
    });

    await auditLogService.createLog({
      userId,
      actionType: "SKILL_DELETED",
      resourceType: "SKILL",
      resourceId: skillId,
    });
  }

  private async ensureUserExists(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new ProfileServiceError("USER_NOT_FOUND");
    }
  }

  private mapProfileRecord(
    profile: {
      fullName: string | null;
      phone: string | null;
      email: string | null;
      targetRole: string | null;
      city: string | null;
      homepageUrl: string | null;
      githubUrl: string | null;
      summary: string | null;
    } | null,
    fallbackEmail: string,
  ): BasicProfileRecord {
    return {
      fullName: profile?.fullName ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? fallbackEmail,
      targetRole: profile?.targetRole ?? "",
      city: profile?.city ?? "",
      homepageUrl: profile?.homepageUrl ?? "",
      githubUrl: profile?.githubUrl ?? "",
      summary: profile?.summary ?? "",
    };
  }

  private mapEducationRecord(education: {
    id: string;
    schoolName: string;
    major: string;
    degree: string;
    startDate: Date;
    endDate: Date;
    gpa: string | null;
    ranking: string | null;
  }): EducationRecord {
    return {
      id: education.id,
      schoolName: education.schoolName,
      major: education.major,
      degree: education.degree,
      startDate: dateToMonth(education.startDate),
      endDate: dateToMonth(education.endDate),
      gpa: education.gpa ?? "",
      ranking: education.ranking ?? "",
    };
  }

  private mapProjectRecord(project: {
    id: string;
    name: string;
    role: string;
    startDate: Date;
    endDate: Date;
    descriptionRaw: string;
    techStack: string | null;
    contributionRaw: string | null;
    resultRaw: string | null;
    sourceType: string | null;
  }): ProjectRecord {
    return {
      id: project.id,
      name: project.name,
      role: project.role,
      startDate: dateToMonth(project.startDate),
      endDate: dateToMonth(project.endDate),
      descriptionRaw: project.descriptionRaw,
      techStack: project.techStack ?? "",
      contributionRaw: project.contributionRaw ?? "",
      resultRaw: project.resultRaw ?? "",
      sourceType: project.sourceType ?? "",
    };
  }

  private mapExperienceRecord(experience: {
    id: string;
    companyName: string;
    jobTitle: string;
    startDate: Date;
    endDate: Date;
    descriptionRaw: string;
    resultRaw: string | null;
  }): ExperienceRecord {
    return {
      id: experience.id,
      companyName: experience.companyName,
      jobTitle: experience.jobTitle,
      startDate: dateToMonth(experience.startDate),
      endDate: dateToMonth(experience.endDate),
      descriptionRaw: experience.descriptionRaw,
      resultRaw: experience.resultRaw ?? "",
    };
  }

  private mapAwardRecord(award: {
    id: string;
    title: string;
    issuer: string | null;
    awardDate: Date | null;
    description: string | null;
  }): AwardRecord {
    return {
      id: award.id,
      title: award.title,
      issuer: award.issuer ?? "",
      awardDate: nullableDateToMonth(award.awardDate),
      description: award.description ?? "",
    };
  }

  private mapSkillRecord(skill: {
    id: string;
    category: string;
    name: string;
    level: string | null;
  }): SkillRecord {
    return {
      id: skill.id,
      category: skill.category,
      name: skill.name,
      level: skill.level ?? "",
    };
  }

  private getCompletionState(input: {
    profile: BasicProfileRecord;
    educations: EducationRecord[];
    projects: ProjectRecord[];
    experiences: ExperienceRecord[];
    awards: AwardRecord[];
    skills: SkillRecord[];
  }) {
    const completedSlugs = profileModules
      .filter((module) => module.required && module.enabled)
      .filter((module) => {
        switch (module.slug) {
          case "basic":
            return Boolean(
              input.profile.fullName && input.profile.phone && input.profile.email,
            );
          case "education":
            return input.educations.length > 0;
          case "projects":
            return input.projects.length > 0;
          case "skills":
            return input.skills.length > 0;
          default:
            return false;
        }
      })
      .map((module) => module.slug);

    const requiredModules = profileModules.filter(
      (module) => module.required && module.enabled,
    );
    const missingSlugs = requiredModules
      .map((module) => module.slug)
      .filter((slug) => !completedSlugs.includes(slug));

    return {
      requiredCompleted: completedSlugs.length,
      requiredTotal: requiredModules.length,
      completedSlugs,
      missingSlugs,
    };
  }
}

export const profileService = new ProfileService();
