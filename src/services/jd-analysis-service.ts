import type { Prisma } from "@prisma/client";

import { jdParserAgent } from "@/ai/orchestrators/jd-parser-agent";
import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { createEmptyResumeContent } from "@/lib/resume-document";
import { prisma } from "@/lib/db";
import type { JDAnalysisRecord } from "@/types/jd";
import type { ResumeContentJson } from "@/types/resume";

export type JDAnalysisStep = {
  title: string;
  description: string;
};

export class JDAnalysisServiceError extends Error {
  constructor(
    public readonly code:
      | "RESUME_NOT_FOUND"
      | "VERSION_NOT_FOUND"
      | "JD_ANALYSIS_NOT_FOUND",
  ) {
    super(code);
  }
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function parseResumeContent(rawValue: unknown): ResumeContentJson {
  const parsedValue = resumeContentJsonSchema.safeParse(rawValue);

  if (parsedValue.success) {
    return parsedValue.data;
  }

  return createEmptyResumeContent();
}

function sanitizeJdText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseLabelValue(line: string, labels: string[]) {
  const trimmedLine = line.trim();

  for (const label of labels) {
    const match = trimmedLine.match(
      new RegExp(`^(?:${label})[：:丨|\\-\\s]+(.+)$`, "i"),
    );

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function inferJobTitleFromJdText(jdText: string) {
  const lines = sanitizeJdText(jdText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labeledValue =
    lines
      .map((line) =>
        parseLabelValue(line, ["岗位", "职位", "招聘岗位", "目标岗位", "Job Title"]),
      )
      .find(Boolean) ?? "";

  if (labeledValue) {
    return labeledValue;
  }

  return (
    lines.find(
      (line) =>
        line.length >= 4 &&
        line.length <= 30 &&
        /(实习|工程师|开发|产品|运营|算法|数据|测试|设计|经理)/i.test(line),
    ) ?? ""
  );
}

function inferCompanyNameFromJdText(jdText: string) {
  const lines = sanitizeJdText(jdText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const labeledValue =
    lines
      .map((line) =>
        parseLabelValue(line, ["公司", "企业", "所属公司", "招聘公司", "Company"]),
      )
      .find(Boolean) ?? "";

  if (labeledValue) {
    return labeledValue;
  }

  const pairedLine = lines
    .slice(0, 5)
    .find((line) => /[|丨\-]/.test(line) && /(实习|工程师|开发|产品|运营)/i.test(line));

  if (!pairedLine) {
    return "";
  }

  const [firstPart, secondPart] = pairedLine
    .split(/[|丨\-]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!secondPart) {
    return "";
  }

  return /(有限公司|科技|网络|信息|工作室|集团|公司)/.test(firstPart)
    ? firstPart
    : /(有限公司|科技|网络|信息|工作室|集团|公司)/.test(secondPart)
      ? secondPart
      : "";
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

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function computeMatchGaps(input: {
  resumeContent: ResumeContentJson;
  requiredSkills: string[];
  parsedKeywords: string[];
}) {
  const resumeCorpus = buildResumeCorpus(input.resumeContent);

  return dedupe([...input.requiredSkills, ...input.parsedKeywords]).filter(
    (keyword) =>
      keyword.length >= 2 && !resumeCorpus.includes(keyword.toLowerCase()),
  );
}

class JDAnalysisService {
  getInitializationSteps(): JDAnalysisStep[] {
    return [
      {
        title: "JD 文本清洗",
        description: "清理换行、异常符号与注入式文本噪音，为解析做结构化预处理。",
      },
      {
        title: "关键词与职责提取",
        description: "生成岗位名称、职责、技能要求和可用于优化的核心关键词。",
      },
      {
        title: "匹配差距落表",
        description: "结合当前简历版本计算 match gaps，并持久化到 jd_analyses 供后续优化复用。",
      },
    ];
  }

  async getLatestAnalysis(
    userId: string,
    resumeId: string,
    resumeVersionId: string,
  ): Promise<JDAnalysisRecord | null> {
    const analysis = await prisma.jDAnalysis.findFirst({
      where: {
        userId,
        resumeVersionId,
        resumeVersion: {
          resumeId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return analysis ? this.mapAnalysisRecord(analysis) : null;
  }

  async getAnalysisById(
    userId: string,
    resumeId: string,
    resumeVersionId: string,
    analysisId: string,
  ): Promise<JDAnalysisRecord> {
    const analysis = await prisma.jDAnalysis.findFirst({
      where: {
        id: analysisId,
        userId,
        resumeVersionId,
        resumeVersion: {
          resumeId,
        },
      },
    });

    if (!analysis) {
      throw new JDAnalysisServiceError("JD_ANALYSIS_NOT_FOUND");
    }

    return this.mapAnalysisRecord(analysis);
  }

  async parseForVersion(input: {
    userId: string;
    resumeId: string;
    resumeVersionId: string;
    jdText: string;
  }): Promise<JDAnalysisRecord> {
    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: input.resumeVersionId,
        resumeId: input.resumeId,
        userId: input.userId,
      },
      select: {
        id: true,
        contentJson: true,
      },
    });

    if (!sourceVersion) {
      const resume = await prisma.resume.findFirst({
        where: {
          id: input.resumeId,
          userId: input.userId,
        },
        select: {
          id: true,
        },
      });

      throw new JDAnalysisServiceError(resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND");
    }

    const parsedResume = parseResumeContent(sourceVersion.contentJson);
    const jdResult = await jdParserAgent.parse({
      jdText: input.jdText,
    });
    const matchGaps = computeMatchGaps({
      resumeContent: parsedResume,
      requiredSkills: jdResult.requiredSkills,
      parsedKeywords: jdResult.parsedKeywords,
    }).slice(0, 8);
    const analysis = await prisma.jDAnalysis.create({
      data: {
        userId: input.userId,
        resumeVersionId: input.resumeVersionId,
        rawJdText: sanitizeJdText(input.jdText),
        parsedKeywords: toJsonValue(jdResult.parsedKeywords),
        responsibilities: toJsonValue(jdResult.responsibilities),
        requiredSkills: toJsonValue(jdResult.requiredSkills),
        matchGaps: toJsonValue(matchGaps),
        modelName: jdResult.meta.model,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        actionType: "JD_PARSED",
        resourceType: "JD_ANALYSIS",
        resourceId: analysis.id,
        payload: {
          resumeId: input.resumeId,
          resumeVersionId: input.resumeVersionId,
        },
      },
    });

    return {
      id: analysis.id,
      resumeVersionId: analysis.resumeVersionId,
      rawJdText: analysis.rawJdText,
      jobTitle: jdResult.jobTitle || inferJobTitleFromJdText(analysis.rawJdText),
      companyName:
        jdResult.companyName || inferCompanyNameFromJdText(analysis.rawJdText),
      parsedKeywords: jdResult.parsedKeywords,
      responsibilities: jdResult.responsibilities,
      requiredSkills: jdResult.requiredSkills,
      matchGaps,
      modelName: analysis.modelName,
      createdAt: analysis.createdAt.toISOString(),
    };
  }

  private mapAnalysisRecord(analysis: {
    id: string;
    resumeVersionId: string;
    rawJdText: string;
    parsedKeywords: unknown;
    responsibilities: unknown;
    requiredSkills: unknown;
    matchGaps: unknown;
    modelName: string | null;
    createdAt: Date;
  }): JDAnalysisRecord {
    return {
      id: analysis.id,
      resumeVersionId: analysis.resumeVersionId,
      rawJdText: analysis.rawJdText,
      jobTitle: inferJobTitleFromJdText(analysis.rawJdText),
      companyName: inferCompanyNameFromJdText(analysis.rawJdText),
      parsedKeywords: parseStringArray(analysis.parsedKeywords),
      responsibilities: parseStringArray(analysis.responsibilities),
      requiredSkills: parseStringArray(analysis.requiredSkills),
      matchGaps: parseStringArray(analysis.matchGaps),
      modelName: analysis.modelName,
      createdAt: analysis.createdAt.toISOString(),
    };
  }
}

export const jdAnalysisService = new JDAnalysisService();
