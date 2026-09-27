-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendarToken" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "nudgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "nudgedAt" TIMESTAMP(3),
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "nudgedAt" TIMESTAMP(3),
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");

