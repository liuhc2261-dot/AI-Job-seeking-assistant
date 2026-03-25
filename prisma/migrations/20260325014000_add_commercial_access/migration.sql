-- CreateEnum
CREATE TYPE "CommerceAccessTier" AS ENUM ('TRIAL', 'PAID');

-- CreateEnum
CREATE TYPE "CommercePlanCode" AS ENUM ('TRIAL', 'JD_DIAGNOSE_PACK_29');

-- CreateEnum
CREATE TYPE "CommerceOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'MANUAL_GRANTED');

-- CreateEnum
CREATE TYPE "CommerceUsageFeature" AS ENUM ('MASTER_RESUME_GENERATE', 'JD_TAILOR', 'DIAGNOSE', 'PDF_EXPORT');

-- CreateTable
CREATE TABLE "user_commerce_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_tier" "CommerceAccessTier" NOT NULL DEFAULT 'TRIAL',
    "plan_code" "CommercePlanCode" NOT NULL DEFAULT 'TRIAL',
    "master_resume_credits_remaining" INTEGER NOT NULL DEFAULT 1,
    "jd_tailor_credits_remaining" INTEGER NOT NULL DEFAULT 1,
    "diagnosis_credits_remaining" INTEGER NOT NULL DEFAULT 1,
    "pdf_export_credits_remaining" INTEGER NOT NULL DEFAULT 1,
    "has_unlimited_exports" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_commerce_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID,
    "plan_code" "CommercePlanCode" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_channel" TEXT,
    "external_order_id" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_usage_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID,
    "feature" "CommerceUsageFeature" NOT NULL,
    "credits_changed" INTEGER NOT NULL DEFAULT 1,
    "remaining_after" INTEGER,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_commerce_profiles_user_id_key" ON "user_commerce_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_commerce_profiles_user_id_idx" ON "user_commerce_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_commerce_profiles_access_tier_idx" ON "user_commerce_profiles"("access_tier");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_external_order_id_key" ON "commerce_orders"("external_order_id");

-- CreateIndex
CREATE INDEX "commerce_orders_user_id_idx" ON "commerce_orders"("user_id");

-- CreateIndex
CREATE INDEX "commerce_orders_profile_id_idx" ON "commerce_orders"("profile_id");

-- CreateIndex
CREATE INDEX "commerce_orders_status_idx" ON "commerce_orders"("status");

-- CreateIndex
CREATE INDEX "commerce_usage_events_user_id_idx" ON "commerce_usage_events"("user_id");

-- CreateIndex
CREATE INDEX "commerce_usage_events_profile_id_idx" ON "commerce_usage_events"("profile_id");

-- CreateIndex
CREATE INDEX "commerce_usage_events_feature_idx" ON "commerce_usage_events"("feature");

-- AddForeignKey
ALTER TABLE "user_commerce_profiles" ADD CONSTRAINT "user_commerce_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_commerce_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_usage_events" ADD CONSTRAINT "commerce_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_usage_events" ADD CONSTRAINT "commerce_usage_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_commerce_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
