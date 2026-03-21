import { z } from "zod";

const monthValuePattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function requiredString(label: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, `请输入${label}。`)
    .max(maxLength, `${label}不能超过 ${maxLength} 个字符。`);
}

function optionalString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, `内容不能超过 ${maxLength} 个字符。`)
    .optional()
    .default("");
}

function optionalUrl(label: string) {
  return z
    .string()
    .trim()
    .max(255, `${label}不能超过 255 个字符。`)
    .refine((value) => value.length === 0 || z.url().safeParse(value).success, {
      message: `请输入有效的${label}。`,
    })
    .optional()
    .default("");
}

const monthSchema = z
  .string()
  .trim()
  .regex(monthValuePattern, "请使用 YYYY-MM 格式。");

const optionalMonthSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || monthValuePattern.test(value), {
    message: "请使用 YYYY-MM 格式。",
  })
  .optional()
  .default("");

export const basicProfileSchema = z.object({
  fullName: requiredString("姓名", 80),
  phone: z
    .string()
    .trim()
    .min(6, "请输入联系电话。")
    .max(32, "联系电话不能超过 32 个字符。"),
  email: z.string().trim().email("请输入有效邮箱。"),
  targetRole: optionalString(120),
  city: optionalString(120),
  homepageUrl: optionalUrl("个人主页链接"),
  githubUrl: optionalUrl("GitHub 链接"),
  summary: optionalString(1000),
});

export const educationSchema = z
  .object({
    schoolName: requiredString("学校名称", 120),
    major: requiredString("专业", 120),
    degree: requiredString("学历", 60),
    startDate: monthSchema,
    endDate: monthSchema,
    gpa: optionalString(40),
    ranking: optionalString(40),
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "结束时间不能早于开始时间。",
  });

export const projectSchema = z
  .object({
    name: requiredString("项目名称", 120),
    role: requiredString("项目角色", 80),
    startDate: monthSchema,
    endDate: monthSchema,
    descriptionRaw: requiredString("项目描述", 2000),
    techStack: optionalString(300),
    contributionRaw: optionalString(2000),
    resultRaw: optionalString(2000),
    sourceType: optionalString(60),
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "结束时间不能早于开始时间。",
  });

export const experienceSchema = z
  .object({
    companyName: requiredString("公司名称", 120),
    jobTitle: requiredString("岗位名称", 80),
    startDate: monthSchema,
    endDate: monthSchema,
    descriptionRaw: requiredString("实习描述", 2000),
    resultRaw: optionalString(2000),
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "结束时间不能早于开始时间。",
  });

export const awardSchema = z.object({
  title: requiredString("奖项名称", 120),
  issuer: optionalString(120),
  awardDate: optionalMonthSchema,
  description: optionalString(500),
});

export const skillSchema = z.object({
  category: requiredString("技能分类", 60),
  name: requiredString("技能名称", 80),
  level: optionalString(40),
});

export type BasicProfileInput = z.infer<typeof basicProfileSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type AwardInput = z.infer<typeof awardSchema>;
export type SkillInput = z.infer<typeof skillSchema>;
