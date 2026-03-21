import { buildJdParserPrompts } from "@/ai/prompts/jd-parser";
import { jdParserResultSchema } from "@/ai/schemas/jd-parser";
import { aiService } from "@/services/ai-service";

const knownSkillKeywords = [
  "React",
  "Vue",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "HTML",
  "CSS",
  "Tailwind",
  "Node.js",
  "Express",
  "NestJS",
  "Java",
  "Spring Boot",
  "Python",
  "Go",
  "C++",
  "SQL",
  "MySQL",
  "PostgreSQL",
  "Redis",
  "MongoDB",
  "Docker",
  "Kubernetes",
  "Git",
  "Linux",
  "Pandas",
  "NumPy",
  "PyTorch",
  "TensorFlow",
  "机器学习",
  "深度学习",
  "数据分析",
  "大模型",
  "LLM",
  "Prompt Engineering",
  "LangChain",
  "RAG",
  "接口设计",
  "系统设计",
  "前端开发",
  "后端开发",
  "全栈开发",
  "测试开发",
  "产品设计",
  "沟通协作",
  "团队协作",
  "问题定位",
  "性能优化",
];

type JdParserAgentInput = {
  jdText: string;
};

export type JdParserAgentResult = {
  jobTitle: string;
  companyName: string;
  parsedKeywords: string[];
  responsibilities: string[];
  requiredSkills: string[];
  meta: {
    provider: string;
    model: string;
    usedFallback: boolean;
  };
};

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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

function inferJobTitle(lines: string[]) {
  const labelValue =
    lines
      .map((line) =>
        parseLabelValue(line, ["岗位", "职位", "招聘岗位", "目标岗位", "Job Title"]),
      )
      .find(Boolean) ?? "";

  if (labelValue) {
    return labelValue;
  }

  const fallbackLine = lines.find((line) => {
    const trimmed = line.trim();

    return (
      trimmed.length >= 4 &&
      trimmed.length <= 30 &&
      /(实习|工程师|开发|产品|运营|算法|数据|测试|设计|经理)/i.test(trimmed)
    );
  });

  return fallbackLine?.trim() ?? "";
}

function inferCompanyName(lines: string[]) {
  const labelValue =
    lines
      .map((line) =>
        parseLabelValue(line, ["公司", "企业", "所属公司", "招聘公司", "Company"]),
      )
      .find(Boolean) ?? "";

  if (labelValue) {
    return labelValue;
  }

  const pairedLine = lines
    .slice(0, 5)
    .map((line) => line.trim())
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

function extractResponsibilities(lines: string[]) {
  const directList = lines
    .map((line) => line.replace(/^[\-\d.、*•\s]+/, "").trim())
    .filter(
      (line) =>
        line.length >= 10 &&
        line.length <= 120 &&
        /(负责|参与|支持|推动|完成|设计|开发|优化|协作|维护|搭建|分析|跟进)/.test(
          line,
        ),
    );

  if (directList.length > 0) {
    return dedupe(directList).slice(0, 6);
  }

  const sentenceList = sanitizeJdText(lines.join("\n"))
    .split(/[。；;\n]/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length >= 10 &&
        line.length <= 100 &&
        /(负责|参与|支持|推动|完成|设计|开发|优化|协作|维护|搭建|分析|跟进)/.test(
          line,
        ),
    );

  return dedupe(sentenceList).slice(0, 6);
}

function extractRequiredSkills(jdText: string) {
  const lowerText = jdText.toLowerCase();
  const matchedSkills = knownSkillKeywords.filter((skill) =>
    lowerText.includes(skill.toLowerCase()),
  );
  const englishTokens = jdText.match(/\b[A-Za-z][A-Za-z0-9.+#/-]{1,24}\b/g) ?? [];
  const extraTokens = englishTokens.filter((token) => token.length >= 3);

  return dedupe([...matchedSkills, ...extraTokens]).slice(0, 12);
}

function extractKeywords(input: {
  jdText: string;
  jobTitle: string;
  requiredSkills: string[];
  responsibilities: string[];
}) {
  const keywordPool = [
    input.jobTitle,
    ...input.requiredSkills,
    ...input.responsibilities.flatMap((item) =>
      item.split(/[，,、/\s]/).filter((token) => token.length >= 2),
    ),
  ];

  const matchedCommonTerms = [
    "校招",
    "实习",
    "业务理解",
    "工程化",
    "跨团队协作",
    "性能优化",
    "需求分析",
    "数据驱动",
    "结果导向",
    "用户体验",
    "系统设计",
    "全栈",
    "前端",
    "后端",
    "AI 应用",
    "大模型应用",
  ].filter((term) => input.jdText.includes(term));

  return dedupe([...keywordPool, ...matchedCommonTerms]).slice(0, 16);
}

function buildFallbackJdAnalysis(jdText: string) {
  const sanitizedText = sanitizeJdText(jdText);
  const lines = sanitizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const jobTitle = inferJobTitle(lines);
  const companyName = inferCompanyName(lines);
  const responsibilities = extractResponsibilities(lines);
  const requiredSkills = extractRequiredSkills(sanitizedText);
  const parsedKeywords = extractKeywords({
    jdText: sanitizedText,
    jobTitle,
    requiredSkills,
    responsibilities,
  });

  return {
    jobTitle,
    companyName,
    parsedKeywords,
    responsibilities,
    requiredSkills,
  };
}

class JdParserAgent {
  async parse({
    jdText,
  }: JdParserAgentInput): Promise<JdParserAgentResult> {
    const sanitizedText = sanitizeJdText(jdText);
    const fallbackResult = buildFallbackJdAnalysis(sanitizedText);
    const prompts = buildJdParserPrompts({
      jdText: sanitizedText,
    });
    const aiResult = await aiService.generateStructuredData({
      taskType: "jd_parse",
      schema: jdParserResultSchema,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      fallback: () => fallbackResult,
    });

    return {
      ...aiResult.data,
      parsedKeywords: dedupe(aiResult.data.parsedKeywords),
      responsibilities: dedupe(aiResult.data.responsibilities),
      requiredSkills: dedupe(aiResult.data.requiredSkills),
      meta: {
        provider: aiResult.meta.provider,
        model: aiResult.meta.model,
        usedFallback: aiResult.meta.usedFallback,
      },
    };
  }
}

export const jdParserAgent = new JdParserAgent();
