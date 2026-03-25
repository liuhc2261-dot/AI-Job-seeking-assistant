ALTER TABLE "commerce_orders"
ADD COLUMN "payment_payload" JSONB,
ADD COLUMN "payment_expires_at" TIMESTAMP(3);
