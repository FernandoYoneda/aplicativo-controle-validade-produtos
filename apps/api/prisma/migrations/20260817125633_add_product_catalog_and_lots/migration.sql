-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "barcode" VARCHAR(32),
    "name" VARCHAR(160) NOT NULL,
    "brand" VARCHAR(120),
    "category" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_products" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "store_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_lots" (
    "id" UUID NOT NULL,
    "store_product_id" UUID NOT NULL,
    "batch_number" VARCHAR(80),
    "expiration_date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_lots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_lots_quantity_positive_check" CHECK ("quantity" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "store_products_product_id_idx" ON "store_products"("product_id");

-- CreateIndex
CREATE INDEX "store_products_store_id_is_active_idx" ON "store_products"("store_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "store_products_store_id_product_id_key" ON "store_products"("store_id", "product_id");

-- CreateIndex
CREATE INDEX "product_lots_store_product_id_expiration_date_idx" ON "product_lots"("store_product_id", "expiration_date");

-- CreateIndex
CREATE INDEX "product_lots_expiration_date_idx" ON "product_lots"("expiration_date");

-- CreateIndex
CREATE INDEX "product_lots_is_active_idx" ON "product_lots"("is_active");

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lots" ADD CONSTRAINT "product_lots_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;