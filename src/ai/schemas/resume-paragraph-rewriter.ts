import { z } from "zod";

export const resumeParagraphRewriterResultSchema = z.object({
  rewrittenText: z.string().trim().min(1).max(500),
  changeType: z.enum(["improved", "polished", "unchanged"]),
  explanation: z.string().trim().min(1).max(200),
});

export type ResumeParagraphRewriterResult = z.infer<
  typeof resumeParagraphRewriterResultSchema
>;
