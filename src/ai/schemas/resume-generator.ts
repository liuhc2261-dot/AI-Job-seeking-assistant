import { z } from "zod";

const optionalString = z.string().trim().max(500).optional().default("");

const stringArraySchema = z
  .array(z.string().trim().min(1).max(240))
  .max(20)
  .default([]);

export const resumeChangeSummarySchema = z.object({
  type: z.enum([
    "preserved",
    "rewritten",
    "keyword_aligned",
    "needs_user_confirmation",
  ]),
  reason: z.string().trim().min(1).max(400),
  affectedSection: z.string().trim().min(1).max(120),
});

export const resumeVersionNotesSchema = z.object({
  generationSummary: z.string().trim().min(1).max(400).optional(),
  items: z.array(resumeChangeSummarySchema).default([]),
  warnings: z.array(z.string().trim().min(1).max(240)).default([]),
});

export const resumeContentJsonSchema = z.object({
  basic: z.object({
    name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(1).max(32),
    email: z.string().trim().email(),
    city: optionalString,
    targetRole: optionalString,
    homepageUrl: optionalString,
    githubUrl: optionalString,
  }),
  summary: z.string().trim().max(1200).default(""),
  education: z
    .array(
      z.object({
        school: z.string().trim().min(1).max(120),
        major: z.string().trim().min(1).max(120),
        degree: z.string().trim().min(1).max(80),
        startDate: z.string().trim().max(20).default(""),
        endDate: z.string().trim().max(20).default(""),
        highlights: stringArraySchema,
      }),
    )
    .max(20)
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        role: z.string().trim().min(1).max(80),
        startDate: z.string().trim().max(20).default(""),
        endDate: z.string().trim().max(20).default(""),
        techStack: stringArraySchema,
        bullets: stringArraySchema,
      }),
    )
    .max(20)
    .default([]),
  experiences: z
    .array(
      z.object({
        company: z.string().trim().min(1).max(120),
        role: z.string().trim().min(1).max(80),
        startDate: z.string().trim().max(20).default(""),
        endDate: z.string().trim().max(20).default(""),
        bullets: stringArraySchema,
      }),
    )
    .max(20)
    .default([]),
  awards: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        issuer: optionalString,
        awardDate: optionalString,
        description: optionalString,
      }),
    )
    .max(20)
    .default([]),
  skills: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(60),
        items: stringArraySchema,
      }),
    )
    .max(20)
    .default([]),
});

export const resumeGeneratorResultSchema = z.object({
  contentJson: resumeContentJsonSchema,
  contentMarkdown: z.string().trim().min(1).max(12000),
  generationSummary: z.string().trim().min(1).max(400),
  changeSummary: z.array(resumeChangeSummarySchema).min(1).max(20),
  warnings: z.array(z.string().trim().min(1).max(240)).default([]),
});
