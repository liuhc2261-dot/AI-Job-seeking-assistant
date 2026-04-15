import { buildResumeParagraphRewriterPrompts } from "@/ai/prompts/resume-paragraph-rewriter";
import {
  type ResumeParagraphRewriterResult,
  resumeParagraphRewriterResultSchema,
} from "@/ai/schemas/resume-paragraph-rewriter";
import { aiService } from "@/services/ai-service";
import type { ResumeContentJson } from "@/types/resume";

type RewriteStyle = "concise" | "quantitative" | "professional";

export type ResumeParagraphRewriterAgentInput = {
  userId: string;
  originalText: string;
  context: string;
  rewriteStyle: RewriteStyle;
  resumeContent: ResumeContentJson;
};

export type ResumeParagraphRewriterAgentResult = {
  rewrittenText: string;
  changeType: "improved" | "polished" | "unchanged";
  explanation: string;
  meta: {
    provider: string;
    model: string;
    usedFallback: boolean;
  };
};

function buildFallbackResult(input: {
  originalText: string;
}): ResumeParagraphRewriterResult {
  return {
    rewrittenText: input.originalText,
    changeType: "unchanged",
    explanation: "AI 服务不可用，保持原样。",
  };
}

class ResumeParagraphRewriterAgent {
  async rewrite(
    input: ResumeParagraphRewriterAgentInput,
  ): Promise<ResumeParagraphRewriterAgentResult> {
    const prompts = buildResumeParagraphRewriterPrompts({
      originalText: input.originalText,
      context: input.context,
      rewriteStyle: input.rewriteStyle,
      resumeContent: input.resumeContent,
    });

    const aiResult = await aiService.generateStructuredData({
      userId: input.userId,
      taskType: "paragraph_rewrite",
      schema: resumeParagraphRewriterResultSchema,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      temperature: 0.3,
      fallback: () => buildFallbackResult({ originalText: input.originalText }),
    });

    return {
      rewrittenText: aiResult.data.rewrittenText,
      changeType: aiResult.data.changeType,
      explanation: aiResult.data.explanation,
      meta: {
        provider: aiResult.meta.provider,
        model: aiResult.meta.model,
        usedFallback: aiResult.meta.usedFallback,
      },
    };
  }
}

export const resumeParagraphRewriterAgent = new ResumeParagraphRewriterAgent();
