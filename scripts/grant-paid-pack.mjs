import process from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL_NOT_CONFIGURED");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const paidPack = {
  code: "JD_DIAGNOSE_PACK_29",
  label: "29 元冲刺包",
  amountCents: 2900,
  currency: "CNY",
  jdTailorCredits: 10,
  diagnosisCredits: 10,
};

function readOption(args, optionName) {
  const optionIndex = args.indexOf(optionName);

  if (optionIndex < 0) {
    return "";
  }

  return args[optionIndex + 1] ?? "";
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run commerce:grant -- --email user@example.com",
      "  npm run commerce:grant -- --user-id <uuid> --channel wechat --order-id wx_123",
      "",
      "Options:",
      "  --email      用户邮箱，和 --user-id 二选一",
      "  --user-id    用户 ID，和 --email 二选一",
      "  --channel    支付渠道，可选，默认 manual",
      "  --order-id   外部订单号，可选",
      "  --notes      备注，可选",
    ].join("\n"),
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const email = readOption(args, "--email").trim().toLowerCase();
  const userId = readOption(args, "--user-id").trim();
  const paymentChannel = readOption(args, "--channel").trim();
  const externalOrderId = readOption(args, "--order-id").trim();
  const notes = readOption(args, "--notes").trim();

  if (!email && !userId) {
    printUsage();
    throw new Error("MISSING_USER_IDENTIFIER");
  }

  const user = await prisma.user.findFirst({
    where: email
      ? {
          email,
        }
      : {
          id: userId,
        },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const now = new Date();
  const resolvedChannel = paymentChannel || "manual";
  const orderStatus =
    resolvedChannel.toLowerCase() === "manual" ? "MANUAL_GRANTED" : "PAID";

  const result = await prisma.$transaction(async (tx) => {
    const existingProfile = await tx.userCommerceProfile.findUnique({
      where: {
        userId: user.id,
      },
    });

    const profile =
      existingProfile ??
      (await tx.userCommerceProfile.create({
        data: {
          userId: user.id,
        },
      }));

    const updatedProfile = await tx.userCommerceProfile.update({
      where: {
        id: profile.id,
      },
      data: {
        accessTier: "PAID",
        planCode: paidPack.code,
        masterResumeCreditsRemaining: Math.max(
          profile.masterResumeCreditsRemaining,
          1,
        ),
        jdTailorCreditsRemaining:
          profile.jdTailorCreditsRemaining + paidPack.jdTailorCredits,
        diagnosisCreditsRemaining:
          profile.diagnosisCreditsRemaining + paidPack.diagnosisCredits,
        hasUnlimitedExports: true,
        activatedAt: now,
      },
    });

    const order = await tx.commerceOrder.create({
      data: {
        userId: user.id,
        profileId: updatedProfile.id,
        planCode: paidPack.code,
        amountCents: paidPack.amountCents,
        currency: paidPack.currency,
        status: orderStatus,
        paymentChannel: resolvedChannel,
        externalOrderId: externalOrderId || null,
        notes: notes || "manual_paid_pack_grant",
        paidAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        actionType: "COMMERCE_ORDER_GRANTED",
        resourceType: "COMMERCE_ORDER",
        resourceId: order.id,
        payload: {
          planCode: paidPack.code,
          amountCents: paidPack.amountCents,
          paymentChannel: resolvedChannel,
          externalOrderId: externalOrderId || null,
        },
      },
    });

    return {
      user,
      profile: updatedProfile,
      order,
    };
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        grantedPlan: paidPack.label,
        user: result.user,
        profile: {
          accessTier: result.profile.accessTier,
          planCode: result.profile.planCode,
          masterResumeCreditsRemaining: result.profile.masterResumeCreditsRemaining,
          jdTailorCreditsRemaining: result.profile.jdTailorCreditsRemaining,
          diagnosisCreditsRemaining: result.profile.diagnosisCreditsRemaining,
          hasUnlimitedExports: result.profile.hasUnlimitedExports,
          activatedAt: result.profile.activatedAt?.toISOString() ?? null,
        },
        order: {
          id: result.order.id,
          status: result.order.status,
          paymentChannel: result.order.paymentChannel,
          externalOrderId: result.order.externalOrderId,
          amountCents: result.order.amountCents,
          currency: result.order.currency,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          success: false,
          message: error instanceof Error ? error.message : "unknown_error",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
