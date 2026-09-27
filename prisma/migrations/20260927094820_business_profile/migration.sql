-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bizAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bizPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "payInfo" TEXT NOT NULL DEFAULT '';

