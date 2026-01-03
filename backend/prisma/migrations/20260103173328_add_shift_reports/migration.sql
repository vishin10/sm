-- CreateTable
CREATE TABLE "ShiftReport" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "registerId" TEXT,
    "operatorId" TEXT,
    "tillId" TEXT,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "shiftStart" TIMESTAMP(3),
    "shiftEnd" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "beginningBalance" DECIMAL(12,2),
    "endingBalance" DECIMAL(12,2),
    "closingAccountability" DECIMAL(12,2),
    "cashierCounted" DECIMAL(12,2),
    "cashVariance" DECIMAL(12,2),
    "grossSales" DECIMAL(12,2),
    "netSales" DECIMAL(12,2),
    "refunds" DECIMAL(12,2),
    "discounts" DECIMAL(12,2),
    "taxTotal" DECIMAL(12,2),
    "totalTransactions" INTEGER,
    "fuelSales" DECIMAL(12,2),
    "fuelGross" DECIMAL(12,2),
    "fuelGallons" DECIMAL(12,3),
    "insideSales" DECIMAL(12,2),
    "merchandiseSales" DECIMAL(12,2),
    "prepaysInitiated" DECIMAL(12,2),
    "prepaysPumped" DECIMAL(12,2),
    "cashCount" INTEGER,
    "cashAmount" DECIMAL(12,2),
    "creditCount" INTEGER,
    "creditAmount" DECIMAL(12,2),
    "debitCount" INTEGER,
    "debitAmount" DECIMAL(12,2),
    "checkCount" INTEGER,
    "checkAmount" DECIMAL(12,2),
    "ebtCount" INTEGER,
    "ebtAmount" DECIMAL(12,2),
    "otherTenderCount" INTEGER,
    "otherTenderAmount" DECIMAL(12,2),
    "totalTenders" DECIMAL(12,2),
    "safeDropCount" INTEGER,
    "safeDropAmount" DECIMAL(12,2),
    "safeLoanCount" INTEGER,
    "safeLoanAmount" DECIMAL(12,2),
    "paidInCount" INTEGER,
    "paidInAmount" DECIMAL(12,2),
    "paidOutCount" INTEGER,
    "paidOutAmount" DECIMAL(12,2),
    "rawText" TEXT NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "extractionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftReportDepartment" (
    "id" TEXT NOT NULL,
    "shiftReportId" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "quantity" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ShiftReportDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftReportItem" (
    "id" TEXT NOT NULL,
    "shiftReportId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ShiftReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftReportException" (
    "id" TEXT NOT NULL,
    "shiftReportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2),

    CONSTRAINT "ShiftReportException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShiftReport_receiptHash_key" ON "ShiftReport"("receiptHash");

-- CreateIndex
CREATE INDEX "ShiftReport_storeId_idx" ON "ShiftReport"("storeId");

-- CreateIndex
CREATE INDEX "ShiftReport_reportDate_idx" ON "ShiftReport"("reportDate");

-- CreateIndex
CREATE INDEX "ShiftReport_shiftStart_idx" ON "ShiftReport"("shiftStart");

-- CreateIndex
CREATE INDEX "ShiftReportDepartment_shiftReportId_idx" ON "ShiftReportDepartment"("shiftReportId");

-- CreateIndex
CREATE INDEX "ShiftReportDepartment_departmentName_idx" ON "ShiftReportDepartment"("departmentName");

-- CreateIndex
CREATE INDEX "ShiftReportItem_shiftReportId_idx" ON "ShiftReportItem"("shiftReportId");

-- CreateIndex
CREATE INDEX "ShiftReportItem_itemName_idx" ON "ShiftReportItem"("itemName");

-- CreateIndex
CREATE INDEX "ShiftReportException_shiftReportId_idx" ON "ShiftReportException"("shiftReportId");

-- CreateIndex
CREATE INDEX "ShiftReportException_type_idx" ON "ShiftReportException"("type");

-- AddForeignKey
ALTER TABLE "ShiftReport" ADD CONSTRAINT "ShiftReport_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftReportDepartment" ADD CONSTRAINT "ShiftReportDepartment_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftReportItem" ADD CONSTRAINT "ShiftReportItem_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftReportException" ADD CONSTRAINT "ShiftReportException_shiftReportId_fkey" FOREIGN KEY ("shiftReportId") REFERENCES "ShiftReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
