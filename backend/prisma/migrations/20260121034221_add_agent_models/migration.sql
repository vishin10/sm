-- CreateTable
CREATE TABLE "AgentApiKey" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AgentApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUpload" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "s3Key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "shiftReportId" TEXT,

    CONSTRAINT "AgentUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSetupPin" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSetupPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentApiKey_storeId_idx" ON "AgentApiKey"("storeId");

-- CreateIndex
CREATE INDEX "AgentApiKey_keyHash_idx" ON "AgentApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgentUpload_shiftReportId_key" ON "AgentUpload"("shiftReportId");

-- CreateIndex
CREATE INDEX "AgentUpload_storeId_uploadedAt_idx" ON "AgentUpload"("storeId", "uploadedAt");

-- CreateIndex
CREATE INDEX "AgentUpload_status_idx" ON "AgentUpload"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentUpload_fileHash_storeId_key" ON "AgentUpload"("fileHash", "storeId");

-- CreateIndex
CREATE INDEX "AgentSetupPin_pin_idx" ON "AgentSetupPin"("pin");

-- CreateIndex
CREATE INDEX "AgentSetupPin_expiresAt_idx" ON "AgentSetupPin"("expiresAt");

-- AddForeignKey
ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentUpload" ADD CONSTRAINT "AgentUpload_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentUpload" ADD CONSTRAINT "AgentUpload_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSetupPin" ADD CONSTRAINT "AgentSetupPin_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
