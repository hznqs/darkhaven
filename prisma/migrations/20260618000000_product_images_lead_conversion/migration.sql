ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "convertedCustomerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_convertedAt_idx" ON "Lead"("convertedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Lead_convertedCustomerId_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_convertedCustomerId_fkey"
      FOREIGN KEY ("convertedCustomerId")
      REFERENCES "Customer"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
