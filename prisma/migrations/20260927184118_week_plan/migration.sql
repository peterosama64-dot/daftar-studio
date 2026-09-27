-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dayHours" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "estimate" INTEGER,
ADD COLUMN     "planDay" TIMESTAMP(3);

