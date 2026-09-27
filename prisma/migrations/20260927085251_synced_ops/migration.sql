-- CreateTable
CREATE TABLE "SyncedOp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedOp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SyncedOp" ADD CONSTRAINT "SyncedOp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

