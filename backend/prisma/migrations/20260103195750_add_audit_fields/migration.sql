/*
  Add audit fields for duplicate tracking.
  Added default for updatedAt to handle existing rows.
*/
-- AlterTable
ALTER TABLE "ShiftReport" ADD COLUMN     "lastUploadReason" TEXT,
ADD COLUMN     "lastUploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "uploadCount" INTEGER NOT NULL DEFAULT 1;
