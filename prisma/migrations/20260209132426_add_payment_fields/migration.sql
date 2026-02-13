/*
  Warnings:

  - Added the required column `Provider` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Token` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BloodRequest" ADD COLUMN     "PaymentStatus" TEXT NOT NULL DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "Provider" TEXT NOT NULL,
ADD COLUMN     "Token" TEXT NOT NULL,
ADD COLUMN     "TransactionId" TEXT;
