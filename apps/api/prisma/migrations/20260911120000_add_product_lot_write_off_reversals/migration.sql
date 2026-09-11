CREATE TABLE "product_lot_write_off_reversals" (
    "id" UUID NOT NULL,
    "write_off_id" UUID NOT NULL,
    "reversed_by_user_id" UUID NOT NULL,
    "restored_quantity" INTEGER NOT NULL,
    "previous_quantity" INTEGER NOT NULL,
    "resulting_quantity" INTEGER NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_lot_write_off_reversals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_lot_write_off_reversals_restored_quantity_check" CHECK ("restored_quantity" > 0),
    CONSTRAINT "product_lot_write_off_reversals_previous_quantity_check" CHECK ("previous_quantity" >= 0),
    CONSTRAINT "product_lot_write_off_reversals_resulting_quantity_check" CHECK ("resulting_quantity" >= "restored_quantity")
);

CREATE UNIQUE INDEX "product_lot_write_off_reversals_write_off_id_key"
ON "product_lot_write_off_reversals"("write_off_id");

CREATE INDEX "product_lot_write_off_reversals_reversed_by_user_id_created_at_idx"
ON "product_lot_write_off_reversals"("reversed_by_user_id", "created_at");

ALTER TABLE "product_lot_write_off_reversals"
ADD CONSTRAINT "product_lot_write_off_reversals_write_off_id_fkey"
FOREIGN KEY ("write_off_id") REFERENCES "product_lot_write_offs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_lot_write_off_reversals"
ADD CONSTRAINT "product_lot_write_off_reversals_reversed_by_user_id_fkey"
FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
