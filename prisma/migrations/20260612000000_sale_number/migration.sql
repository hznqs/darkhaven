-- Etapa 7: numero sequencial visivel e seguro para vendas.
ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "saleNumber" INTEGER;

CREATE SEQUENCE IF NOT EXISTS "Sale_saleNumber_seq";

WITH base AS (
  SELECT COALESCE(MAX("saleNumber"), 0) AS "maxNumber"
  FROM "Sale"
),
numbered AS (
  SELECT
    sale."id",
    base."maxNumber" + ROW_NUMBER() OVER (ORDER BY sale."createdAt", sale."id") AS "nextNumber"
  FROM "Sale" AS sale
  CROSS JOIN base
  WHERE sale."saleNumber" IS NULL
)
UPDATE "Sale" AS sale
SET "saleNumber" = numbered."nextNumber"
FROM numbered
WHERE sale."id" = numbered."id";

SELECT setval(
  '"Sale_saleNumber_seq"',
  GREATEST((SELECT COALESCE(MAX("saleNumber"), 0) FROM "Sale"), 1),
  (SELECT COALESCE(MAX("saleNumber"), 0) > 0 FROM "Sale")
);

ALTER TABLE "Sale"
ALTER COLUMN "saleNumber" SET DEFAULT nextval('"Sale_saleNumber_seq"'),
ALTER COLUMN "saleNumber" SET NOT NULL;

ALTER SEQUENCE "Sale_saleNumber_seq" OWNED BY "Sale"."saleNumber";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Sale_saleNumber_key'
  ) THEN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_saleNumber_key" UNIQUE ("saleNumber");
  END IF;
END $$;
