-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reviewsToken" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "ratedAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingNote" TEXT,
ADD COLUMN     "showcase" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_reviewsToken_key" ON "User"("reviewsToken");

