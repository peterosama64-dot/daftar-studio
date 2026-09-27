-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fxRates" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "currency" TEXT;

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "origAmount" DOUBLE PRECISION,
ADD COLUMN     "origCurrency" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "currency" TEXT;

