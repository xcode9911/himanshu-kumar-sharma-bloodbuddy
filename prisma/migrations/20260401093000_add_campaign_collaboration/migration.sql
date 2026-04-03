-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN "IsCollaborativeCampaign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "CollaborationNote" TEXT;

-- CreateTable
CREATE TABLE "CampaignCollaboration" (
    "CollaborationId" SERIAL NOT NULL,
    "CampaignId" INTEGER NOT NULL,
    "OrganizationId" INTEGER NOT NULL,
    "InvitedByOrganizationId" INTEGER NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'pending',
    "Message" TEXT,
    "ResponseMessage" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "RespondedAt" TIMESTAMP(3),
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCollaboration_pkey" PRIMARY KEY ("CollaborationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCollaboration_CampaignId_OrganizationId_key"
ON "CampaignCollaboration"("CampaignId", "OrganizationId");

-- AddForeignKey
ALTER TABLE "CampaignCollaboration"
ADD CONSTRAINT "CampaignCollaboration_CampaignId_fkey"
FOREIGN KEY ("CampaignId") REFERENCES "Campaign"("CampaignId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCollaboration"
ADD CONSTRAINT "CampaignCollaboration_OrganizationId_fkey"
FOREIGN KEY ("OrganizationId") REFERENCES "Organization"("OrganizationId")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCollaboration"
ADD CONSTRAINT "CampaignCollaboration_InvitedByOrganizationId_fkey"
FOREIGN KEY ("InvitedByOrganizationId") REFERENCES "Organization"("OrganizationId")
ON DELETE RESTRICT ON UPDATE CASCADE;
