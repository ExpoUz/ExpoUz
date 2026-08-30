-- PART 1: Football-pitch-saved-as-padel bug fix.
-- Drop the PADEL default on Pitch.sport so any create path that omits `sport`
-- fails loudly instead of silently mislabelling the venue. All application
-- create paths (pitches.service via CreatePitchDto, admin.service.createPitch,
-- and both seed scripts) now supply `sport` explicitly.
--
-- NOTE: this does NOT back-fill or flip existing rows. Mislabelled venues are
-- reported for human confirmation by prisma/scripts/report-mislabeled-sport.ts.
ALTER TABLE "Pitch" ALTER COLUMN "sport" DROP DEFAULT;
