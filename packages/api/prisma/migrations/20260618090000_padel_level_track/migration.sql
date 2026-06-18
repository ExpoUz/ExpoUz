-- Dedicated padel level track, independent of football eloRating/skillLevel.
-- Existing users start unassessed at padel (0.0); the padel onboarding
-- questionnaire sets their first padelLevel. We intentionally do NOT copy
-- skillRating into padelLevel — that would re-mix the two sports.
ALTER TABLE "User" ADD COLUMN "padelLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE "User" ADD COLUMN "padelReliability" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "padelInitialSet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "padelMatchesPlayed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "padelMatchesWon" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "padelMatchesLost" INTEGER NOT NULL DEFAULT 0;
