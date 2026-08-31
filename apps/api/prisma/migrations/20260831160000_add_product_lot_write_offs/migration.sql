CREATE TYPE "product_lot_write_off_reason" AS ENUM ('SOLD', 'EXPIRED', 'DISCARDED');

CREATE TABLE "product_lot_write_offs" (
    "id" UUID NOT NULL,
    "product_lot_id" UUID NOT NULL,
    "performed_by_user_id" UUID NOT NULL,
    "reason" "product_lot_write_off_reason" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previous_quantity" INTEGER NOT NULL,
    "remaining_quantity" INTEGER NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_lot_write_offs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_lot_write_offs_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "product_lot_write_offs_previous_quantity_check" CHECK ("previous_quantity" > 0),
    CONSTRAINT "product_lot_write_offs_remaining_quantity_check" CHECK ("remaining_quantity" >= 0)
);

CREATE INDEX "product_lot_write_offs_product_lot_id_created_at_idx"
ON "product_lot_write_offs"("product_lot_id", "created_at");

CREATE INDEX "product_lot_write_offs_performed_by_user_id_created_at_idx"
ON "product_lot_write_offs"("performed_by_user_id", "created_at");

CREATE INDEX "product_lot_write_offs_reason_created_at_idx"
ON "product_lot_write_offs"("reason", "created_at");

ALTER TABLE "product_lot_write_offs"
ADD CONSTRAINT "product_lot_write_offs_product_lot_id_fkey"
FOREIGN KEY ("product_lot_id") REFERENCES "product_lots"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_lot_write_offs"
ADD CONSTRAINT "product_lot_write_offs_performed_by_user_id_fkey"
FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
