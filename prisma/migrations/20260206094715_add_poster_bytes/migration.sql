-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "PosterData" BYTEA,
ADD COLUMN     "PosterType" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "NotificationId" SERIAL NOT NULL,
    "UserId" TEXT NOT NULL,
    "Title" TEXT NOT NULL,
    "Message" TEXT NOT NULL,
    "Type" TEXT NOT NULL,
    "RelatedId" INTEGER,
    "IsRead" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("NotificationId")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;
