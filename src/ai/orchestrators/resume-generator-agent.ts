import { buildResumeGeneratorPrompts } from "@/ai/prompts/resume-generator";
import {
  type NormalizedProfileSnapshot,
  profileNormalizerAgent,
} from "@/ai/orchestrators/profile-normalizer-agent";
import { resumeGeneratorResultSchema } from "@/ai/schemas/resume-generator";
import { renderResumeMarkdown } from "@/lib/resume-document";
import { aiService } from "@/services/ai-service";
import { guardrailService } from "@/services/guardrail-service";
import type { ProfileSnapshot } from "@/types/profile";
import type {
  ResumeChangeSummary,
  ResumeContentJson,
  ResumeGenerationStyle,
} from "@/types/resume";
import { resumeGenerationStyleOptions } from "@/types/resume";

type ResumeGeneratorAgentInput = {
  userId: string;
  profileSnapshot: ProfileSnapshot;
  style: ResumeGenerationStyle;
};

export type ResumeGeneratorAgentResult = {
  contentJson: ResumeContentJson;
  contentMarkdown: string;
  generationSummary: string;
  changeSummary: ResumeChangeSummary[];
  warnings: string[];
  meta: {
    provider: string;
    model: string;
    usedFallback: boolean;
  };
};

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildSkills(snapshot: NormalizedProfileSnapshot) {
  const categoryMap = new Map<string, string[]>();

  snapshot.skills.forEach((skill) => {
    const category = skill.category || "其他";
    const nextItems = categoryMap.get(category) ?? [];

    nextItems.push(skill.name);
    categoryMap.set(category, nextItems);
  });

  return Array.from(categoryMap.entries()).map(([category, items]) => ({
    category,
    items: uniqueValues(items),
  }));
}

function buildFallbackResume(
  snapshot: NormalizedProfileSnapshot,
  style: ResumeGenerationStyle,
) {
  const styleOption =
    resumeGenerationStyleOptions.find((item) => item.id === style) ??
    resumeGenerationStyleOptions[0];
  const skills = buildSkills(snapshot);
  const missingSignals = [
    snapshot.basic.targetRole ? "" : "目标岗位",
    snapshot.basic.summary ? "" : "个人简介",
    snapshot.projects.length === 0 && snapshot.experiences.length === 0
      ? "项目或实习经历"
      : "",
    snapshot.projects.some((project) => project.bullets.length === 0) ||
    snapshot.experiences.some((experience) => experience.bullets.length === 0)
      ? "经历里的职责/结果要点"
      : "",
  ].filter(Boolean);

  const summary = snapshot.basic.summary
    ? snapshot.basic.summary
    : [
        snapshot.basic.targetRole
          ? `围绕 ${snapshot.basic.targetRole} 方向组织母版简历内容`
          : "围绕校招 / 实习投递场景组织母版简历内容",
        snapshot.projects.length > 0
          ? `已整理 ${snapshot.projects.length} 段项目经历`
          : "项目经历仍需继续补充",
        snapshot.experiences.length > 0
          ? `沉淀 ${snapshot.experiences.length} 段实习经历`
          : "实习经历可按需补充",
        snapshot.skills.length > 0
          ? `沉淀 ${snapshot.skills.length} 项技能标签`
          : "技能清单仍需继续补充",
      ].join("；");

  const contentJson: ResumeContentJson = {
    basic: {
      name: snapshot.basic.fullName,
      phone: snapshot.basic.phone,
      email: snapshot.basic.email,
      city: snapshot.basic.city,
      targetRole: snapshot.basic.targetRole,
      homepageUrl: snapshot.basic.homepageUrl,
      githubUrl: snapshot.basic.githubUrl,
    },
    summary,
    education: snapshot.educations.map((education) => ({
      school: education.schoolName,
      major: education.major,
      degree: education.degree,
      startDate: education.startDate,
      endDate: education.endDate,
      highlights: education.highlights,
    })),
    projects: snapshot.projects.map((project) => ({
      name: project.name,
      role: project.role,
      startDate: project.startDate,
      endDate: project.endDate,
      techStack: project.techStack,
      bullets: project.bullets,
    })),
    experiences: snapshot.experiences.map((experience) => ({
      company: experience.companyName,
      role: experience.jobTitle,
      startDate: experience.startDate,
      endDate: experience.endDate,
      bullets: experience.bullets,
    })),
    awards: snapshot.awards.map((award) => ({
      title: award.title,
      issuer: award.issuer,
      awardDate: award.awardDate,
      description: award.description,
    })),
    skills,
  };

  const changeSummary: ResumeChangeSummary[] = [
    {
      type: "preserved",
      reason: "基本信息、教育经历、项目经历、实习经历和奖项事实直接来自建档资料快照。",
      affectedSection: "basic / education / projects / experiences / awards",
    },
    {
      type: "rewritten",
      reason: `按 ${styleOption.label} 整理模块顺序与表达密度，便于继续编辑和后续投递。`,
      affectedSection: "summary",
    },
  ];

  if (missingSignals.length > 0) {
    changeSummary.push({
      type: "needs_user_confirmation",
      reason: `当前仍缺少 ${missingSignals.join("、")}，建议继续补充后再迭代母版。`,
      affectedSection: "summary / projects / experiences",
    });
  }

  const warnings = uniqueValues([
    missingSignals.length > 0
      ? `仍建议补充：${missingSignals.join("、")}。`
      : "",
  ]);

  return {
    contentJson,
    contentMarkdown: renderResumeMarkdown(contentJson),
    generationSummary: `已基于 ${snapshot.educations.length} 条教育经历、${snapshot.projects.length} 条项目经历、${snapshot.experiences.length} 条实习经历、${snapshot.awards.length} 条奖项记录和 ${snapshot.skills.length} 项技能，生成 ${styleOption.label} 母版简历。`,
    changeSummary,
    warnings,
  };
}

