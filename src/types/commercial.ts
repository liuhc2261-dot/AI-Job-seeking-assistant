export type CommerceAccessTierKind = "trial" | "paid";

export type CommercePlanCodeKind = "trial" | "jd_diagnose_pack_29";

export type CommerceOrderStatusKind =
  | "pending"
  | "paid"
  | "cancelled"
  | "refunded"
  | "manual_granted";

export type CommercePaymentChannelKind = "manual" | "wechat" | "alipay";

export type CommercePaymentSessionStatusKind =
  | "not_configured"
  | "pending"
  | "ready"
  | "expired"
  | "paid";

export type CommercePaymentSession = {
  channel: CommercePaymentChannelKind;
  status: CommercePaymentSessionStatusKind;
  expiresAt: string | null;
  codeUrl: string | null;
  paymentUrl: string | null;
  qrCodeDataUrl: string | null;
  displayTitle: string;
  displayDescription: string;
};

export type CommerceUsageFeatureKind =
  | "master_resume_generate"
  | "jd_tailor"
  | "diagnose"
  | "pdf_export";

export type CommercialQuotaSummary = {
  masterResumeCreditsRemaining: number;
  jdTailorCreditsRemaining: number;
  diagnosisCreditsRemaining: number;
  pdfExportCreditsRemaining: number | null;
  hasUnlimitedExports: boolean;
};

export type CommercialProfileSummary = {
  accessTier: CommerceAccessTierKind;
  planCode: CommercePlanCodeKind;
  planLabel: string;
  amountCents: number;
  currentAiModel: string;
  quotas: CommercialQuotaSummary;
  activatedAt: string | null;
};

export type CommercePlanSummary = {
  code: CommercePlanCodeKind;
  label: string;
  amountCents: number;
  currentAiModel: string;
  masterResumeCredits: number;
  jdTailorCredits: number;
  diagnosisCredits: number;
  pdfExportCredits: number | null;
  hasUnlimitedExports: boolean;
};

export type CommerceOrderSummary = {
  id: string;
  planCode: CommercePlanCodeKind;
  amountCents: number;
  currency: string;
  status: CommerceOrderStatusKind;
  paymentChannel: string | null;
  externalOrderId: string | null;
  paidAt: string | null;
  createdAt: string;
  paymentSession: CommercePaymentSession | null;
};

export type CommerceOverview = {
  profile: CommercialProfileSummary;
  plans: CommercePlanSummary[];
  orders: CommerceOrderSummary[];
};
