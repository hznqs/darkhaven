-- Etapa 6: snapshots e totais financeiros imutaveis da venda.
ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "estimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "estimatedProfit" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "estimatedMargin" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "SaleItem"
ADD COLUMN IF NOT EXISTS "productCategorySnapshot" TEXT,
ADD COLUMN IF NOT EXISTS "unitPriceSnapshot" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "unitCostSnapshot" DECIMAL(65,30);

UPDATE "SaleItem" AS item
SET
  "productNameSnapshot" = COALESCE(NULLIF(item."productNameSnapshot", ''), product."name"),
  "productSkuSnapshot" = COALESCE(item."productSkuSnapshot", product."sku"),
  "productCategorySnapshot" = COALESCE(item."productCategorySnapshot", product."category"),
  "unitPriceSnapshot" = COALESCE(item."unitPriceSnapshot", item."unitPrice", product."price", 0),
  "unitCostSnapshot" = COALESCE(item."unitCostSnapshot", item."estimatedUnitCost", product."cost", 0),
  "estimatedUnitCost" = COALESCE(item."estimatedUnitCost", item."unitCostSnapshot", product."cost", 0)
FROM "Product" AS product
WHERE item."productId" = product."id";

UPDATE "SaleItem"
SET
  "unitPriceSnapshot" = COALESCE("unitPriceSnapshot", "unitPrice", 0),
  "unitCostSnapshot" = COALESCE("unitCostSnapshot", "estimatedUnitCost", 0),
  "estimatedUnitCost" = COALESCE("estimatedUnitCost", "unitCostSnapshot", 0);

UPDATE "SaleItem"
SET "subtotal" = "unitPriceSnapshot" * "quantity";

ALTER TABLE "SaleItem"
ALTER COLUMN "unitPriceSnapshot" SET DEFAULT 0,
ALTER COLUMN "unitPriceSnapshot" SET NOT NULL,
ALTER COLUMN "unitCostSnapshot" SET DEFAULT 0,
ALTER COLUMN "unitCostSnapshot" SET NOT NULL;

WITH item_totals AS (
  SELECT
    "saleId",
    COALESCE(SUM("subtotal"), 0) AS "grossSubtotal",
    COALESCE(SUM("discount"), 0) AS "itemDiscount",
    COALESCE(SUM("unitCostSnapshot" * "quantity"), 0) AS "estimatedCost"
  FROM "SaleItem"
  GROUP BY "saleId"
),
sale_totals AS (
  SELECT
    sale."id",
    totals."grossSubtotal",
    COALESCE(sale."discount", 0) + totals."itemDiscount" AS "totalDiscount",
    GREATEST(totals."grossSubtotal" - COALESCE(sale."discount", 0) - totals."itemDiscount", 0) AS "totalSale",
    totals."estimatedCost"
  FROM "Sale" AS sale
  JOIN item_totals AS totals ON totals."saleId" = sale."id"
)
UPDATE "Sale" AS sale
SET
  "subtotal" = totals."grossSubtotal",
  "discount" = totals."totalDiscount",
  "total" = totals."totalSale",
  "estimatedCost" = totals."estimatedCost",
  "estimatedProfit" = totals."totalSale" - totals."estimatedCost",
  "estimatedMargin" = CASE
    WHEN totals."totalSale" > 0 THEN (totals."totalSale" - totals."estimatedCost") / totals."totalSale"
    ELSE 0
  END
FROM sale_totals AS totals
WHERE sale."id" = totals."id";
