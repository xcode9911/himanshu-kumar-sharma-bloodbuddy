/*
  Warnings:

  - You are about to drop the column `RequestId` on the `DonationOffer` table. All the data in the column will be lost.
  - Made the column `OrganizationId` on table `DonationOffer` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "DonationOffer" DROP CONSTRAINT "DonationOffer_OrganizationId_fkey";

-- DropForeignKey
ALTER TABLE "DonationOffer" DROP CONSTRAINT "DonationOffer_RequestId_fkey";

-- AlterTable
ALTER TABLE "DonationOffer" DROP COLUMN "RequestId",
ADD COLUMN     "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "OrganizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "DonorResponse" (
    "ResponseId" SERIAL NOT NULL,
    "RequestId" INTEGER NOT NULL,
    "DonorId" INTEGER NOT NULL,
    "Status" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorResponse_pkey" PRIMARY KEY ("ResponseId")
);

-- CreateTable
CREATE TABLE "Location" (
    "LocationId" SERIAL NOT NULL,
    "ResponseId" INTEGER NOT NULL,
    "DonorId" INTEGER NOT NULL,
    "GainerId" INTEGER NOT NULL,
    "Latitude" DOUBLE PRECISION NOT NULL,
    "Longitude" DOUBLE PRECISION NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("LocationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_ResponseId_key" ON "Location"("ResponseId");

-- AddForeignKey
ALTER TABLE "DonationOffer" ADD CONSTRAINT "DonationOffer_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES "Organization"("OrganizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_DonorId_fkey" FOREIGN KEY ("DonorId") REFERENCES "Donor"("DonorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_RequestId_fkey" FOREIGN KEY ("RequestId") REFERENCES "BloodRequest"("RequestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_DonorId_fkey" FOREIGN KEY ("DonorId") REFERENCES "Donor"("DonorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_GainerId_fkey" FOREIGN KEY ("GainerId") REFERENCES "Gainer"("GainerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_ResponseId_fkey" FOREIGN KEY ("ResponseId") REFERENCES "DonorResponse"("ResponseId") ON DELETE RESTRICT ON UPDATE CASCADE;
