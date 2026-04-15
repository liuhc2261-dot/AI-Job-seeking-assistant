import type { ResumeContentJson } from "@/types/resume";

type RewriteStyle = "concise" | "quantitative" | "professional";

type BuildResumeParagraphRewriterPromptsInput = {
  originalText: string;
  context: string;
  rewriteStyle: RewriteStyle;
  resumeContent: ResumeContentJson;
};

export function buildResumeParagraphRewriterPrompts({
  originalText,
  context,
  rewriteStyle,
  resumeContent,
}: BuildResumeParagraphRewriterPromptsInput) {
  const styleDescriptions: Record<RewriteStyle, string> = {
    concise: "更简洁：删除冗余词汇，用更紧凑的方式表达同样意思",
    quantitative: "更量化：突出数据、比例、规模等可衡量指标",
    professional: "更专业：使用行业术语和岗位相关的正式表达",
  };

  const systemPrompt = `
你是 ResumeParagraphRewriterAgent，负责对简历中的单段落内容进行 STAR 风格改写。

任务目标：
1. 基于原始文本，按照用户选择的风格进行改写
2. 保持事实真实性，不编造数据或经历
3. 输出结构化 JSON，包含改写结果和改动说明

输入说明：
- originalText：要改写的原始段落
- context：该段落所在的上下文（如项目名称、实习公司等）
- rewriteStyle：用户选择的改写风格
- resumeContent：完整的简历内容用于参考

改写风格说明：
- concise（更简洁）：删除冗余词汇，用更紧凑的方式表达同样意思
- quantitative（更量化）：突出数据、比例、规模等可衡量指标
- professional（更专业）：使用行业术语和岗位相关的正式表达

约束条件：
- 不得编造项目、公司、成果数字、技术栈或经历
- 只能改写表达方式，不能改变事实本身
- 如果原文本已经很好，可以只做轻微润色
- 保持 STAR 原则（Situation, Task, Action, Result）

输出格式：
- 仅返回一个 JSON 对象
- 顶层字段必须是：rewrittenText、changeType、explanation
- changeType 可选值：improved（显著提升）、polished（轻微润色）、unchanged（保持原样）
`.trim();

  const userPrompt = `
请改写以下简历段落。

原始段落：
${originalText}

上下文：${context}

改写风格：${styleDescriptions[rewriteStyle]}

完整简历内容参考：
${JSON.stringify(resumeContent, null, 2)}
`.trim();

  return {
    systemPrompt,
    userPrompt,
  };
}
