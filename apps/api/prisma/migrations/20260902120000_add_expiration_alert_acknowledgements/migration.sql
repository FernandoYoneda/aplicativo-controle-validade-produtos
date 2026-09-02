CREATE TYPE "expiration_alert_type" AS ENUM ('UPCOMING', 'EXPIRED');

CREATE TABLE "expiration_alert_acknowledgements" (
  "id" UUID NOT NULL,
  "product_lot_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "alert_type" "expiration_alert_type" NOT NULL,
  "acknowledged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expiration_alert_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expiration_alert_acknowledgements_product_lot_id_user_id_alert_type_key"
ON "expiration_alert_acknowledgements"("product_lot_id", "user_id", "alert_type");

CREATE INDEX "expiration_alert_acknowledgements_product_lot_id_alert_type_acknowledged_at_idx"
ON "expiration_alert_acknowledgements"("product_lot_id", "alert_type", "acknowledged_at");

CREATE INDEX "expiration_alert_acknowledgements_user_id_acknowledged_at_idx"
ON "expiration_alert_acknowledgements"("user_id", "acknowledged_at");

ALTER TABLE "expiration_alert_acknowledgements"
ADD CONSTRAINT "expiration_alert_acknowledgements_product_lot_id_fkey"
FOREIGN KEY ("product_lot_id") REFERENCES "product_lots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expiration_alert_acknowledgements"
ADD CONSTRAINT "expiration_alert_acknowledgements_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
