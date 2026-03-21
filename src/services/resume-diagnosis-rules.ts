import type { JDAnalysisRecord } from "@/types/jd";
import type {
  DiagnosisCategory,
  DiagnosisIssueRecord,
  DiagnosisRuleResult,
  DiagnosisScoreOverview,
  DiagnosisSeverity,
  DiagnosisSuggestionRecord,
} from "@/types/diagnosis";
import type { ResumeContentJson } from "@/types/resume";

type RuleDiagnosisInput = {
  sourceResume: ResumeContentJson;
  jdAnalysis: JDAnalysisRecord | null;
};

type RuleBuilder = {
  addIssue: (issue: DiagnosisIssueRecord) => void;
  addSuggestion: (suggestion: DiagnosisSuggestionRecord) => void;
};

const genericSummaryPattern =
  /(热爱|积极|责任心|学习能力|沟通能力|团队合作|抗压|执行力|自驱|踏实)/;

const weakBulletPattern =
  /^(负责|参与|协助|学习|熟悉|了解|使用|完成|跟进|支持)(?!.*[，。；;])/;

const resultSignalPattern =
  /(\d+[%+]?|提升|优化|降低|增长|完成|落地|交付|搭建|重构|迭代|上线|沉淀|缩短|提高)/;

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function containsToken(text: string, token: string) {
  return normalizeToken(text).includes(normalizeToken(token));
}

function createIssue(input: {
  id: string;
  category: DiagnosisCategory;
  issueType: string;
  severity: DiagnosisSeverity;
  title: string;
  evidence: string;
  suggestion: string;
}): DiagnosisIssueRecord {
  return {
    ...input,
    source: "rule",
  };
}

function createSuggestion(
  suggestion: DiagnosisSuggestionRecord,
): DiagnosisSuggestionRecord {
  return suggestion;
}

function flattenSkills(content: ResumeContentJson) {
  return dedupe(content.skills.flatMap((group) => group.items));
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
    ...content.awards.flatMap((item) => [
      item.title,
      item.issuer ?? "",
      item.description ?? "",
    ]),
  ]
    .join("\n")
    .toLowerCase();
}

function collectBullets(content: ResumeContentJson) {
  return [
    ...content.projects.flatMap((project) =>
      project.bullets.map((bullet) => ({
        section: `项目：${project.name}`,
        bullet: bullet.trim(),
      })),
    ),
    ...content.experiences.flatMap((experience) =>
      experience.bullets.map((bullet) => ({
        section: `经历：${experience.company}`,
        bullet: bullet.trim(),
      })),
    ),
  ].filter((item) => item.bullet);
}

function collectItemsMissingDates(content: ResumeContentJson) {
  return [
    ...content.education
      .filter((item) => !item.startDate.trim() || !item.endDate.trim())
      .map((item) => `教育：${item.school}`),
    ...content.projects
      .filter((item) => !item.startDate.trim() || !item.endDate.trim())
      .map((item) => `项目：${item.name}`),
    ...content.experiences
      .filter((item) => !item.startDate.trim() || !item.endDate.trim())
      .map((item) => `经历：${item.company}`),
  ];
}

function buildSummaryRewrite(content: ResumeContentJson, jdAnalysis: JDAnalysisRecord | null) {
  const targetRole =
    jdAnalysis?.jobTitle || content.basic.targetRole?.trim() || "目标岗位";
  const projectCount = content.projects.length;
  const experienceCount = content.experiences.length;
  const skillHighlights =
    flattenSkills(content).slice(0, 3).join("、") || "项目实践与基础技能";
  const experienceParts = [
    projectCount > 0 ? `${projectCount} 段项目经历` : "",
    experienceCount > 0 ? `${experienceCount} 段实践经历` : "",
  ].filter(Boolean);

  return `围绕 ${targetRole} 方向整理现有经历，${experienceParts.length > 0 ? `已沉淀 ${experienceParts.join("和")}，` : ""}内容涉及 ${skillHighlights}，当前版本优先突出真实经历中的岗位相关表达。`;
}

function collectEvidencedKeywordsMissingFromSkills(input: RuleDiagnosisInput) {
  if (!input.jdAnalysis) {
    return [];
  }

  const corpus = buildResumeCorpus(input.sourceResume);
  const skillSet = new Set(flattenSkills(input.sourceResume).map(normalizeToken));

  return dedupe([
    ...input.jdAnalysis.requiredSkills,
    ...input.jdAnalysis.parsedKeywords,
  ]).filter((keyword) => {
    if (keyword.length < 2) {
      return false;
    }

    return corpus.includes(normalizeToken(keyword)) && !skillSet.has(normalizeToken(keyword));
  });
}

