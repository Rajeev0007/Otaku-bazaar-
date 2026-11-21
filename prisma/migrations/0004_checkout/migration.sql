-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cartId" TEXT,
ADD COLUMN     "codFeeTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentMethod" TEXT;
