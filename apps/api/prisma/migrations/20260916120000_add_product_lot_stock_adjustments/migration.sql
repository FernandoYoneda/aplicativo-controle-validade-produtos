CREATE TYPE "product_lot_stock_adjustment_type" AS ENUM ('ENTRY', 'ADJUSTMENT');

CREATE TABLE "product_lot_stock_adjustments" (
    "id" UUID NOT NULL,
    "product_lot_id" UUID NOT NULL,
    "performed_by_user_id" UUID NOT NULL,
    "type" "product_lot_stock_adjustment_type" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "previous_quantity" INTEGER NOT NULL,
    "resulting_quantity" INTEGER NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_lot_stock_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_lot_stock_adjustments_nonzero_delta_check" CHECK ("quantity_delta" <> 0),
    CONSTRAINT "product_lot_stock_adjustments_nonnegative_balances_check" CHECK ("previous_quantity" >= 0 AND "resulting_quantity" >= 0)
);

CREATE INDEX "product_lot_stock_adjustments_product_lot_id_created_at_idx"
ON "product_lot_stock_adjustments"("product_lot_id", "created_at");

CREATE INDEX "product_lot_stock_adjustments_performed_by_user_id_created_at_idx"
ON "product_lot_stock_adjustments"("performed_by_user_id", "created_at");

CREATE INDEX "product_lot_stock_adjustments_type_created_at_idx"
ON "product_lot_stock_adjustments"("type", "created_at");

ALTER TABLE "product_lot_stock_adjustments"
ADD CONSTRAINT "product_lot_stock_adjustments_product_lot_id_fkey"
FOREIGN KEY ("product_lot_id") REFERENCES "product_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_lot_stock_adjustments"
ADD CONSTRAINT "product_lot_stock_adjustments_performed_by_user_id_fkey"
FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
