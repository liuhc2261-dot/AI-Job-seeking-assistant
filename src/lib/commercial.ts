import type { CommercePaymentChannelKind } from "@/types/commercial";

export const trialPlan = {
  code: "TRIAL",
  label: "免费试用",
  amountCents: 0,
  masterResumeCredits: 1,
  jdTailorCredits: 1,
  diagnosisCredits: 1,
  pdfExportCredits: 1,
  hasUnlimitedExports: false,
} as const;

export const trialQuotaDefaults = {
  masterResumeCredits: trialPlan.masterResumeCredits,
  jdTailorCredits: trialPlan.jdTailorCredits,
  diagnosisCredits: trialPlan.diagnosisCredits,
  pdfExportCredits: trialPlan.pdfExportCredits,
} as const;

export const jdDiagnosePack29 = {
  code: "JD_DIAGNOSE_PACK_29",
  label: "29 元 JD 定制 / 诊断冲刺包",
  amountCents: 2900,
  masterResumeCredits: 0,
  jdTailorCredits: 10,
  diagnosisCredits: 10,
  pdfExportCredits: null,
  hasUnlimitedExports: true,
} as const;

export const commercePlanCatalog = {
  TRIAL: trialPlan,
  JD_DIAGNOSE_PACK_29: jdDiagnosePack29,
} as const;

export const commercePlanOrder = ["TRIAL", "JD_DIAGNOSE_PACK_29"] as const;

export const paymentChannelLabels: Record<CommercePaymentChannelKind, string> = {
  manual: "人工开通",
  wechat: "微信支付",
  alipay: "支付宝",
};
