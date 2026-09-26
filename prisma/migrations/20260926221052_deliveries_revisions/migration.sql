-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "reviewToken" TEXT,
ADD COLUMN     "revisionsAllowed" INTEGER;

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Delivery_taskId_idx" ON "Delivery"("taskId");

-- CreateIndex
CREATE INDEX "Revision_taskId_idx" ON "Revision"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_reviewToken_key" ON "Task"("reviewToken");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

