import { z } from "zod";

const exportTemplateNameSchema = z.string().trim().min(1).max(60);

export const markdownExportRequestSchema = z.object({
  templateName: exportTemplateNameSchema.optional().default("source-markdown"),
});

export const pdfExportRequestSchema = z.object({
  templateName: exportTemplateNameSchema.optional().default("ats-standard"),
});

export type MarkdownExportRequest = z.infer<typeof markdownExportRequestSchema>;
export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>;
