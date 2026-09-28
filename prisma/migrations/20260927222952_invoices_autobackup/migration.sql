-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoBackup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
ADD COLUMN     "invoiceSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceYear" INTEGER,
ADD COLUMN     "lastAutoBackup" TEXT,
ADD COLUMN     "taxNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "taxRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "discount" DOUBLE PRECISION,
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "invoicedAt" TIMESTAMP(3),
ADD COLUMN     "taxRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AutoBackup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoBackup_userId_createdAt_idx" ON "AutoBackup"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_userId_invoiceNo_key" ON "Task"("userId", "invoiceNo");

-- AddForeignKey
ALTER TABLE "AutoBackup" ADD CONSTRAINT "AutoBackup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