function buildScoreOverview(issues: DiagnosisIssueRecord[]): DiagnosisScoreOverview {
  const penalties = {
    high: 18,
    medium: 10,
    low: 5,
  } as const;
  const categories = ["content", "expression", "structure", "match", "ats"] as const;
  const categoryScores = categories.reduce<Record<(typeof categories)[number], number>>(
    (result, category) => {
      const totalPenalty = issues
        .filter((issue) => issue.category === category)
        .reduce((sum, issue) => sum + penalties[issue.severity], 0);

      result[category] = Math.max(45, 100 - totalPenalty);
      return result;
    },
    {
      content: 100,
      expression: 100,
      structure: 100,
      match: 100,
      ats: 100,
    },
  );
  const overall = Math.round(
    (categoryScores.content +
      categoryScores.expression +
      categoryScores.structure +
      categoryScores.match +
      categoryScores.ats) /
      categories.length,
  );
  const weakestCategories = categories
    .map((category) => ({
      category,
      score: categoryScores[category],
    }))
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .filter((item) => item.score < 100)
    .map((item) => {
      switch (item.category) {
        case "content":
          return "内容完整度";
        case "expression":
          return "表达质量";
        case "structure":
          return "结构完整性";
        case "match":
          return "岗位匹配度";
        case "ats":
          return "ATS 友好度";
        default:
          return item.category;
      }
    });

  return {
    overall,
    content: categoryScores.content,
    expression: categoryScores.expression,
    structure: categoryScores.structure,
    match: categoryScores.match,
    ats: categoryScores.ats,
    summary:
      weakestCategories.length > 0
        ? `当前优先改进 ${weakestCategories.join(" 和 ")}，先补齐高优先级问题后再继续细化表达。`
        : "当前版本结构较完整，可以继续做针对岗位的细节润色。",
  };
}

