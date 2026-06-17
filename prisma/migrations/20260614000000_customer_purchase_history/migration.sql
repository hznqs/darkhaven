-- Etapa 9: historico recente de compras do cliente, sem expirar vendas oficiais.
CREATE TABLE IF NOT EXISTS "CustomerPurchaseHistory" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "summary" TEXT NOT NULL,
  "total" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPurchaseHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPurchaseHistory_saleId_key"
ON "CustomerPurchaseHistory"("saleId");

CREATE INDEX IF NOT EXISTS "CustomerPurchaseHistory_customerId_expiresAt_idx"
ON "CustomerPurchaseHistory"("customerId", "expiresAt");

CREATE INDEX IF NOT EXISTS "CustomerPurchaseHistory_expiresAt_idx"
ON "CustomerPurchaseHistory"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CustomerPurchaseHistory_customerId_fkey'
  ) THEN
    ALTER TABLE "CustomerPurchaseHistory"
    ADD CONSTRAINT "CustomerPurchaseHistory_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CustomerPurchaseHistory_saleId_fkey'
  ) THEN
    ALTER TABLE "CustomerPurchaseHistory"
    ADD CONSTRAINT "CustomerPurchaseHistory_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

WITH sale_items AS (
  SELECT
    item."saleId",
    STRING_AGG(
      CONCAT(item."quantity", 'x ', COALESCE(NULLIF(item."productNameSnapshot", ''), 'Produto')),
      ', '
      ORDER BY item."id"
    ) AS "itemsSummary"
  FROM "SaleItem" AS item
  GROUP BY item."saleId"
)
INSERT INTO "CustomerPurchaseHistory" (
  "id",
  "customerId",
  "saleId",
  "purchasedAt",
  "expiresAt",
  "summary",
  "total",
  "createdAt"
)
SELECT
  CONCAT('cph_', SUBSTRING(MD5(sale."id") FROM 1 FOR 24)),
  sale."customerId",
  sale."id",
  sale."createdAt",
  sale."createdAt" + INTERVAL '30 days',
  LEFT(CONCAT('Venda #', sale."saleNumber", ' - ', COALESCE(sale_items."itemsSummary", 'Sem itens')), 500),
  sale."total",
  CURRENT_TIMESTAMP
FROM "Sale" AS sale
LEFT JOIN sale_items ON sale_items."saleId" = sale."id"
WHERE sale."createdAt" + INTERVAL '30 days' > CURRENT_TIMESTAMP
ON CONFLICT ("saleId") DO NOTHING;