class ResumeGeneratorAgent {
  async generate({
    userId,
    profileSnapshot,
    style,
  }: ResumeGeneratorAgentInput): Promise<ResumeGeneratorAgentResult> {
    const normalizedSnapshot = profileNormalizerAgent.normalize(profileSnapshot);
    const fallbackResult = buildFallbackResume(normalizedSnapshot, style);
    const prompts = buildResumeGeneratorPrompts({
      snapshot: normalizedSnapshot,
      style,
    });
    const aiResult = await aiService.generateStructuredData({
      userId,
      taskType: "resume_generate",
      schema: resumeGeneratorResultSchema,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      fallback: () => fallbackResult,
    });

    let candidate = {
      ...aiResult.data,
      contentMarkdown: renderResumeMarkdown(aiResult.data.contentJson),
    };
    const guardrail = guardrailService.inspectGeneratedResume({
      snapshot: normalizedSnapshot,
      generatedResume: candidate.contentJson,
    });

    if (guardrail.blocked && !aiResult.meta.usedFallback) {
      candidate = {
        ...fallbackResult,
        warnings: uniqueValues([
          ...fallbackResult.warnings,
          ...guardrail.warnings,
          "检测到潜在事实漂移，系统已回退为规则生成结果。",
        ]),
      };
    } else {
      candidate = {
        ...candidate,
        warnings: uniqueValues([
          ...candidate.warnings,
          ...guardrail.warnings,
          aiResult.meta.usedFallback
            ? "当前未调用外部模型，已使用规则生成母版。配置 OPENAI_API_KEY 后可启用模型润色。"
            : "",
        ]),
      };
    }

    return {
      ...candidate,
      contentMarkdown: renderResumeMarkdown(candidate.contentJson),
      meta: {
        provider: aiResult.meta.provider,
        model: aiResult.meta.model,
        usedFallback: aiResult.meta.usedFallback,
      },
    };
  }
}

export const resumeGeneratorAgent = new ResumeGeneratorAgent();
