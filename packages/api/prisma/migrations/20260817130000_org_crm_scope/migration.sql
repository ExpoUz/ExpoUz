-- Org-scope the venue CRM: attribute notes/reveals/broadcasts to an organization.

-- AlterTable
ALTER TABLE "VenuePlayerNote" ADD COLUMN "authorId" TEXT,
ADD COLUMN "orgId" TEXT;

-- AlterTable
ALTER TABLE "ContactReveal" ADD COLUMN "orgId" TEXT;

-- AlterTable
ALTER TABLE "VenueBroadcast" ADD COLUMN "orgId" TEXT;

-- CreateIndex
CREATE INDEX "VenuePlayerNote_orgId_playerId_idx" ON "VenuePlayerNote"("orgId", "playerId");

-- CreateIndex
CREATE INDEX "ContactReveal_orgId_idx" ON "ContactReveal"("orgId");

-- CreateIndex
CREATE INDEX "VenueBroadcast_orgId_createdAt_idx" ON "VenueBroadcast"("orgId", "createdAt");
