-- Time-slot availability: venue operating hours + slot/court config, plus
-- indices for the availability queries.

ALTER TABLE "Pitch" ADD COLUMN "openingHours" JSONB;
ALTER TABLE "Pitch" ADD COLUMN "slotDuration" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Pitch" ADD COLUMN "courtCount" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Pitch_sport_city_isActive_idx" ON "Pitch"("sport", "city", "isActive");
CREATE INDEX "Match_pitchId_startTime_idx" ON "Match"("pitchId", "startTime");
CREATE INDEX "Match_sport_startTime_idx" ON "Match"("sport", "startTime");
