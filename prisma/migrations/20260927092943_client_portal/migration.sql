-- AlterTable
ALTER TABLE "ClientInfo" ADD COLUMN     "portalToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClientInfo_portalToken_key" ON "ClientInfo"("portalToken");

