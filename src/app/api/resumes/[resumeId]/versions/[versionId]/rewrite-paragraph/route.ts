import {
  getAuthenticatedResumeUserId,
  getResumeApiErrorResponse,
} from "@/lib/api/resume";
import { apiError, apiOk } from "@/lib/http";
import { createApiRequestLogger } from "@/lib/monitoring/request-logger";
import { paragraphRewriteRequestSchema } from "@/lib/validations/resume";
import { resumeParagraphRewriterService } from "@/services/resume-paragraph-rewriter-service";

type RewriteParagraphRouteProps = {
  params: Promise<{
    resumeId: string;
    versionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RewriteParagraphRouteProps,
) {
  const requestLog = createApiRequestLogger({
    request,
    route: "POST /api/resumes/[resumeId]/versions/[versionId]/rewrite-paragraph",
    taskType: "paragraph_rewrite",
  });
  const userId = await getAuthenticatedResumeUserId();

  if (!userId) {
    return requestLog.finalize({
      response: apiError("请先登录。", 401),
    });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = paragraphRewriteRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return requestLog.finalize({
      response: apiError("段落改写参数不合法。", 400, parsedBody.error.flatten()),
      userId,
    });
  }

  const { resumeId, versionId } = await params;

  try {
    const result = await resumeParagraphRewriterService.rewriteParagraph({
      userId,
      resumeId,
      resumeVersionId: versionId,
      sectionType: parsedBody.data.sectionType,
      sectionIndex: parsedBody.data.sectionIndex,
      bulletIndex: parsedBody.data.bulletIndex,
      originalText: parsedBody.data.originalText,
      context: parsedBody.data.context,
      rewriteStyle: parsedBody.data.rewriteStyle,
    });

    return requestLog.finalize({
      response: apiOk(result, { status: 200 }),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
        sectionType: parsedBody.data.sectionType,
        rewriteStyle: parsedBody.data.rewriteStyle,
      },
    });
  } catch (error) {
    return requestLog.finalize({
      response: getResumeApiErrorResponse(error),
      userId,
      extra: {
        resumeId,
        resumeVersionId: versionId,
      },
    });
  }
}
