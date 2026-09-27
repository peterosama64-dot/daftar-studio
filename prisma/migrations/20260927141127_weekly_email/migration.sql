-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastWeekly" TEXT,
ADD COLUMN     "weeklyEmail" BOOLEAN NOT NULL DEFAULT false;

