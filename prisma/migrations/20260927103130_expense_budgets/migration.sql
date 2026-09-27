-- AlterTable
ALTER TABLE "User" ADD COLUMN     "budgets" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "category" TEXT;

