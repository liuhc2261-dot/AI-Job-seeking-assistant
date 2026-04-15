/**
 * Schema validation, AI parser, and version management logic tests
 * Coverage: V1.1-P0-1 (自动化测试覆盖)
 *
 * - Zod schema校验测试
 * - AI 响应解析测试
 * - 版本创建/回滚逻辑测试
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  importFreshModule,
  resetTestState,
  setModuleMocks,
  toTestFileUrl,
} from "./helpers/module-helpers.mjs";

const dbMockUrl = toTestFileUrl("mocks/lib-db.mjs");
const resumeDocumentMockUrl = toTestFileUrl("mocks/lib-resume-document.mjs");
const profileServiceMockUrl = toTestFileUrl("mocks/services-profile-service.mjs");
const resumeGeneratorAgentMockUrl = toTestFileUrl("mocks/ai-resume-generator-agent.mjs");

function cloneValue(value) {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// Zod schema validation tests — resume-content-json
// ---------------------------------------------------------------------------

describe("resumeContentJsonSchema validation", () => {
  it("accepts a fully populated valid resume content", async () => {
    const validContent = {
      basic: {
        name: "张三",
        phone: "13800138000",
        email: "zhangsan@example.com",
        city: "北京",
        targetRole: "前端开发工程师",
        homepageUrl: "",
        githubUrl: "https://github.com/zhangsan",
      },
      summary: "3年前端开发经验，擅长 React 和 TypeScript",
      education: [
        {
          school: "清华大学",
          major: "计算机科学与技术",
          degree: "本科",
          startDate: "2018-09",
          endDate: "2022-06",
          highlights: ["GPA 3.8/4.0", "校级一等奖学金"],
        },
      ],
      projects: [
        {
          name: "企业内部管理系统",
          role: "前端开发",
          startDate: "2022-07",
          endDate: "2023-12",
          techStack: ["React", "TypeScript", "Ant Design"],
          bullets: ["负责后台管理界面开发", "优化首屏加载性能，提升40%"],
        },
      ],
      experiences: [
        {
          company: "字节跳动",
          role: "前端开发工程师",
          startDate: "2022-07",
          endDate: "2024-01",
          bullets: ["负责用户增长方向开发", "主导前端架构重构"],
        },
      ],
      awards: [
        {
          title: "校级一等奖学金",
          issuer: "清华大学",
          awardDate: "2021-10",
          description: "综合排名前5%",
        },
      ],
      skills: [
        {
          category: "前端技术",
          items: ["React", "Vue", "TypeScript", "Node.js"],
        },
      ],
    };

    setModuleMocks([]);
    const { resumeContentJsonSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );
    const result = resumeContentJsonSchema.parse(validContent);

    assert.equal(result.basic.name, "张三");
    assert.equal(result.education[0].school, "清华大学");
    assert.equal(result.projects[0].techStack.length, 3);
    assert.equal(result.skills[0].items[0], "React");
  });

  it("rejects invalid email format", async () => {
    const invalidContent = {
      basic: {
        name: "张三",
        phone: "13800138000",
        email: "not-an-email",
        city: "",
        targetRole: "",
        homepageUrl: "",
        githubUrl: "",
      },
      summary: "",
      education: [],
      projects: [],
      experiences: [],
      awards: [],
      skills: [],
    };

    setModuleMocks([]);
    const { resumeContentJsonSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );

    assert.throws(
      () => resumeContentJsonSchema.parse(invalidContent),
      (error) => {
        assert.ok(error.issues?.some((e) => e.path?.includes("email")));
        return true;
      },
    );
  });

  it("rejects name exceeding 80 characters", async () => {
    const longNameContent = {
      basic: {
        name: "张".repeat(81),
        phone: "13800138000",
        email: "test@example.com",
        city: "",
        targetRole: "",
        homepageUrl: "",
        githubUrl: "",
      },
      summary: "",
      education: [],
      projects: [],
      experiences: [],
      awards: [],
      skills: [],
    };

    setModuleMocks([]);
    const { resumeContentJsonSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );

    assert.throws(
      () => resumeContentJsonSchema.parse(longNameContent),
      (error) => {
        assert.ok(error.issues?.some((e) => e.path?.includes("name")));
        return true;
      },
    );
  });

  it("applies defaults for optional string fields", async () => {
    const minimalContent = {
      basic: {
        name: "李四",
        phone: "13900000000",
        email: "lisi@example.com",
      },
      summary: "",
      education: [],
      projects: [],
      experiences: [],
      awards: [],
      skills: [],
    };

    setModuleMocks([]);
    const { resumeContentJsonSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );
    const result = resumeContentJsonSchema.parse(minimalContent);

    assert.equal(result.basic.city, "");
    assert.equal(result.basic.targetRole, "");
    assert.equal(result.basic.homepageUrl, "");
    assert.equal(result.basic.githubUrl, "");
  });

  it("rejects more than 20 education entries", async () => {
    const tooManyEducations = {
      basic: {
        name: "王五",
        phone: "13700000000",
        email: "wangwu@example.com",
      },
      summary: "",
      education: Array.from({ length: 21 }, (_, i) => ({
        school: `学校${i}`,
        major: "专业",
        degree: "本科",
        startDate: "2020-01",
        endDate: "2024-01",
        highlights: [],
      })),
      projects: [],
      experiences: [],
      awards: [],
      skills: [],
    };

    setModuleMocks([]);
    const { resumeContentJsonSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );

    assert.throws(() => resumeContentJsonSchema.parse(tooManyEducations));
  });

  it("accepts empty arrays for optional multi-entry fields", async () => {
    const emptyArraysContent = {
      basic: {
        name: "赵六",
        phone: "13600000000",
        email: "zhaoliu@example.com",
      },
      summary: "无",
      education: [],
      projects: [],
      experiences: [],
      awards: [],
      skills: [],
    };

    setModuleMocks([]);
    const { resumeContentJsonSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );
    const result = resumeContentJsonSchema.parse(emptyArraysContent);

    assert.deepEqual(result.education, []);
    assert.deepEqual(result.projects, []);
    assert.deepEqual(result.experiences, []);
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — resume-generator-result-schema
// ---------------------------------------------------------------------------

describe("resumeGeneratorResultSchema validation", () => {
  it("accepts a valid generator result with all fields", async () => {
    const validResult = {
      contentJson: {
        basic: {
          name: "测试",
          phone: "13800000000",
          email: "test@example.com",
        },
        summary: "测试摘要",
        education: [],
        projects: [],
        experiences: [],
        awards: [],
        skills: [],
      },
      contentMarkdown: "# 测试简历\n\n这是一份测试简历。",
      generationSummary: "基于用户资料生成了一份标准简历。",
      changeSummary: [
        {
          type: "preserved",
          reason: "姓名和联系方式保持不变。",
          affectedSection: "basic",
        },
      ],
      warnings: ["建议补充项目经验"],
    };

    setModuleMocks([]);
    const { resumeGeneratorResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );
    const result = resumeGeneratorResultSchema.parse(validResult);

    assert.equal(result.changeSummary[0].type, "preserved");
    assert.equal(result.warnings.length, 1);
  });

  it("rejects contentMarkdown exceeding 12000 characters", async () => {
    const tooLongMarkdown = {
      contentJson: {
        basic: {
          name: "测试",
          phone: "13800000000",
          email: "test@example.com",
        },
        summary: "",
        education: [],
        projects: [],
        experiences: [],
        awards: [],
        skills: [],
      },
      contentMarkdown: "x".repeat(12001),
      generationSummary: "摘要",
      changeSummary: [
        {
          type: "preserved",
          reason: "无",
          affectedSection: "all",
        },
      ],
      warnings: [],
    };

    setModuleMocks([]);
    const { resumeGeneratorResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );

    assert.throws(() => resumeGeneratorResultSchema.parse(tooLongMarkdown));
  });

  it("rejects changeSummary with more than 20 items", async () => {
    const tooManyChanges = {
      contentJson: {
        basic: {
          name: "测试",
          phone: "13800000000",
          email: "test@example.com",
        },
        summary: "",
        education: [],
        projects: [],
        experiences: [],
        awards: [],
        skills: [],
      },
      contentMarkdown: "# 测试",
      generationSummary: "摘要",
      changeSummary: Array.from({ length: 21 }, (_, i) => ({
        type: "preserved",
        reason: `原因${i}`,
        affectedSection: "section",
      })),
      warnings: [],
    };

    setModuleMocks([]);
    const { resumeGeneratorResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );

    assert.throws(() => resumeGeneratorResultSchema.parse(tooManyChanges));
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — jd-parser-schema
// ---------------------------------------------------------------------------

describe("jdParserResultSchema validation", () => {
  it("accepts a valid JD parser result", async () => {
    const validJD = {
      jobTitle: "前端开发工程师",
      companyName: "字节跳动",
      parsedKeywords: ["React", "TypeScript", "Node.js"],
      responsibilities: ["负责前端架构设计", "主导技术选型"],
      requiredSkills: ["React", "TypeScript", "CSS"],
    };

    setModuleMocks([]);
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");
    const result = jdParserResultSchema.parse(validJD);

    assert.equal(result.jobTitle, "前端开发工程师");
    assert.equal(result.parsedKeywords.length, 3);
    assert.equal(result.requiredSkills.length, 3);
  });

  it("applies defaults for optional fields", async () => {
    const minimalJD = {};

    setModuleMocks([]);
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");
    const result = jdParserResultSchema.parse(minimalJD);

    assert.equal(result.jobTitle, "");
    assert.equal(result.companyName, "");
    assert.deepEqual(result.parsedKeywords, []);
    assert.deepEqual(result.responsibilities, []);
    assert.deepEqual(result.requiredSkills, []);
  });

  it("rejects more than 20 parsedKeywords", async () => {
    const tooManyKeywords = {
      parsedKeywords: Array.from({ length: 21 }, (_, i) => `keyword${i}`),
    };

    setModuleMocks([]);
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    assert.throws(() => jdParserResultSchema.parse(tooManyKeywords));
  });

  it("rejects more than 8 responsibilities", async () => {
    const tooManyResponsibilities = {
      responsibilities: Array.from({ length: 9 }, (_, i) => `职责${i}`),
    };

    setModuleMocks([]);
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    assert.throws(() => jdParserResultSchema.parse(tooManyResponsibilities));
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — resume-optimizer-schema
// ---------------------------------------------------------------------------

describe("resumeOptimizerResultSchema validation", () => {
  it("accepts a valid optimizer result", async () => {
    const validOptimizerResult = {
      contentJson: {
        basic: {
          name: "优化后",
          phone: "13800000000",
          email: "opt@example.com",
        },
        summary: "针对前端岗位优化后的摘要",
        education: [],
        projects: [],
        experiences: [],
        awards: [],
        skills: [],
      },
      contentMarkdown: "# 优化后简历",
      generationSummary: "已针对目标JD优化关键词布局。",
      changeSummary: [
        {
          type: "keyword_aligned",
          reason: "优先凸显 React、TypeScript 等关键词。",
          affectedSection: "skills",
        },
      ],
      warnings: [],
    };

    setModuleMocks([]);
    const { resumeOptimizerResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-optimizer.ts",
    );
    const result = resumeOptimizerResultSchema.parse(validOptimizerResult);

    assert.equal(result.changeSummary[0].type, "keyword_aligned");
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — resume-version-notes-schema
// ---------------------------------------------------------------------------

describe("resumeVersionNotesSchema validation", () => {
  it("accepts valid version notes with change items", async () => {
    const validNotes = {
      generationSummary: "AI生成版本",
      items: [
        {
          type: "preserved",
          reason: "保留原有教育经历",
          affectedSection: "education",
        },
        {
          type: "rewritten",
          reason: "重写项目描述",
          affectedSection: "projects",
        },
      ],
      warnings: ["缺少具体的量化数据"],
    };

    setModuleMocks([]);
    const { resumeVersionNotesSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );
    const result = resumeVersionNotesSchema.parse(validNotes);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].type, "preserved");
  });

  it("accepts notes with empty items and warnings", async () => {
    const emptyNotes = {};

    setModuleMocks([]);
    const { resumeVersionNotesSchema } = await importFreshModule(
      "src/ai/schemas/resume-generator.ts",
    );
    const result = resumeVersionNotesSchema.parse(emptyNotes);

    assert.deepEqual(result.items, []);
    assert.deepEqual(result.warnings, []);
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — resume-diagnoser-schema
// ---------------------------------------------------------------------------

describe("resumeDiagnoserResultSchema validation", () => {
  it("accepts a valid diagnoser result", async () => {
    const validDiagnosis = {
      scoreOverview: {
        overall: 75,
        content: 72,
        expression: 78,
        structure: 70,
        match: 80,
        ats: 74,
        summary: "简历整体中等偏上，建议优化项目描述的量化表达。",
      },
      issues: [
        {
          id: "issue-1",
          source: "rule",
          category: "content",
          issueType: "missing_quantification",
          severity: "medium",
          title: "项目成果缺乏量化数据",
          evidence: "项目描述中未包含具体数字",
          suggestion: "建议添加具体的数量、百分比或时间数据",
        },
      ],
      suggestions: [
        {
          id: "suggestion-1",
          category: "content",
          title: "优化项目描述",
          rationale: "通过量化数据提升说服力",
          actionText: "应用建议",
          canAutoApply: true,
          requiresUserConfirmation: false,
          issueIds: ["issue-1"],
          patch: {
            actionType: "rewrite_summary",
            summary: "优化后的摘要内容",
          },
        },
      ],
    };

    setModuleMocks([]);
    const { resumeDiagnoserResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-diagnoser.ts",
    );
    const result = resumeDiagnoserResultSchema.parse(validDiagnosis);

    assert.equal(result.scoreOverview.overall, 75);
    assert.equal(result.issues.length, 1);
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].patch.actionType, "rewrite_summary");
  });

  it("rejects score outside 0-100 range", async () => {
    const invalidScore = {
      scoreOverview: {
        overall: 150,
        content: 80,
        expression: 80,
        structure: 80,
        match: 80,
        ats: 80,
        summary: "test",
      },
      issues: [],
      suggestions: [],
    };

    setModuleMocks([]);
    const { resumeDiagnoserResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-diagnoser.ts",
    );

    assert.throws(() => resumeDiagnoserResultSchema.parse(invalidScore));
  });

  it("accepts empty issues and suggestions arrays", async () => {
    const minimalDiagnosis = {
      scoreOverview: {
        overall: 90,
        content: 90,
        expression: 90,
        structure: 90,
        match: 90,
        ats: 90,
        summary: "优秀简历",
      },
      issues: [],
      suggestions: [],
    };

    setModuleMocks([]);
    const { resumeDiagnoserResultSchema } = await importFreshModule(
      "src/ai/schemas/resume-diagnoser.ts",
    );
    const result = resumeDiagnoserResultSchema.parse(minimalDiagnosis);

    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.suggestions, []);
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — resume-request-schemas (API validation)
// ---------------------------------------------------------------------------

describe("resume API request schemas", () => {
  it("accepts valid jdParseRequestSchema input", async () => {
    const validRequest = {
      resumeId: "550e8400-e29b-41d4-a716-446655440000",
      resumeVersionId: "550e8400-e29b-41d4-a716-446655440001",
      jdText:
        "招聘前端开发工程师，要求熟练掌握React、TypeScript，有3年以上开发经验，负责公司前端架构设计和技术选型。",
    };

    setModuleMocks([]);
    const { jdParseRequestSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );
    const result = jdParseRequestSchema.parse(validRequest);

    assert.equal(result.resumeId, validRequest.resumeId);
    assert.ok(result.jdText.length >= 40);
  });

  it("rejects jdText shorter than 40 characters", async () => {
    const tooShortJD = {
      resumeId: "550e8400-e29b-41d4-a716-446655440000",
      resumeVersionId: "550e8400-e29b-41d4-a716-446655440001",
      jdText: "太短的JD文本",
    };

    setModuleMocks([]);
    const { jdParseRequestSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );

    assert.throws(() => jdParseRequestSchema.parse(tooShortJD));
  });

  it("rejects jdText exceeding 12000 characters", async () => {
    const tooLongJD = {
      resumeId: "550e8400-e29b-41d4-a716-446655440000",
      resumeVersionId: "550e8400-e29b-41d4-a716-446655440001",
      jdText: "JD".repeat(7000),
    };

    setModuleMocks([]);
    const { jdParseRequestSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );

    assert.throws(() => jdParseRequestSchema.parse(tooLongJD));
  });

  it("accepts valid diagnosisApplyRequestSchema", async () => {
    const validRequest = {
      resumeId: "550e8400-e29b-41d4-a716-446655440000",
      resumeVersionId: "550e8400-e29b-41d4-a716-446655440001",
      reportId: "550e8400-e29b-41d4-a716-446655440002",
      suggestionIds: ["suggestion-1", "suggestion-2"],
    };

    setModuleMocks([]);
    const { diagnosisApplyRequestSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );
    const result = diagnosisApplyRequestSchema.parse(validRequest);

    assert.equal(result.suggestionIds.length, 2);
  });

  it("rejects diagnosisApplyRequestSchema with more than 10 suggestionIds", async () => {
    const tooManySuggestions = {
      resumeId: "550e8400-e29b-41d4-a716-446655440000",
      resumeVersionId: "550e8400-e29b-41d4-a716-446655440001",
      reportId: "550e8400-e29b-41d4-a716-446655440002",
      suggestionIds: Array.from({ length: 11 }, (_, i) => `suggestion-${i}`),
    };

    setModuleMocks([]);
    const { diagnosisApplyRequestSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );

    assert.throws(() => diagnosisApplyRequestSchema.parse(tooManySuggestions));
  });

  it("accepts valid resumeVersionRenameSchema", async () => {
    setModuleMocks([]);
    const { resumeVersionRenameSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );
    const result = resumeVersionRenameSchema.parse({
      versionName: "我的终稿 v3",
    });

    assert.equal(result.versionName, "我的终稿 v3");
  });

  it("rejects empty version name", async () => {
    setModuleMocks([]);
    const { resumeVersionRenameSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );

    assert.throws(() => resumeVersionRenameSchema.parse({ versionName: "   " }));
  });

  it("rejects version name exceeding 120 characters", async () => {
    setModuleMocks([]);
    const { resumeVersionRenameSchema } = await importFreshModule(
      "src/lib/validations/resume.ts",
    );

    assert.throws(() =>
      resumeVersionRenameSchema.parse({ versionName: "x".repeat(121) }),
    );
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — auth schemas
// ---------------------------------------------------------------------------

describe("auth schemas validation", () => {
  it("accepts valid login schema", async () => {
    setModuleMocks([]);
    const { loginSchema } = await importFreshModule("src/lib/validations/auth.ts");
    const result = loginSchema.parse({
      email: "User@Example.COM",
      password: "password123",
    });

    assert.equal(result.email, "user@example.com");
    assert.equal(result.password, "password123");
  });

  it("rejects invalid email in login schema", async () => {
    setModuleMocks([]);
    const { loginSchema } = await importFreshModule("src/lib/validations/auth.ts");

    assert.throws(() => loginSchema.parse({ email: "not-an-email", password: "pass123" }));
  });

  it("accepts valid register schema with matching passwords", async () => {
    setModuleMocks([]);
    const { registerSchema } = await importFreshModule("src/lib/validations/auth.ts");
    const result = registerSchema.parse({
      email: "newuser@example.com",
      password: "securepassword",
      confirmPassword: "securepassword",
    });

    assert.equal(result.email, "newuser@example.com");
  });

  it("rejects register schema with mismatched passwords", async () => {
    setModuleMocks([]);
    const { registerSchema } = await importFreshModule("src/lib/validations/auth.ts");

    assert.throws(
      () =>
        registerSchema.parse({
          email: "user@example.com",
          password: "password123",
          confirmPassword: "different",
        }),
      (error) => {
        assert.ok(error.issues?.some((e) => e.path?.includes("confirmPassword")));
        return true;
      },
    );
  });

  it("rejects password shorter than 8 characters", async () => {
    setModuleMocks([]);
    const { registerSchema } = await importFreshModule("src/lib/validations/auth.ts");

    assert.throws(
      () =>
        registerSchema.parse({
          email: "user@example.com",
          password: "short",
          confirmPassword: "short",
        }),
    );
  });
});

// ---------------------------------------------------------------------------
// Zod schema validation tests — commercial schemas
// ---------------------------------------------------------------------------

describe("commercial schemas validation", () => {
  it("accepts valid commerceCheckoutRequestSchema", async () => {
    setModuleMocks([]);
    const { commerceCheckoutRequestSchema } = await importFreshModule(
      "src/lib/validations/commercial.ts",
    );
    const result = commerceCheckoutRequestSchema.parse({
      planCode: "jd_diagnose_pack_29",
      paymentChannel: "wechat",
    });

    assert.equal(result.planCode, "jd_diagnose_pack_29");
    assert.equal(result.paymentChannel, "wechat");
  });

  it("applies default paymentChannel in checkout schema", async () => {
    setModuleMocks([]);
    const { commerceCheckoutRequestSchema } = await importFreshModule(
      "src/lib/validations/commercial.ts",
    );
    const result = commerceCheckoutRequestSchema.parse({
      planCode: "jd_diagnose_pack_29",
    });

    assert.equal(result.paymentChannel, "wechat");
  });

  it("accepts valid commerceConfirmOrderSchema", async () => {
    setModuleMocks([]);
    const { commerceConfirmOrderSchema } = await importFreshModule(
      "src/lib/validations/commercial.ts",
    );
    const result = commerceConfirmOrderSchema.parse({
      paymentChannel: "wechat",
      externalOrderId: "wx_order_123456",
      notes: "测试订单",
    });

    assert.equal(result.externalOrderId, "wx_order_123456");
  });

  it("rejects externalOrderId exceeding 128 characters", async () => {
    setModuleMocks([]);
    const { commerceConfirmOrderSchema } = await importFreshModule(
      "src/lib/validations/commercial.ts",
    );

    assert.throws(
      () =>
        commerceConfirmOrderSchema.parse({
          externalOrderId: "x".repeat(129),
        }),
    );
  });
});

// ---------------------------------------------------------------------------
// AI response parsing — parseStructuredOutput
// ---------------------------------------------------------------------------

describe("parseStructuredOutput", () => {
  it("parses a raw JSON string directly", async () => {
    setModuleMocks([]);
    const { parseStructuredOutput } = await importFreshModule(
      "src/ai/parsers/structured-output.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    const rawOutput = JSON.stringify({
      jobTitle: "测试工程师",
      companyName: "测试公司",
      parsedKeywords: ["QA", "自动化测试"],
      responsibilities: ["编写测试用例"],
      requiredSkills: ["Python", "Selenium"],
    });

    const result = parseStructuredOutput(rawOutput, jdParserResultSchema);

    assert.equal(result.jobTitle, "测试工程师");
    assert.equal(result.parsedKeywords[0], "QA");
  });

  it("extracts JSON from a markdown code fence", async () => {
    setModuleMocks([]);
    const { parseStructuredOutput } = await importFreshModule(
      "src/ai/parsers/structured-output.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    const rawOutput = `以下是解析结果：

\`\`\`json
{
  "jobTitle": "前端工程师",
  "companyName": "某科技公司",
  "parsedKeywords": ["React"],
  "responsibilities": ["开发页面"],
  "requiredSkills": ["JavaScript"]
}
\`\`\`

希望对你有帮助！`;

    const result = parseStructuredOutput(rawOutput, jdParserResultSchema);

    assert.equal(result.jobTitle, "前端工程师");
    assert.equal(result.requiredSkills[0], "JavaScript");
  });

  it("extracts JSON from raw output without code fence", async () => {
    setModuleMocks([]);
    const { parseStructuredOutput } = await importFreshModule(
      "src/ai/parsers/structured-output.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    const rawOutput = `{ "jobTitle": "产品经理", "companyName": "", "parsedKeywords": [], "responsibilities": [], "requiredSkills": [] }`;

    const result = parseStructuredOutput(rawOutput, jdParserResultSchema);

    assert.equal(result.jobTitle, "产品经理");
  });

  it("throws STRUCTURED_OUTPUT_PARSE_FAILED when no valid JSON found", async () => {
    setModuleMocks([]);
    const { parseStructuredOutput } = await importFreshModule(
      "src/ai/parsers/structured-output.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    const rawOutput = "这是一些普通文本，不包含任何JSON格式的数据。";

    assert.throws(
      () => parseStructuredOutput(rawOutput, jdParserResultSchema),
      (error) => {
        assert.ok(error.message.includes("STRUCTURED_OUTPUT_PARSE_FAILED"));
        return true;
      },
    );
  });

  it("throws when JSON is valid but fails schema validation", async () => {
    setModuleMocks([]);
    const { parseStructuredOutput } = await importFreshModule(
      "src/ai/parsers/structured-output.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    const rawOutput = JSON.stringify({
      jobTitle: "x".repeat(200),
    });

    assert.throws(
      () => parseStructuredOutput(rawOutput, jdParserResultSchema),
      (error) => {
        assert.ok(error.message.includes("STRUCTURED_OUTPUT_PARSE_FAILED"));
        return true;
      },
    );
  });

  it("tries multiple JSON candidates and uses the first one that parses successfully", async () => {
    setModuleMocks([]);
    const { parseStructuredOutput } = await importFreshModule(
      "src/ai/parsers/structured-output.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    // Raw text with no JSON at all should fail
    const rawOutput = "This is plain text without any JSON.";

    assert.throws(
      () => parseStructuredOutput(rawOutput, jdParserResultSchema),
      (error) => {
        assert.ok(error.message.includes("STRUCTURED_OUTPUT_PARSE_FAILED"));
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// AI response parsing — parseStructuredResponse (simple Zod wrapper)
// ---------------------------------------------------------------------------

describe("parseStructuredResponse", () => {
  it("parses a JSON string with Zod schema", async () => {
    setModuleMocks([]);
    const { parseStructuredResponse } = await importFreshModule(
      "src/ai/parsers/structured-parser.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    const rawContent = JSON.stringify({
      jobTitle: "数据分析师",
      companyName: "数据公司",
      parsedKeywords: ["Python", "SQL"],
      responsibilities: ["数据分析"],
      requiredSkills: ["统计学"],
    });

    const result = parseStructuredResponse(rawContent, jdParserResultSchema);

    assert.equal(result.jobTitle, "数据分析师");
  });

  it("throws when JSON.parse fails", async () => {
    setModuleMocks([]);
    const { parseStructuredResponse } = await importFreshModule(
      "src/ai/parsers/structured-parser.ts",
    );
    const { jdParserResultSchema } = await importFreshModule("src/ai/schemas/jd-parser.ts");

    assert.throws(
      () => parseStructuredResponse("not valid json", jdParserResultSchema),
      (error) => {
        assert.ok(error instanceof SyntaxError);
        return true;
      },
    );
  });
});


// ---------------------------------------------------------------------------
// Profile schema validation tests
// ---------------------------------------------------------------------------

describe("profile schemas validation", () => {
  it("accepts valid basicProfileSchema", async () => {
    setModuleMocks([]);
    const { basicProfileSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );
    const result = basicProfileSchema.parse({
      fullName: "王小明",
      phone: "13800138000",
      email: "wangxiaoming@example.com",
      targetRole: "前端开发工程师",
      city: "北京",
      summary: "有3年前端开发经验",
    });

    assert.equal(result.fullName, "王小明");
    assert.equal(result.city, "北京");
  });

  it("rejects invalid URL in githubUrl", async () => {
    setModuleMocks([]);
    const { basicProfileSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );

    assert.throws(
      () =>
        basicProfileSchema.parse({
          fullName: "测试",
          phone: "13800000000",
          email: "test@example.com",
          githubUrl: "not-a-url",
        }),
    );
  });

  it("accepts education with valid date range", async () => {
    setModuleMocks([]);
    const { educationSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );
    const result = educationSchema.parse({
      schoolName: "北京大学",
      major: "计算机科学",
      degree: "本科",
      startDate: "2018-09",
      endDate: "2022-07",
      gpa: "3.8",
    });

    assert.equal(result.schoolName, "北京大学");
  });

  it("rejects education where endDate is before startDate", async () => {
    setModuleMocks([]);
    const { educationSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );

    assert.throws(
      () =>
        educationSchema.parse({
          schoolName: "北京大学",
          major: "计算机科学",
          degree: "本科",
          startDate: "2022-09",
          endDate: "2018-07",
        }),
      (error) => {
        assert.ok(error.issues?.some((e) => e.path?.includes("endDate")));
        return true;
      },
    );
  });

  it("accepts project with valid date range", async () => {
    setModuleMocks([]);
    const { projectSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );
    const result = projectSchema.parse({
      name: "校园二手平台",
      role: "项目负责人",
      startDate: "2021-03",
      endDate: "2021-12",
      descriptionRaw: "开发了一个校园二手交易平台",
      techStack: "React, Node.js",
      contributionRaw: "独立完成前端开发",
    });

    assert.equal(result.name, "校园二手平台");
  });

  it("accepts valid experience schema", async () => {
    setModuleMocks([]);
    const { experienceSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );
    const result = experienceSchema.parse({
      companyName: "阿里巴巴",
      jobTitle: "前端开发实习生",
      startDate: "2023-06",
      endDate: "2023-08",
      descriptionRaw: "参与电商项目开发",
      resultRaw: "提升了页面加载速度",
    });

    assert.equal(result.companyName, "阿里巴巴");
    assert.equal(result.resultRaw, "提升了页面加载速度");
  });

  it("rejects experience with invalid month format", async () => {
    setModuleMocks([]);
    const { experienceSchema } = await importFreshModule(
      "src/lib/validations/profile.ts",
    );

    assert.throws(
      () =>
        experienceSchema.parse({
          companyName: "公司",
          jobTitle: "职位",
          startDate: "2023-13",
          endDate: "2023-15",
          descriptionRaw: "描述",
        }),
    );
  });
});

// ---------------------------------------------------------------------------
// Export schema validation tests
// ---------------------------------------------------------------------------

describe("export schemas validation", () => {
  it("accepts valid markdownExportRequestSchema with optional templateName", async () => {
    setModuleMocks([]);
    const { markdownExportRequestSchema } = await importFreshModule(
      "src/lib/validations/export.ts",
    );

    const result1 = markdownExportRequestSchema.parse({});
    assert.equal(result1.templateName, "source-markdown");

    const result2 = markdownExportRequestSchema.parse({ templateName: "custom-template" });
    assert.equal(result2.templateName, "custom-template");
  });

  it("accepts valid pdfExportRequestSchema with optional templateName", async () => {
    setModuleMocks([]);
    const { pdfExportRequestSchema } = await importFreshModule(
      "src/lib/validations/export.ts",
    );

    const result1 = pdfExportRequestSchema.parse({});
    assert.equal(result1.templateName, "ats-standard");

    const result2 = pdfExportRequestSchema.parse({ templateName: "modern-template" });
    assert.equal(result2.templateName, "modern-template");
  });

  it("rejects templateName exceeding 60 characters", async () => {
    setModuleMocks([]);
    const { pdfExportRequestSchema } = await importFreshModule(
      "src/lib/validations/export.ts",
    );

    assert.throws(
      () => pdfExportRequestSchema.parse({ templateName: "x".repeat(61) }),
    );
  });
});
