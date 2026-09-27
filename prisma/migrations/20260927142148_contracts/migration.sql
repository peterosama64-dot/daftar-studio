-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shareToken" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "acceptedName" TEXT,
    "acceptedBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_taskId_key" ON "Contract"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_shareToken_key" ON "Contract"("shareToken");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

