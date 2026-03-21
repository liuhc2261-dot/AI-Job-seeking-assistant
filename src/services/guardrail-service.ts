import type { NormalizedProfileSnapshot } from "@/ai/orchestrators/profile-normalizer-agent";
import type { ResumeContentJson } from "@/types/resume";

type GuardrailInspectionResult = {
  blocked: boolean;
  warnings: string[];
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function createTokenSet(values: string[]) {
  return new Set(values.map(normalizeToken).filter(Boolean));
}

function collectSkillTokens(resume: ResumeContentJson) {
  return createTokenSet(resume.skills.flatMap((group) => group.items));
}

function buildResumeCorpus(resume: ResumeContentJson) {
  return [
    resume.basic.name,
    resume.basic.targetRole ?? "",
    resume.summary,
    ...resume.education.flatMap((education) => [
      education.school,
      education.major,
      education.degree,
      ...education.highlights,
    ]),
    ...resume.projects.flatMap((project) => [
      project.name,
      project.role,
      ...project.techStack,
      ...project.bullets,
    ]),
    ...resume.experiences.flatMap((experience) => [
      experience.company,
      experience.role,
      ...experience.bullets,
    ]),
    ...resume.awards.flatMap((award) => [
      award.title,
      award.issuer ?? "",
      award.description ?? "",
    ]),
  ]
    .join("\n")
    .toLowerCase();
}

function collectProjectTokens(resume: ResumeContentJson) {
  return createTokenSet(resume.projects.map((project) => project.name));
}

function collectEducationTokens(resume: ResumeContentJson) {
  return createTokenSet(resume.education.map((education) => education.school));
}

function collectExperienceTokens(resume: ResumeContentJson) {
  return createTokenSet(resume.experiences.map((experience) => experience.company));
}

function collectAwardTokens(resume: ResumeContentJson) {
  return createTokenSet(resume.awards.map((award) => award.title));
}

class GuardrailService {
  inspectGeneratedResume(input: {
    snapshot: NormalizedProfileSnapshot;
    generatedResume: ResumeContentJson;
  }): GuardrailInspectionResult {
    const warnings: string[] = [];
    const projectNameSet = createTokenSet(
      input.snapshot.projects.map((project) => project.name),
    );
    const educationSet = createTokenSet(
      input.snapshot.educations.map((education) => education.schoolName),
    );
    const experienceSet = createTokenSet(
      input.snapshot.experiences.map((experience) => experience.companyName),
    );
    const awardSet = createTokenSet(
      input.snapshot.awards.map((award) => award.title),
    );
    const skillSet = createTokenSet(
      input.snapshot.skills.map((skill) => skill.name),
    );

    if (
      normalizeToken(input.generatedResume.basic.name) !==
      normalizeToken(input.snapshot.basic.fullName)
    ) {
      warnings.push("生成结果中的姓名与建档资料不一致。");
    }

    if (
      normalizeToken(input.generatedResume.basic.email) !==
      normalizeToken(input.snapshot.basic.email)
    ) {
      warnings.push("生成结果中的邮箱与建档资料不一致。");
    }

    if (
      normalizeToken(input.generatedResume.basic.phone) !==
      normalizeToken(input.snapshot.basic.phone)
    ) {
      warnings.push("生成结果中的电话与建档资料不一致。");
    }

    input.generatedResume.projects.forEach((project) => {
      if (!projectNameSet.has(normalizeToken(project.name))) {
        warnings.push(`检测到未出现在建档资料中的项目：${project.name}`);
      }
    });

    input.generatedResume.education.forEach((education) => {
      if (!educationSet.has(normalizeToken(education.school))) {
        warnings.push(`检测到未出现在建档资料中的学校：${education.school}`);
      }
    });

    input.generatedResume.experiences.forEach((experience) => {
      if (!experienceSet.has(normalizeToken(experience.company))) {
        warnings.push(`检测到未出现在建档资料中的实习经历：${experience.company}`);
      }
    });

    input.generatedResume.awards.forEach((award) => {
      if (!awardSet.has(normalizeToken(award.title))) {
        warnings.push(`检测到未出现在建档资料中的奖项：${award.title}`);
      }
    });

    input.generatedResume.skills.forEach((group) => {
      group.items.forEach((skill) => {
        if (!skillSet.has(normalizeToken(skill))) {
          warnings.push(`检测到未出现在建档资料中的技能：${skill}`);
        }
      });
    });

    return {
      blocked: warnings.length > 0,
      warnings,
    };
  }

  inspectOptimizedResume(input: {
    sourceResume: ResumeContentJson;
    optimizedResume: ResumeContentJson;
  }): GuardrailInspectionResult {
    const warnings: string[] = [];
    const projectNameSet = collectProjectTokens(input.sourceResume);
    const educationSet = collectEducationTokens(input.sourceResume);
    const experienceSet = collectExperienceTokens(input.sourceResume);
    const awardSet = collectAwardTokens(input.sourceResume);
    const skillSet = collectSkillTokens(input.sourceResume);

    if (
      normalizeToken(input.optimizedResume.basic.name) !==
      normalizeToken(input.sourceResume.basic.name)
    ) {
      warnings.push("岗位优化结果中的姓名与原版本不一致。");
    }

    if (
      normalizeToken(input.optimizedResume.basic.email) !==
      normalizeToken(input.sourceResume.basic.email)
    ) {
      warnings.push("岗位优化结果中的邮箱与原版本不一致。");
    }

    if (
      normalizeToken(input.optimizedResume.basic.phone) !==
      normalizeToken(input.sourceResume.basic.phone)
    ) {
      warnings.push("岗位优化结果中的电话与原版本不一致。");
    }

    input.optimizedResume.projects.forEach((project) => {
      if (!projectNameSet.has(normalizeToken(project.name))) {
        warnings.push(`检测到原版本中不存在的项目：${project.name}`);
      }
    });

    input.optimizedResume.education.forEach((education) => {
      if (!educationSet.has(normalizeToken(education.school))) {
        warnings.push(`检测到原版本中不存在的学校：${education.school}`);
      }
    });

    input.optimizedResume.experiences.forEach((experience) => {
      if (!experienceSet.has(normalizeToken(experience.company))) {
        warnings.push(`检测到原版本中不存在的实习经历：${experience.company}`);
      }
    });

    input.optimizedResume.awards.forEach((award) => {
      if (!awardSet.has(normalizeToken(award.title))) {
        warnings.push(`检测到原版本中不存在的奖项：${award.title}`);
      }
    });

    input.optimizedResume.skills.forEach((group) => {
      group.items.forEach((skill) => {
        if (!skillSet.has(normalizeToken(skill))) {
          warnings.push(`检测到原版本中不存在的技能：${skill}`);
        }
      });
    });

    return {
      blocked: warnings.length > 0,
      warnings,
    };
  }

  inspectDiagnosisAppliedResume(input: {
    sourceResume: ResumeContentJson;
    updatedResume: ResumeContentJson;
  }): GuardrailInspectionResult {
    const warnings: string[] = [];
    const projectNameSet = collectProjectTokens(input.sourceResume);
    const educationSet = collectEducationTokens(input.sourceResume);
    const experienceSet = collectExperienceTokens(input.sourceResume);
    const awardSet = collectAwardTokens(input.sourceResume);
    const skillSet = collectSkillTokens(input.sourceResume);
    const sourceCorpus = buildResumeCorpus(input.sourceResume);

    if (
      normalizeToken(input.updatedResume.basic.name) !==
      normalizeToken(input.sourceResume.basic.name)
    ) {
      warnings.push("诊断应用结果中的姓名与原版本不一致。");
    }

    if (
      normalizeToken(input.updatedResume.basic.email) !==
      normalizeToken(input.sourceResume.basic.email)
    ) {
      warnings.push("诊断应用结果中的邮箱与原版本不一致。");
    }

    if (
      normalizeToken(input.updatedResume.basic.phone) !==
      normalizeToken(input.sourceResume.basic.phone)
    ) {
      warnings.push("诊断应用结果中的电话与原版本不一致。");
    }

    input.updatedResume.projects.forEach((project) => {
      if (!projectNameSet.has(normalizeToken(project.name))) {
        warnings.push(`检测到原版本中不存在的项目：${project.name}`);
      }
    });

    input.updatedResume.education.forEach((education) => {
      if (!educationSet.has(normalizeToken(education.school))) {
        warnings.push(`检测到原版本中不存在的学校：${education.school}`);
      }
    });

    input.updatedResume.experiences.forEach((experience) => {
      if (!experienceSet.has(normalizeToken(experience.company))) {
        warnings.push(`检测到原版本中不存在的实践经历：${experience.company}`);
      }
    });

    input.updatedResume.awards.forEach((award) => {
      if (!awardSet.has(normalizeToken(award.title))) {
        warnings.push(`检测到原版本中不存在的奖项：${award.title}`);
      }
    });

    input.updatedResume.skills.forEach((group) => {
      group.items.forEach((skill) => {
        const normalizedSkill = normalizeToken(skill);

        if (skillSet.has(normalizedSkill)) {
          return;
        }

        if (!sourceCorpus.includes(normalizedSkill)) {
          warnings.push(`检测到原版本中缺少证据的技能：${skill}`);
        }
      });
    });

    return {
      blocked: warnings.length > 0,
      warnings,
    };
  }
}

export const guardrailService = new GuardrailService();
