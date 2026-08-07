-- Venue Owner CRM: private notes, contact-reveal audit, broadcast log + mutes,
-- misuse reports, and per-owner CRM/broadcast disable flags.

ALTER TABLE "User" ADD COLUMN "crmDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "broadcastDisabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "VenuePlayerNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "pitchId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VenuePlayerNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenuePlayerNote_ownerId_playerId_idx" ON "VenuePlayerNote"("ownerId", "playerId");

CREATE TABLE "ContactReveal" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactReveal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactReveal_ownerId_idx" ON "ContactReveal"("ownerId");
CREATE INDEX "ContactReveal_playerId_idx" ON "ContactReveal"("playerId");

CREATE TABLE "VenueBroadcast" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueBroadcast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenueBroadcast_ownerId_idx" ON "VenueBroadcast"("ownerId");
CREATE INDEX "VenueBroadcast_createdAt_idx" ON "VenueBroadcast"("createdAt");

CREATE TABLE "VenueBroadcastMute" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueBroadcastMute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VenueBroadcastMute_ownerId_playerId_key" ON "VenueBroadcastMute"("ownerId", "playerId");
CREATE INDEX "VenueBroadcastMute_playerId_idx" ON "VenueBroadcastMute"("playerId");

CREATE TABLE "VenueReport" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenueReport_ownerId_idx" ON "VenueReport"("ownerId");
CREATE INDEX "VenueReport_resolved_idx" ON "VenueReport"("resolved");
