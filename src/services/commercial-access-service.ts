import type { Prisma } from "@prisma/client";

import {
  commercePlanCatalog,
  commercePlanOrder,
  jdDiagnosePack29,
} from "@/lib/commercial";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { paymentService } from "@/services/payment-service";
import type {
  CommerceOverview,
  CommercePlanCodeKind,
  CommercePlanSummary,
  CommercialProfileSummary,
  CommerceOrderSummary,
  CommercePaymentSession,
  CommerceUsageFeatureKind,
} from "@/types/commercial";

type PrismaLike = Prisma.TransactionClient | typeof prisma;

type CommerceProfileRecord = {
  id: string;
  userId: string;
  accessTier: "TRIAL" | "PAID";
  planCode: "TRIAL" | "JD_DIAGNOSE_PACK_29";
  masterResumeCreditsRemaining: number;
  jdTailorCreditsRemaining: number;
  diagnosisCreditsRemaining: number;
  pdfExportCreditsRemaining: number;
  hasUnlimitedExports: boolean;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ConsumeFeatureInput = {
  userId: string;
  feature: CommerceUsageFeatureKind;
  resourceType?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  tx?: PrismaLike;
};

type GrantPaidPackInput = {
  userId: string;
  paymentChannel?: string;
  externalOrderId?: string;
  notes?: string;
  tx?: PrismaLike;
};

type CreateCheckoutOrderInput = {
  userId: string;
  planCode: CommercePlanCodeKind;
  paymentChannel?: string;
  notes?: string;
};

type ConfirmOrderPaidInput = {
  orderId: string;
  userId?: string;
  paymentChannel?: string;
  externalOrderId?: string;
  notes?: string;
  paidStatus?: "PAID" | "MANUAL_GRANTED";
  tx?: PrismaLike;
};

type FeatureGateResult = {
  summary: CommercialProfileSummary;
};

const accessTierMap = {
  TRIAL: "trial",
  PAID: "paid",
} as const;

const planCodeMap = {
  TRIAL: "trial",
  JD_DIAGNOSE_PACK_29: "jd_diagnose_pack_29",
} as const;

const planCodeDbMap = {
  trial: "TRIAL",
  jd_diagnose_pack_29: "JD_DIAGNOSE_PACK_29",
} as const satisfies Record<CommercePlanCodeKind, "TRIAL" | "JD_DIAGNOSE_PACK_29">;

const usageFeatureMap = {
  master_resume_generate: "MASTER_RESUME_GENERATE",
  jd_tailor: "JD_TAILOR",
  diagnose: "DIAGNOSE",
  pdf_export: "PDF_EXPORT",
} as const satisfies Record<CommerceUsageFeatureKind, string>;

type ProfileCounterField =
  | "masterResumeCreditsRemaining"
  | "jdTailorCreditsRemaining"
  | "diagnosisCreditsRemaining"
  | "pdfExportCreditsRemaining";

function getProfileCounterField(feature: CommerceUsageFeatureKind): ProfileCounterField | null {
  switch (feature) {
    case "master_resume_generate":
      return "masterResumeCreditsRemaining";
    case "jd_tailor":
      return "jdTailorCreditsRemaining";
    case "diagnose":
      return "diagnosisCreditsRemaining";
    case "pdf_export":
      return "pdfExportCreditsRemaining";
    default:
      return null;
  }
}

function getFeatureExhaustedErrorCode(feature: CommerceUsageFeatureKind) {
  switch (feature) {
    case "master_resume_generate":
      return "MASTER_RESUME_LIMIT_REACHED" as const;
    case "jd_tailor":
      return "JD_TAILOR_LIMIT_REACHED" as const;
    case "diagnose":
      return "DIAGNOSIS_LIMIT_REACHED" as const;
    case "pdf_export":
      return "PDF_EXPORT_LIMIT_REACHED" as const;
    default:
      return "JD_TAILOR_LIMIT_REACHED" as const;
  }
}

function resolveAiModelForTier(accessTier: "TRIAL" | "PAID") {
  if (accessTier === "PAID") {
    return env.openAiPaidModel;
  }

  return env.openAiTrialModel;
}

function mapPlanSummary(planCode: "TRIAL" | "JD_DIAGNOSE_PACK_29"): CommercePlanSummary {
  const plan = commercePlanCatalog[planCode];
  const accessTier = planCode === "TRIAL" ? "TRIAL" : "PAID";

  return {
    code: planCodeMap[planCode],
    label: plan.label,
    amountCents: plan.amountCents,
    currentAiModel: resolveAiModelForTier(accessTier),
    masterResumeCredits: plan.masterResumeCredits,
    jdTailorCredits: plan.jdTailorCredits,
    diagnosisCredits: plan.diagnosisCredits,
    pdfExportCredits: plan.pdfExportCredits,
    hasUnlimitedExports: plan.hasUnlimitedExports,
  };
}

function mapOrderSummary(order: {
  id: string;
  planCode: "TRIAL" | "JD_DIAGNOSE_PACK_29";
  amountCents: number;
  currency: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | "MANUAL_GRANTED";
  paymentChannel: string | null;
  externalOrderId: string | null;
  paymentPayload: Prisma.JsonValue | null;
  paymentExpiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}, paymentSession: CommercePaymentSession | null): CommerceOrderSummary {
  return {
    id: order.id,
    planCode: planCodeMap[order.planCode],
    amountCents: order.amountCents,
    currency: order.currency,
    status: order.status.toLowerCase() as CommerceOrderSummary["status"],
    paymentChannel: order.paymentChannel,
    externalOrderId: order.externalOrderId,
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    paymentSession,
  };
}

export class CommercialAccessServiceError extends Error {
  constructor(
    public readonly code:
      | "MASTER_RESUME_LIMIT_REACHED"
      | "JD_TAILOR_LIMIT_REACHED"
      | "DIAGNOSIS_LIMIT_REACHED"
      | "PDF_EXPORT_LIMIT_REACHED"
      | "USER_NOT_FOUND"
      | "PLAN_NOT_FOUND"
      | "ORDER_NOT_FOUND"
      | "ORDER_NOT_PAYABLE",
    public readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

class CommercialAccessService {
  async getCommercialProfileSummary(
    userId: string,
    client: PrismaLike = prisma,
  ): Promise<CommercialProfileSummary> {
    const profile = await this.getOrCreateProfile(userId, client);

    return this.mapProfileSummary(profile);
  }

  async getCommercialOverview(userId: string): Promise<CommerceOverview> {
    const [profile, orders] = await Promise.all([
      this.getCommercialProfileSummary(userId),
      this.listOrders(userId),
    ]);

    return {
      profile,
      plans: this.listAvailablePlans(),
      orders,
    };
  }

  listAvailablePlans(): CommercePlanSummary[] {
    return commercePlanOrder.map((planCode) => mapPlanSummary(planCode));
  }

  async listOrders(userId: string): Promise<CommerceOrderSummary[]> {
    const orders = await prisma.commerceOrder.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return Promise.all(
      orders.map(async (order) =>
        mapOrderSummary(order, await paymentService.buildOrderPaymentSession(order)),
      ),
    );
  }

  async createCheckoutOrder({
    userId,
    planCode,
    paymentChannel,
    notes,
  }: CreateCheckoutOrderInput) {
    const resolvedPlanCode = planCodeDbMap[planCode];

    if (!resolvedPlanCode || resolvedPlanCode === "TRIAL") {
      throw new CommercialAccessServiceError("PLAN_NOT_FOUND");
    }

    const checkoutBase = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      });

      if (!existingUser) {
        throw new CommercialAccessServiceError("USER_NOT_FOUND");
      }

      const profile = await this.getOrCreateProfile(userId, tx);
      const existingPendingOrder = await tx.commerceOrder.findFirst({
        where: {
          userId,
          planCode: resolvedPlanCode,
          status: "PENDING",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existingPendingOrder) {
        return {
          order: existingPendingOrder,
          profile: this.mapProfileSummary(profile),
          plan: mapPlanSummary(resolvedPlanCode),
          reusedExistingOrder: true,
        };
      }

      const plan = commercePlanCatalog[resolvedPlanCode];
      const order = await tx.commerceOrder.create({
        data: {
          userId,
          profileId: profile.id,
          planCode: resolvedPlanCode,
          amountCents: plan.amountCents,
          currency: "CNY",
          status: "PENDING",
          paymentChannel: paymentChannel?.trim() || "wechat",
          notes: notes?.trim() || "checkout_created",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "COMMERCE_ORDER_CREATED",
          resourceType: "COMMERCE_ORDER",
          resourceId: order.id,
          payload: {
            planCode: resolvedPlanCode,
            amountCents: order.amountCents,
            paymentChannel: order.paymentChannel,
          },
        },
      });

      return {
        order,
        profile: this.mapProfileSummary(profile),
        plan: mapPlanSummary(resolvedPlanCode),
        reusedExistingOrder: false,
      };
    });

    const paymentSession = await paymentService.ensureOrderPaymentSession(checkoutBase.order);

    return {
      ...checkoutBase,
      order: mapOrderSummary(checkoutBase.order, paymentSession),
    };
  }

  async confirmOrderPaid({
    orderId,
    userId,
    paymentChannel,
    externalOrderId,
    notes,
    paidStatus = "PAID",
    tx,
  }: ConfirmOrderPaidInput) {
    if (tx) {
      return this.runConfirmOrderPaid({
        orderId,
        userId,
        paymentChannel,
        externalOrderId,
        notes,
        paidStatus,
        client: tx,
      });
    }

    return prisma.$transaction((innerTx) =>
      this.runConfirmOrderPaid({
        orderId,
        userId,
        paymentChannel,
        externalOrderId,
        notes,
        paidStatus,
        client: innerTx,
      }),
    );
  }

  async getAiModelForUser(userId: string) {
    const profile = await this.getOrCreateProfile(userId);

    return resolveAiModelForTier(profile.accessTier);
  }

  async assertFeatureAvailable(
    userId: string,
    feature: CommerceUsageFeatureKind,
    client: PrismaLike = prisma,
  ): Promise<FeatureGateResult> {
    const profile = await this.getOrCreateProfile(userId, client);
    const counterField = getProfileCounterField(feature);

    if (feature === "pdf_export" && profile.hasUnlimitedExports) {
      return {
        summary: this.mapProfileSummary(profile),
      };
    }

    if (!counterField) {
      return {
        summary: this.mapProfileSummary(profile),
      };
    }

    if (profile[counterField] <= 0) {
      throw new CommercialAccessServiceError(getFeatureExhaustedErrorCode(feature), {
        currentPlan: planCodeMap[profile.planCode],
        currentModel: resolveAiModelForTier(profile.accessTier),
        remainingCredits: profile[counterField],
      });
    }

    return {
      summary: this.mapProfileSummary(profile),
    };
  }

  async recordSuccessfulFeatureUsage({
    userId,
    feature,
    resourceType,
    resourceId,
    metadata,
    tx,
  }: ConsumeFeatureInput): Promise<CommercialProfileSummary> {
    const client = tx ?? prisma;
    const profile = await this.getOrCreateProfile(userId, client);
    const counterField = getProfileCounterField(feature);

    if (feature === "pdf_export" && profile.hasUnlimitedExports) {
      await client.commerceUsageEvent.create({
        data: {
          userId,
          profileId: profile.id,
          feature: usageFeatureMap[feature] as "PDF_EXPORT",
          creditsChanged: 0,
          remainingAfter: null,
          resourceType,
          resourceId,
          metadata,
        },
      });

      return this.mapProfileSummary(profile);
    }

    if (!counterField || profile[counterField] <= 0) {
      throw new CommercialAccessServiceError(getFeatureExhaustedErrorCode(feature), {
        currentPlan: planCodeMap[profile.planCode],
        currentModel: resolveAiModelForTier(profile.accessTier),
        remainingCredits: counterField ? profile[counterField] : null,
      });
    }

    const updateResult = await client.userCommerceProfile.updateMany({
      where: {
        id: profile.id,
        [counterField]: {
          gt: 0,
        },
      },
      data: {
        [counterField]: {
          decrement: 1,
        },
      },
    });

    const updatedProfile = await client.userCommerceProfile.findUnique({
      where: {
        id: profile.id,
      },
    });

    if (!updatedProfile) {
      throw new CommercialAccessServiceError("USER_NOT_FOUND");
    }

    if (updateResult.count === 0) {
      throw new CommercialAccessServiceError(getFeatureExhaustedErrorCode(feature), {
        currentPlan: planCodeMap[updatedProfile.planCode],
        currentModel: resolveAiModelForTier(updatedProfile.accessTier),
        remainingCredits: updatedProfile[counterField],
      });
    }

    await client.commerceUsageEvent.create({
      data: {
        userId,
        profileId: profile.id,
        feature: usageFeatureMap[feature] as
          | "MASTER_RESUME_GENERATE"
          | "JD_TAILOR"
          | "DIAGNOSE"
          | "PDF_EXPORT",
        creditsChanged: 1,
        remainingAfter: updatedProfile[counterField],
        resourceType,
        resourceId,
        metadata,
      },
    });

    return this.mapProfileSummary(updatedProfile);
  }

  async grantPaidPack({
    userId,
    paymentChannel,
    externalOrderId,
    notes,
    tx,
  }: GrantPaidPackInput) {
    if (tx) {
      return this.runGrantPaidPack({
        userId,
        paymentChannel,
        externalOrderId,
        notes,
        client: tx,
      });
    }

    return prisma.$transaction((innerTx) =>
      this.runGrantPaidPack({
        userId,
        paymentChannel,
        externalOrderId,
        notes,
        client: innerTx,
      }),
    );
  }

  private async getOrCreateProfile(
    userId: string,
    client: PrismaLike = prisma,
  ): Promise<CommerceProfileRecord> {
    return client.userCommerceProfile.upsert({
      where: {
        userId,
      },
      create: {
        userId,
      },
      update: {},
    });
  }

  private async runGrantPaidPack(input: {
    userId: string;
    paymentChannel?: string;
    externalOrderId?: string;
    notes?: string;
    client: PrismaLike;
  }) {
    const existingUser = await input.client.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      throw new CommercialAccessServiceError("USER_NOT_FOUND");
    }

    const profile = await this.getOrCreateProfile(input.userId, input.client);
    const now = new Date();
    const updatedProfile = await input.client.userCommerceProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        accessTier: "PAID",
        planCode: jdDiagnosePack29.code,
        masterResumeCreditsRemaining: Math.max(
          profile.masterResumeCreditsRemaining,
          1,
        ),
        jdTailorCreditsRemaining:
          profile.jdTailorCreditsRemaining + jdDiagnosePack29.jdTailorCredits,
        diagnosisCreditsRemaining:
          profile.diagnosisCreditsRemaining + jdDiagnosePack29.diagnosisCredits,
        hasUnlimitedExports: jdDiagnosePack29.hasUnlimitedExports,
        activatedAt: now,
      },
    });

    const order = await input.client.commerceOrder.create({
      data: {
        userId: input.userId,
        profileId: updatedProfile.id,
        planCode: jdDiagnosePack29.code,
        amountCents: jdDiagnosePack29.amountCents,
        currency: "CNY",
        status: input.paymentChannel ? "PAID" : "MANUAL_GRANTED",
        paymentChannel: input.paymentChannel ?? "manual",
        externalOrderId: input.externalOrderId ?? null,
        notes: input.notes?.trim() || "manual_paid_pack_grant",
        paidAt: now,
      },
    });

    await input.client.auditLog.create({
      data: {
        userId: input.userId,
        actionType: "COMMERCE_ORDER_GRANTED",
        resourceType: "COMMERCE_ORDER",
        resourceId: order.id,
        payload: {
          planCode: jdDiagnosePack29.code,
          amountCents: jdDiagnosePack29.amountCents,
          paymentChannel: order.paymentChannel,
          externalOrderId: order.externalOrderId,
        },
      },
    });

    return {
      order: mapOrderSummary(order, await paymentService.buildOrderPaymentSession(order)),
      profile: this.mapProfileSummary(updatedProfile),
    };
  }

  private async runConfirmOrderPaid(input: {
    orderId: string;
    userId?: string;
    paymentChannel?: string;
    externalOrderId?: string;
    notes?: string;
    paidStatus: "PAID" | "MANUAL_GRANTED";
    client: PrismaLike;
  }) {
    const order = await input.client.commerceOrder.findFirst({
      where: {
        id: input.orderId,
        ...(input.userId
          ? {
              userId: input.userId,
            }
          : {}),
      },
    });

    if (!order) {
      throw new CommercialAccessServiceError("ORDER_NOT_FOUND");
    }

    const profile = await this.getOrCreateProfile(order.userId, input.client);

    if (order.status === "PAID" || order.status === "MANUAL_GRANTED") {
      return {
        order: mapOrderSummary(order, await paymentService.buildOrderPaymentSession(order)),
        profile: this.mapProfileSummary(profile),
        alreadyProcessed: true,
      };
    }

    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      throw new CommercialAccessServiceError("ORDER_NOT_PAYABLE", {
        orderStatus: order.status.toLowerCase(),
      });
    }

    const markPaidResult = await input.client.commerceOrder.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
      },
      data: {
        profileId: profile.id,
        status: input.paidStatus,
        paymentChannel: input.paymentChannel?.trim() || order.paymentChannel || "manual",
        externalOrderId: input.externalOrderId?.trim() || order.externalOrderId,
        notes: input.notes?.trim() || order.notes,
        paidAt: order.paidAt ?? new Date(),
      },
    });

    const latestOrder = await input.client.commerceOrder.findUnique({
      where: {
        id: order.id,
      },
    });

    if (!latestOrder) {
      throw new CommercialAccessServiceError("ORDER_NOT_FOUND");
    }

    if (markPaidResult.count === 0) {
      if (latestOrder.status === "PAID" || latestOrder.status === "MANUAL_GRANTED") {
        return {
          order: mapOrderSummary(
            latestOrder,
            await paymentService.buildOrderPaymentSession(latestOrder),
          ),
          profile: this.mapProfileSummary(profile),
          alreadyProcessed: true,
        };
      }

      throw new CommercialAccessServiceError("ORDER_NOT_PAYABLE", {
        orderStatus: latestOrder.status.toLowerCase(),
      });
    }

    const updatedProfile = await input.client.userCommerceProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        accessTier: "PAID",
        planCode: latestOrder.planCode,
        masterResumeCreditsRemaining: Math.max(
          profile.masterResumeCreditsRemaining,
          1,
        ),
        jdTailorCreditsRemaining:
          profile.jdTailorCreditsRemaining +
          commercePlanCatalog[latestOrder.planCode].jdTailorCredits,
        diagnosisCreditsRemaining:
          profile.diagnosisCreditsRemaining +
          commercePlanCatalog[latestOrder.planCode].diagnosisCredits,
        hasUnlimitedExports:
          commercePlanCatalog[latestOrder.planCode].hasUnlimitedExports,
        activatedAt: latestOrder.paidAt ?? new Date(),
      },
    });

    await input.client.auditLog.create({
      data: {
        userId: latestOrder.userId,
        actionType: "COMMERCE_ORDER_PAID",
        resourceType: "COMMERCE_ORDER",
        resourceId: latestOrder.id,
        payload: {
          planCode: latestOrder.planCode,
          amountCents: latestOrder.amountCents,
          paymentChannel: latestOrder.paymentChannel,
          externalOrderId: latestOrder.externalOrderId,
          status: latestOrder.status,
        },
      },
    });

    return {
      order: mapOrderSummary(
        latestOrder,
        await paymentService.buildOrderPaymentSession(latestOrder),
      ),
      profile: this.mapProfileSummary(updatedProfile),
      alreadyProcessed: false,
    };
  }

  private mapProfileSummary(profile: CommerceProfileRecord): CommercialProfileSummary {
    const plan = commercePlanCatalog[profile.planCode];

    return {
      accessTier: accessTierMap[profile.accessTier],
      planCode: planCodeMap[profile.planCode],
      planLabel: plan.label,
      amountCents: plan.amountCents,
      currentAiModel: resolveAiModelForTier(profile.accessTier),
      quotas: {
        masterResumeCreditsRemaining: profile.masterResumeCreditsRemaining,
        jdTailorCreditsRemaining: profile.jdTailorCreditsRemaining,
        diagnosisCreditsRemaining: profile.diagnosisCreditsRemaining,
        pdfExportCreditsRemaining: profile.hasUnlimitedExports
          ? null
          : profile.pdfExportCreditsRemaining,
        hasUnlimitedExports: profile.hasUnlimitedExports,
      },
      activatedAt: profile.activatedAt?.toISOString() ?? null,
    };
  }
}

export const commercialAccessService = new CommercialAccessService();
