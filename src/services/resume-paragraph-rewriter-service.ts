import { resumeParagraphRewriterAgent } from "@/ai/orchestrators/resume-paragraph-rewriter-agent";
import { resumeContentJsonSchema } from "@/ai/schemas/resume-generator";
import { prisma } from "@/lib/db";
import { createEmptyResumeContent } from "@/lib/resume-document";
import type { ResumeContentJson } from "@/types/resume";

export class ResumeParagraphRewriterServiceError extends Error {
  constructor(
    public readonly code: "RESUME_NOT_FOUND" | "VERSION_NOT_FOUND",
  ) {
    super(code);
  }
}

function parseResumeContent(rawValue: unknown): ResumeContentJson {
  const parsedValue = resumeContentJsonSchema.safeParse(rawValue);

  if (parsedValue.success) {
    return parsedValue.data;
  }

  return createEmptyResumeContent();
}

type RewriteParagraphInput = {
  userId: string;
  resumeId: string;
  resumeVersionId: string;
  sectionType: "project" | "experience" | "education";
  sectionIndex: number;
  bulletIndex: number;
  originalText: string;
  context: string;
  rewriteStyle: "concise" | "quantitative" | "professional";
};

type RewriteParagraphResult = {
  rewrittenText: string;
  changeType: "improved" | "polished" | "unchanged";
  explanation: string;
  meta: {
    provider: string;
    model: string;
    usedFallback: boolean;
  };
};

class ResumeParagraphRewriterService {
  async rewriteParagraph(
    input: RewriteParagraphInput,
  ): Promise<RewriteParagraphResult> {
    const sourceVersion = await prisma.resumeVersion.findFirst({
      where: {
        id: input.resumeVersionId,
        resumeId: input.resumeId,
        userId: input.userId,
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

      throw new ResumeParagraphRewriterServiceError(
        resume ? "VERSION_NOT_FOUND" : "RESUME_NOT_FOUND",
      );
    }

    const resumeContent = parseResumeContent(sourceVersion.contentJson);
    const result = await resumeParagraphRewriterAgent.rewrite({
      userId: input.userId,
      originalText: input.originalText,
      context: input.context,
      rewriteStyle: input.rewriteStyle,
      resumeContent,
    });

    return result;
  }
}

export const resumeParagraphRewriterService =
  new ResumeParagraphRewriterService();
