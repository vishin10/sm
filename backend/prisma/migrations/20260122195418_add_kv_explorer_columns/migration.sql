-- AlterTable
ALTER TABLE "ShiftReport" ADD COLUMN     "kvPairs" JSONB,
ADD COLUMN     "parsedJson" JSONB,
ADD COLUMN     "summary" JSONB,
ADD COLUMN     "vendorType" TEXT;
