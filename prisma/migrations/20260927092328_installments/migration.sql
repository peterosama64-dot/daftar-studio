-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "due" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "entryId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Installment_taskId_idx" ON "Installment"("taskId");

-- CreateIndex
CREATE INDEX "Installment_userId_paidAt_idx" ON "Installment"("userId", "paidAt");

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

