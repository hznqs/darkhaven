-- Etapa 8: numero sequencial visivel e seguro para pedidos.
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER;

CREATE SEQUENCE IF NOT EXISTS "Order_orderNumber_seq";

WITH base AS (
  SELECT COALESCE(MAX("orderNumber"), 0) AS "maxNumber"
  FROM "Order"
),
numbered AS (
  SELECT
    "order"."id",
    base."maxNumber" + ROW_NUMBER() OVER (ORDER BY "order"."createdAt", "order"."id") AS "nextNumber"
  FROM "Order" AS "order"
  CROSS JOIN base
  WHERE "order"."orderNumber" IS NULL
)
UPDATE "Order" AS "order"
SET "orderNumber" = numbered."nextNumber"
FROM numbered
WHERE "order"."id" = numbered."id";

SELECT setval(
  '"Order_orderNumber_seq"',
  GREATEST((SELECT COALESCE(MAX("orderNumber"), 0) FROM "Order"), 1),
  (SELECT COALESCE(MAX("orderNumber"), 0) > 0 FROM "Order")
);

ALTER TABLE "Order"
ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"'),
ALTER COLUMN "orderNumber" SET NOT NULL;

ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Order_orderNumber_key'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_orderNumber_key" UNIQUE ("orderNumber");
  END IF;
END $$;
