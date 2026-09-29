-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "groupInvoiceId" TEXT,
ADD COLUMN     "items" JSONB;

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "shareToken" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_shareToken_key" ON "ClientInvoice"("shareToken");

-- CreateIndex
CREATE INDEX "ClientInvoice_userId_issuedAt_idx" ON "ClientInvoice"("userId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_userId_invoiceNo_key" ON "ClientInvoice"("userId", "invoiceNo");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupInvoiceId_fkey" FOREIGN KEY ("groupInvoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

