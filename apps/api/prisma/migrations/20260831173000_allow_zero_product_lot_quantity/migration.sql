ALTER TABLE "product_lots"
DROP CONSTRAINT "product_lots_quantity_positive_check";

ALTER TABLE "product_lots"
ADD CONSTRAINT "product_lots_quantity_non_negative_check"
CHECK ("quantity" >= 0);
