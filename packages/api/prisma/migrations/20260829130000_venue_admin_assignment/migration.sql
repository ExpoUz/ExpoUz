-- PART 3: Venue admin scoping — per-user, per-pitch assignment overlay.
-- Layers on top of the Organization tenant boundary; never grants cross-org access.
CREATE TABLE "VenueAdminAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueAdminAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueAdminAssignment_userId_pitchId_key" ON "VenueAdminAssignment"("userId", "pitchId");
CREATE INDEX "VenueAdminAssignment_userId_idx" ON "VenueAdminAssignment"("userId");
CREATE INDEX "VenueAdminAssignment_pitchId_idx" ON "VenueAdminAssignment"("pitchId");

ALTER TABLE "VenueAdminAssignment" ADD CONSTRAINT "VenueAdminAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueAdminAssignment" ADD CONSTRAINT "VenueAdminAssignment_pitchId_fkey"
    FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
