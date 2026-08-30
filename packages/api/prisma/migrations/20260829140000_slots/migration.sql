-- PART 6: Slot-based booking. Admins publish priced, bookable slots; users book into them.
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED', 'PAST');

ALTER TABLE "Pitch" ADD COLUMN "defaultPrice" DECIMAL(12,2);

CREATE TABLE "Slot" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "courtNumber" INTEGER,
    "blockReason" TEXT,
    "matchId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Slot_matchId_key" ON "Slot"("matchId");
-- NOTE: courtNumber is always populated by slot generation (defaults to 1) so
-- this uniqueness genuinely prevents overlaps — Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX "Slot_pitchId_courtNumber_startTime_key" ON "Slot"("pitchId", "courtNumber", "startTime");
CREATE INDEX "Slot_pitchId_startTime_idx" ON "Slot"("pitchId", "startTime");
CREATE INDEX "Slot_status_startTime_idx" ON "Slot"("status", "startTime");

ALTER TABLE "Slot" ADD CONSTRAINT "Slot_pitchId_fkey"
    FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
