-- Add ProfileImage column to User table (was added to schema without migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ProfileImage" TEXT;

-- Add PosterUrl column to Campaign table (replaces PosterData/PosterType in schema)
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "PosterUrl" TEXT;
