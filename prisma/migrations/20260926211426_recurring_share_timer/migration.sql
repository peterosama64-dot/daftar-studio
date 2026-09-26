-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "recurringId" TEXT,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "timeSpent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timerStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "shareToken" TEXT;

-- CreateTable
CREATE TABLE "RecurringJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringJob_userId_idx" ON "RecurringJob"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_shareToken_key" ON "Task"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_shareToken_key" ON "Quote"("shareToken");

-- AddForeignKey
ALTER TABLE "RecurringJob" ADD CONSTRAINT "RecurringJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

