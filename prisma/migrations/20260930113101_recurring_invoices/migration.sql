-- AlterTable
ALTER TABLE "RecurringJob" ADD COLUMN     "autoInvoice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastInvoice" TEXT;

