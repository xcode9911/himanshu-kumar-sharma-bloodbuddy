-- CreateTable
CREATE TABLE "User" (
    "UserId" SERIAL NOT NULL,
    "FullName" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "Phone" TEXT,
    "Role" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("UserId")
);

-- CreateTable
CREATE TABLE "Donor" (
    "DonorId" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "BloodType" TEXT NOT NULL,
    "EligibilityStatus" TEXT NOT NULL,
    "LastDonationDate" TIMESTAMP(3),
    "Location" TEXT NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("DonorId")
);

-- CreateTable
CREATE TABLE "Gainer" (
    "GainerId" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Address" TEXT,

    CONSTRAINT "Gainer_pkey" PRIMARY KEY ("GainerId")
);

-- CreateTable
CREATE TABLE "Organization" (
    "OrganizationId" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "OrganizationName" TEXT NOT NULL,
    "Location" TEXT NOT NULL,
    "Contact" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("OrganizationId")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "InventoryId" SERIAL NOT NULL,
    "OrganizationId" INTEGER NOT NULL,
    "BloodType" TEXT NOT NULL,
    "Units" INTEGER NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("InventoryId")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "CampaignId" SERIAL NOT NULL,
    "OrganizationId" INTEGER NOT NULL,
    "Title" TEXT NOT NULL,
    "Description" TEXT,
    "Location" TEXT NOT NULL,
    "StartDate" TIMESTAMP(3) NOT NULL,
    "EndDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("CampaignId")
);

-- CreateTable
CREATE TABLE "BloodRequest" (
    "RequestId" SERIAL NOT NULL,
    "GainerId" INTEGER NOT NULL,
    "OrganizationId" INTEGER NOT NULL,
    "BloodType" TEXT NOT NULL,
    "Units" INTEGER NOT NULL,
    "Status" TEXT NOT NULL,
    "RequestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodRequest_pkey" PRIMARY KEY ("RequestId")
);

-- CreateTable
CREATE TABLE "DonationOffer" (
    "OfferId" SERIAL NOT NULL,
    "RequestId" INTEGER NOT NULL,
    "DonorId" INTEGER NOT NULL,
    "OrganizationId" INTEGER,
    "Status" TEXT NOT NULL,
    "DonationDate" TIMESTAMP(3),

    CONSTRAINT "DonationOffer_pkey" PRIMARY KEY ("OfferId")
);

-- CreateTable
CREATE TABLE "Chat" (
    "ChatId" SERIAL NOT NULL,
    "SenderId" INTEGER NOT NULL,
    "ReceiverId" INTEGER NOT NULL,
    "Message" TEXT NOT NULL,
    "Timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Status" TEXT,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("ChatId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "PaymentId" SERIAL NOT NULL,
    "RequestId" INTEGER NOT NULL,
    "GainerId" INTEGER NOT NULL,
    "Amount" DOUBLE PRECISION NOT NULL,
    "Status" TEXT NOT NULL,
    "PaymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("PaymentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_Email_key" ON "User"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Donor_UserId_key" ON "Donor"("UserId");

-- CreateIndex
CREATE UNIQUE INDEX "Gainer_UserId_key" ON "Gainer"("UserId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_UserId_key" ON "Organization"("UserId");

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gainer" ADD CONSTRAINT "Gainer_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES "Organization"("OrganizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES "Organization"("OrganizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_GainerId_fkey" FOREIGN KEY ("GainerId") REFERENCES "Gainer"("GainerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES "Organization"("OrganizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationOffer" ADD CONSTRAINT "DonationOffer_DonorId_fkey" FOREIGN KEY ("DonorId") REFERENCES "Donor"("DonorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationOffer" ADD CONSTRAINT "DonationOffer_OrganizationId_fkey" FOREIGN KEY ("OrganizationId") REFERENCES "Organization"("OrganizationId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonationOffer" ADD CONSTRAINT "DonationOffer_RequestId_fkey" FOREIGN KEY ("RequestId") REFERENCES "BloodRequest"("RequestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_ReceiverId_fkey" FOREIGN KEY ("ReceiverId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_SenderId_fkey" FOREIGN KEY ("SenderId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_GainerId_fkey" FOREIGN KEY ("GainerId") REFERENCES "Gainer"("GainerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_RequestId_fkey" FOREIGN KEY ("RequestId") REFERENCES "BloodRequest"("RequestId") ON DELETE RESTRICT ON UPDATE CASCADE;