function runBaseRules(input: RuleDiagnosisInput, builder: RuleBuilder) {
  const { sourceResume, jdAnalysis } = input;
  const bullets = collectBullets(sourceResume);
  const weakBullets = bullets.filter(
    (item) => item.bullet.length < 14 || weakBulletPattern.test(item.bullet),
  );
  const weakResultBullets = bullets.filter(
    (item) => !resultSignalPattern.test(item.bullet),
  );
  const missingDateItems = collectItemsMissingDates(sourceResume);
  const missingEvidencedSkills = collectEvidencedKeywordsMissingFromSkills(input);

  if (!sourceResume.basic.targetRole?.trim()) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-target-role",
        category: "content",
        issueType: "missing_target_role",
        severity: "medium",
        title: "缺少目标岗位",
        evidence: "简历头部尚未明确写出目标岗位，招聘方需要自行判断投递方向。",
        suggestion: "补充目标岗位，让整份简历的岗位导向更清晰。",
      }),
    );

    if (jdAnalysis?.jobTitle) {
      builder.addSuggestion(
        createSuggestion({
          id: "suggest-set-target-role",
          category: "match",
          title: "将目标岗位对齐到当前 JD",
          rationale: `可以直接把目标岗位更新为“${jdAnalysis.jobTitle}”，减少岗位方向的理解成本。`,
          actionText: "应用岗位标题",
          canAutoApply: true,
          requiresUserConfirmation: false,
          issueIds: ["rule-missing-target-role"],
          patch: {
            actionType: "set_target_role",
            targetRole: jdAnalysis.jobTitle,
          },
        }),
      );
    }
  }

  if (!sourceResume.summary.trim()) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-summary",
        category: "content",
        issueType: "missing_summary",
        severity: "high",
        title: "缺少个人摘要",
        evidence: "当前简历没有个人摘要，难以在开头快速说明投递方向和经历范围。",
        suggestion: "补一段 1 到 2 句的岗位导向摘要，概括方向、经历范围和核心技能。",
      }),
    );

    builder.addSuggestion(
      createSuggestion({
        id: "suggest-rewrite-summary",
        category: "expression",
        title: "生成一段基础摘要",
        rationale: "先补一个事实边界内的基础摘要，再继续人工细化会更高效。",
        actionText: "应用摘要草稿",
        canAutoApply: true,
        requiresUserConfirmation: false,
        issueIds: ["rule-missing-summary"],
        patch: {
          actionType: "rewrite_summary",
          summary: buildSummaryRewrite(sourceResume, jdAnalysis),
        },
      }),
    );
  } else {
    const summary = sourceResume.summary.trim();

    if (summary.length < 36 || (summary.length < 90 && genericSummaryPattern.test(summary))) {
      builder.addIssue(
        createIssue({
          id: "rule-summary-too-generic",
          category: "expression",
          issueType: "summary_too_generic",
          severity: "medium",
          title: "个人摘要偏空泛",
          evidence: `当前摘要为“${summary.slice(0, 80)}${summary.length > 80 ? "..." : ""}”，缺少更明确的岗位导向或经历信息。`,
          suggestion: "把摘要改成更贴近岗位的事实性表述，避免空话和泛泛自评。",
        }),
      );

      builder.addSuggestion(
        createSuggestion({
          id: "suggest-rewrite-summary",
          category: "expression",
          title: "用岗位导向语气重写摘要",
          rationale: "保留真实信息不变，只把摘要改写成更适合投递的表述。",
          actionText: "应用摘要改写",
          canAutoApply: true,
          requiresUserConfirmation: false,
          issueIds: ["rule-summary-too-generic"],
          patch: {
            actionType: "rewrite_summary",
            summary: buildSummaryRewrite(sourceResume, jdAnalysis),
          },
        }),
      );
    } else if (summary.length > 140) {
      builder.addIssue(
        createIssue({
          id: "rule-summary-too-long",
          category: "ats",
          issueType: "summary_too_long",
          severity: "low",
          title: "个人摘要略长",
          evidence: `当前摘要长度约 ${summary.length} 字，首屏信息密度偏高。`,
          suggestion: "压缩成 1 到 2 句，把位置留给更强的项目和经历证据。",
        }),
      );
    }
  }

  if (sourceResume.projects.length === 0 && sourceResume.experiences.length === 0) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-core-experience",
        category: "content",
        issueType: "missing_core_experience",
        severity: "high",
        title: "缺少项目或实践经历",
        evidence: "当前简历既没有项目经历，也没有实践/实习经历，缺少主要投递证据。",
        suggestion: "至少补充一段项目或实践经历，再继续做岗位化诊断。",
      }),
    );
  }

  if (sourceResume.skills.length === 0 || flattenSkills(sourceResume).length === 0) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-skills",
        category: "structure",
        issueType: "missing_skills_section",
        severity: "high",
        title: "技能清单缺失",
        evidence: "当前版本没有有效的技能清单，ATS 难以稳定抽取关键词。",
        suggestion: "补充成组的技能标签，至少覆盖语言、框架或工具。",
      }),
    );
  }

  if (missingDateItems.length > 0) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-dates",
        category: "structure",
        issueType: "missing_dates",
        severity: "medium",
        title: "部分经历时间不完整",
        evidence: `以下条目缺少起止时间：${missingDateItems.slice(0, 3).join("、")}。`,
        suggestion: "补齐时间范围，避免被误判为经历信息不完整。",
      }),
    );

    builder.addSuggestion(
      createSuggestion({
        id: "suggest-fill-dates-manually",
        category: "structure",
        title: "回到编辑页补齐时间",
        rationale: "时间字段需要人工确认，系统不应代填。",
        actionText: "手动补齐",
        canAutoApply: false,
        requiresUserConfirmation: true,
        issueIds: ["rule-missing-dates"],
      }),
    );
  }

  if (weakBullets.length > 0) {
    const example = weakBullets[0];

    builder.addIssue(
      createIssue({
        id: "rule-weak-bullets",
        category: "expression",
        issueType: "weak_bullet",
        severity: "medium",
        title: "部分经历描述偏弱",
        evidence: `${example.section} 中有描述“${example.bullet}”，信息量不足或过于口语化。`,
        suggestion: "优先改成“做了什么 + 如何做 + 结果/影响”的表达结构。",
      }),
    );

    builder.addSuggestion(
      createSuggestion({
        id: "suggest-tighten-bullets-manually",
        category: "expression",
        title: "重点重写弱描述条目",
        rationale: "这些条目最影响说服力，建议优先人工补充动作、场景和结果。",
        actionText: "去编辑页处理",
        canAutoApply: false,
        requiresUserConfirmation: true,
        issueIds: ["rule-weak-bullets"],
      }),
    );
  }

  if (bullets.length > 0 && weakResultBullets.length / bullets.length >= 0.65) {
    builder.addIssue(
      createIssue({
        id: "rule-weak-result-orientation",
        category: "expression",
        issueType: "weak_result_orientation",
        severity: "low",
        title: "结果导向表达偏少",
        evidence: "多数项目或实践 bullet 仍以职责描述为主，较少体现结果、交付或优化效果。",
        suggestion: "挑 2 到 3 条最重要经历，补上结果、改进或交付信号。",
      }),
    );
  }

  if (!sourceResume.basic.phone.trim() || !sourceResume.basic.email.trim()) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-contact",
        category: "ats",
        issueType: "missing_contact",
        severity: "high",
        title: "联系方式不完整",
        evidence: "手机号或邮箱缺失，直接影响联系与 ATS 基础识别。",
        suggestion: "补齐手机号和邮箱后再导出投递版。",
      }),
    );
  }

  if (missingEvidencedSkills.length > 0) {
    builder.addIssue(
      createIssue({
        id: "rule-missing-evidenced-skills",
        category: "ats",
        issueType: "missing_evidenced_keywords",
        severity: "medium",
        title: "技能标签没有承接已出现的关键词",
        evidence: `正文里已经出现 ${missingEvidencedSkills.slice(0, 4).join("、")}，但技能清单没有显式列出。`,
        suggestion: "把已在经历中出现的关键词补进技能清单，提升 ATS 可检索性。",
      }),
    );

    builder.addSuggestion(
      createSuggestion({
        id: "suggest-append-skill-keywords",
        category: "ats",
        title: "把已有关键词补进技能清单",
        rationale: "这些关键词已经在当前简历里出现，补入技能清单不会越过事实边界。",
        actionText: "应用技能补充",
        canAutoApply: true,
        requiresUserConfirmation: false,
        issueIds: ["rule-missing-evidenced-skills"],
        patch: {
          actionType: "append_skill_keywords",
          category: "岗位相关技能",
          skills: missingEvidencedSkills.slice(0, 6),
        },
      }),
    );
  }
}

