CREATE TYPE "expiration_email_notification_type" AS ENUM (
  'EXPIRATION_NEXT_30_DAYS',
  'EXPIRATION_EXPIRED',
  'WRITE_OFF_SOLD',
  'WRITE_OFF_EXPIRED',
  'WRITE_OFF_DISCARDED'
);

CREATE TYPE "expiration_email_delivery_status" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED'
);

CREATE TABLE "expiration_email_deliveries" (
  "id" UUID NOT NULL,
  "notification_type" "expiration_email_notification_type" NOT NULL,
  "status" "expiration_email_delivery_status" NOT NULL DEFAULT 'PENDING',
  "fingerprint" VARCHAR(255) NOT NULL,
  "recipient_name" VARCHAR(120),
  "recipient_email" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "error_message" VARCHAR(1000),
  "product_lot_id" UUID,
  "write_off_id" UUID,
  "sent_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "expiration_email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expiration_email_deliveries_fingerprint_key"
ON "expiration_email_deliveries"("fingerprint");

CREATE INDEX "expiration_email_deliveries_notification_type_status_created_at_idx"
ON "expiration_email_deliveries"("notification_type", "status", "created_at");

CREATE INDEX "expiration_email_deliveries_product_lot_id_created_at_idx"
ON "expiration_email_deliveries"("product_lot_id", "created_at");

CREATE INDEX "expiration_email_deliveries_write_off_id_created_at_idx"
ON "expiration_email_deliveries"("write_off_id", "created_at");

ALTER TABLE "expiration_email_deliveries"
ADD CONSTRAINT "expiration_email_deliveries_product_lot_id_fkey"
FOREIGN KEY ("product_lot_id") REFERENCES "product_lots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expiration_email_deliveries"
ADD CONSTRAINT "expiration_email_deliveries_write_off_id_fkey"
FOREIGN KEY ("write_off_id") REFERENCES "product_lot_write_offs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
