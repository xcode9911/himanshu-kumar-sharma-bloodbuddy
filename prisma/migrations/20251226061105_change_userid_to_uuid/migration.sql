/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_ReceiverId_fkey";

-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_SenderId_fkey";

-- DropForeignKey
ALTER TABLE "Donor" DROP CONSTRAINT "Donor_UserId_fkey";

-- DropForeignKey
ALTER TABLE "Gainer" DROP CONSTRAINT "Gainer_UserId_fkey";

-- DropForeignKey
ALTER TABLE "Organization" DROP CONSTRAINT "Organization_UserId_fkey";

-- DropForeignKey
ALTER TABLE "Otp" DROP CONSTRAINT "Otp_UserId_fkey";

-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "SenderId" SET DATA TYPE TEXT,
ALTER COLUMN "ReceiverId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Donor" ALTER COLUMN "UserId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Gainer" ALTER COLUMN "UserId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "UserId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Otp" ALTER COLUMN "UserId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "UserId" DROP DEFAULT,
ALTER COLUMN "UserId" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("UserId");
DROP SEQUENCE "User_UserId_seq";

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gainer" ADD CONSTRAINT "Gainer_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_ReceiverId_fkey" FOREIGN KEY ("ReceiverId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_SenderId_fkey" FOREIGN KEY ("SenderId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE SET NULL ON UPDATE CASCADE;