function runJdRules(input: RuleDiagnosisInput, builder: RuleBuilder) {
  const { sourceResume, jdAnalysis } = input;

  if (!jdAnalysis) {
    return;
  }

  const normalizedTargetRole = normalizeToken(sourceResume.basic.targetRole ?? "");
  const normalizedJobTitle = normalizeToken(jdAnalysis.jobTitle);

  if (
    normalizedTargetRole &&
    normalizedJobTitle &&
    !containsToken(normalizedTargetRole, normalizedJobTitle) &&
    !containsToken(normalizedJobTitle, normalizedTargetRole)
  ) {
    builder.addIssue(
      createIssue({
        id: "rule-target-role-misaligned",
        category: "match",
        issueType: "target_role_misaligned",
        severity: "medium",
        title: "目标岗位与当前 JD 不够对齐",
        evidence: `简历目标岗位为“${sourceResume.basic.targetRole ?? ""}”，但当前 JD 识别到的岗位是“${jdAnalysis.jobTitle}”。`,
        suggestion: "确认是否为同一投递方向，必要时单独维护岗位版本。",
      }),
    );
  }

  if (jdAnalysis.matchGaps.length > 0) {
    builder.addIssue(
      createIssue({
        id: "rule-jd-match-gaps",
        category: "match",
        issueType: "jd_match_gap",
        severity: jdAnalysis.matchGaps.length >= 4 ? "high" : "medium",
        title: "当前版本对 JD 的覆盖仍有缺口",
        evidence: `最近一次 JD 分析仍缺少 ${jdAnalysis.matchGaps.slice(0, 5).join("、")} 等关键词或能力证据。`,
        suggestion: "优先补充你真实具备、且能在经历中证明的关键词，不要凭空新增事实。",
      }),
    );

    builder.addSuggestion(
      createSuggestion({
        id: "suggest-review-match-gaps",
        category: "match",
        title: "对照缺口逐条确认可证明的关键词",
        rationale: "先确认哪些缺口确实有经历证据，再决定是否通过岗位版或手动改写补充。",
        actionText: "人工核对缺口",
        canAutoApply: false,
        requiresUserConfirmation: true,
        issueIds: ["rule-jd-match-gaps"],
      }),
    );
  }
}

export function runRuleDiagnosis(input: RuleDiagnosisInput): DiagnosisRuleResult {
  const issues: DiagnosisIssueRecord[] = [];
  const suggestions: DiagnosisSuggestionRecord[] = [];
  const issueIds = new Set<string>();
  const suggestionIds = new Set<string>();

  const builder: RuleBuilder = {
    addIssue(issue) {
      if (issueIds.has(issue.id)) {
        return;
      }

      issueIds.add(issue.id);
      issues.push(issue);
    },
    addSuggestion(suggestion) {
      if (suggestionIds.has(suggestion.id)) {
        return;
      }

      suggestionIds.add(suggestion.id);
      suggestions.push(suggestion);
    },
  };

  runBaseRules(input, builder);
  runJdRules(input, builder);

  return {
    issues,
    suggestions,
    scoreOverview: buildScoreOverview(issues),
  };
}

export function buildDiagnosisScoreOverview(issues: DiagnosisIssueRecord[]) {
  return buildScoreOverview(issues);
}
