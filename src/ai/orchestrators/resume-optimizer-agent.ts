import { buildResumeOptimizerPrompts } from "@/ai/prompts/resume-optimizer";
import {
  type ResumeOptimizerStructuredResult,
  resumeOptimizerResultSchema,
} from "@/ai/schemas/resume-optimizer";
import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { renderResumeMarkdown } from "@/lib/resume-document";
import { aiService } from "@/services/ai-service";
import { guardrailService } from "@/services/guardrail-service";
import type { JDAnalysisRecord } from "@/types/jd";
import type {
  ResumeChangeSummary,
  ResumeContentJson,
} from "@/types/resume";

type ResumeOptimizerAgentInput = {
  sourceResume: ResumeContentJson;
  jdAnalysis: JDAnalysisRecord;
};

export type ResumeOptimizerAgentResult = {
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

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function containsToken(text: string, token: string) {
  return normalizeToken(text).includes(normalizeToken(token));
}

function buildResumeCorpus(content: ResumeContentJson) {
  return [
    content.basic.name,
    content.basic.targetRole ?? "",
    content.summary,
    ...content.education.flatMap((item) => [
      item.school,
      item.major,
      item.degree,
      ...item.highlights,
    ]),
    ...content.projects.flatMap((item) => [
      item.name,
      item.role,
      ...item.techStack,
      ...item.bullets,
    ]),
    ...content.experiences.flatMap((item) => [
      item.company,
      item.role,
      ...item.bullets,
    ]),
    ...content.skills.flatMap((item) => [item.category, ...item.items]),
    ...content.awards.flatMap((item) => [
      item.title,
      item.issuer ?? "",
      item.description ?? "",
    ]),
  ]
    .join("\n")
    .toLowerCase();
}

function getMatchedSkills(input: {
  sourceResume: ResumeContentJson;
  jdAnalysis: JDAnalysisRecord;
}) {
  const corpus = buildResumeCorpus(input.sourceResume);

  return dedupe(
    [...input.jdAnalysis.requiredSkills, ...input.jdAnalysis.parsedKeywords].filter(
      (keyword) => keyword.length >= 2 && corpus.includes(normalizeToken(keyword)),
    ),
  ).slice(0, 6);
}

function alignBulletWithSkills(bullet: string, skills: string[]) {
  const trimmedBullet = bullet.trim();

  if (!trimmedBullet || skills.length === 0) {
    return trimmedBullet;
  }

  if (skills.some((skill) => containsToken(trimmedBullet, skill))) {
    return trimmedBullet;
  }

  return `${trimmedBullet}，涉及 ${skills.slice(0, 2).join("、")} 技术实践`;
}

function buildTargetedSummary(input: {
  sourceResume: ResumeContentJson;
  jdAnalysis: JDAnalysisRecord;
  matchedSkills: string[];
}) {
  const targetRole =
    input.jdAnalysis.jobTitle ||
    input.sourceResume.basic.targetRole ||
    "目标岗位";
  const highlightSkills =
    input.matchedSkills.slice(0, 3).join("、") || "已有项目与技能经历";
  const responsibilityFocus =
    input.jdAnalysis.responsibilities[0]?.replace(/[。；;]+$/, "") ?? "岗位重点职责";

  if (input.sourceResume.summary.trim()) {
    const baseSummary = input.sourceResume.summary.trim().replace(/[。；;]+$/, "");

    return `${baseSummary}，本版重点对齐 ${targetRole} 所关注的 ${highlightSkills}，突出与 ${responsibilityFocus} 相关的实践表达。`;
  }

  return `围绕 ${targetRole} 方向整理现有经历，重点突出 ${highlightSkills}，并强化与 ${responsibilityFocus} 相关的可投递表达。`;
}

function buildFallbackOptimizedResume(input: {
  sourceResume: ResumeContentJson;
  jdAnalysis: JDAnalysisRecord;
}): ResumeOptimizerStructuredResult {
  const matchedSkills = getMatchedSkills(input);
  const optimizedResume: ResumeContentJson = {
    ...input.sourceResume,
    basic: {
      ...input.sourceResume.basic,
      targetRole:
        input.jdAnalysis.jobTitle || input.sourceResume.basic.targetRole || "",
    },
    summary: buildTargetedSummary({
      sourceResume: input.sourceResume,
      jdAnalysis: input.jdAnalysis,
      matchedSkills,
    }),
    projects: input.sourceResume.projects.map((project) => {
      const projectMatchedSkills = matchedSkills.filter(
        (skill) =>
          project.techStack.some((tech) => containsToken(tech, skill)) ||
          project.bullets.some((bullet) => containsToken(bullet, skill)),
      );

      if (projectMatchedSkills.length === 0) {
        return project;
      }

      const prioritizedTechStack = [
        ...project.techStack.filter((tech) =>
          projectMatchedSkills.some((skill) => containsToken(tech, skill)),
        ),
        ...project.techStack.filter(
          (tech) =>
            !projectMatchedSkills.some((skill) => containsToken(tech, skill)),
        ),
      ];

      return {
        ...project,
        techStack: dedupe(prioritizedTechStack),
        bullets: project.bullets.map((bullet, index) =>
          index === 0
            ? alignBulletWithSkills(bullet, projectMatchedSkills)
            : bullet.trim(),
        ),
      };
    }),
    experiences: input.sourceResume.experiences.map((experience) => {
      const experienceMatchedSkills = matchedSkills.filter((skill) =>
        experience.bullets.some((bullet) => containsToken(bullet, skill)),
      );

      if (experienceMatchedSkills.length === 0) {
        return experience;
      }

      return {
        ...experience,
        bullets: experience.bullets.map((bullet, index) =>
          index === 0
            ? alignBulletWithSkills(bullet, experienceMatchedSkills)
            : bullet.trim(),
        ),
      };
    }),
    skills: input.sourceResume.skills
      .map((group) => ({
        ...group,
        items: [
          ...group.items.filter((item) =>
            matchedSkills.some((skill) => containsToken(item, skill)),
          ),
          ...group.items.filter(
            (item) =>
              !matchedSkills.some((skill) => containsToken(item, skill)),
          ),
        ],
      }))
      .sort((left, right) => {
        const leftScore = left.items.filter((item) =>
          matchedSkills.some((skill) => containsToken(item, skill)),
        ).length;
        const rightScore = right.items.filter((item) =>
          matchedSkills.some((skill) => containsToken(item, skill)),
        ).length;

        return rightScore - leftScore;
      }),
  };
  const normalizedResume = resumeContentJsonSchema.parse(optimizedResume);

  const changeSummary: ResumeChangeSummary[] = [
    {
      type: "preserved",
      reason: "姓名、联系方式、教育经历、项目与实习事实均沿用原始版本，没有新增经历。",
      affectedSection: "basic / education / projects / experiences",
    },
    {
      type: "rewritten",
      reason: "对个人简介做岗位导向表达重写，强调当前版本更适合目标 JD 的投递语境。",
      affectedSection: "summary",
    },
  ];

  if (matchedSkills.length > 0) {
    changeSummary.push({
      type: "keyword_aligned",
      reason: `基于原有技术栈和经历表达，优先凸显 ${matchedSkills.slice(0, 4).join("、")} 等已具备的岗位关键词。`,
      affectedSection: "projects / experiences / skills",
    });
  }

  if (input.jdAnalysis.matchGaps.length > 0) {
    changeSummary.push({
      type: "needs_user_confirmation",
      reason: `JD 中仍有 ${input.jdAnalysis.matchGaps
        .slice(0, 4)
        .join("、")} 等要求缺少明确事实佐证，建议确认后再补充。`,
      affectedSection: "summary / skills",
    });
  }

  const warnings = dedupe([
    input.jdAnalysis.matchGaps.length > 0
      ? `以下关键词当前缺少明确事实支撑：${input.jdAnalysis.matchGaps
          .slice(0, 5)
          .join("、")}。`
      : "",
  ]);

  return {
    contentJson: normalizedResume,
    contentMarkdown: renderResumeMarkdown(normalizedResume),
    generationSummary: `已围绕 ${input.jdAnalysis.jobTitle || "目标岗位"} 对齐关键词表达，并生成新的岗位定制版本。`,
    changeSummary,
    warnings,
  };
}

class ResumeOptimizerAgent {
  async optimize({
    sourceResume,
    jdAnalysis,
  }: ResumeOptimizerAgentInput): Promise<ResumeOptimizerAgentResult> {
    const fallbackResult = buildFallbackOptimizedResume({
      sourceResume,
      jdAnalysis,
    });
    const prompts = buildResumeOptimizerPrompts({
      sourceResume,
      jdAnalysis,
    });
    const aiResult = await aiService.generateStructuredData({
      taskType: "resume_optimize",
      schema: resumeOptimizerResultSchema,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      fallback: () => fallbackResult,
    });
    let candidate: ResumeOptimizerStructuredResult = {
      ...aiResult.data,
      contentMarkdown: renderResumeMarkdown(aiResult.data.contentJson),
    };
    const guardrail = guardrailService.inspectOptimizedResume({
      sourceResume,
      optimizedResume: candidate.contentJson,
    });

    if (guardrail.blocked && !aiResult.meta.usedFallback) {
      candidate = {
        ...fallbackResult,
        warnings: dedupe([
          ...fallbackResult.warnings,
          ...guardrail.warnings,
          "检测到潜在事实漂移，系统已回退到规则优化结果。",
        ]),
      };
    } else {
      candidate = {
        ...candidate,
        warnings: dedupe([
          ...candidate.warnings,
          ...guardrail.warnings,
          aiResult.meta.usedFallback
            ? "当前未调用外部模型，已使用规则生成岗位定制版本。配置 OPENAI_API_KEY 后可启用模型优化。"
            : "",
        ]),
      };
    }

    return {
      contentJson: candidate.contentJson,
      contentMarkdown: renderResumeMarkdown(candidate.contentJson),
      generationSummary: candidate.generationSummary,
      changeSummary: candidate.changeSummary,
      warnings: candidate.warnings,
      meta: {
        provider: aiResult.meta.provider,
        model: aiResult.meta.model,
        usedFallback: aiResult.meta.usedFallback,
      },
    };
  }
}

export const resumeOptimizerAgent = new ResumeOptimizerAgent();
