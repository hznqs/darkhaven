-- DropIndex
DROP INDEX "Lead_convertedAt_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true;
