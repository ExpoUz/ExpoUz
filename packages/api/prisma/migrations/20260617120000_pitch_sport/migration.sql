-- Each venue belongs to one sport. Default PADEL keeps existing courts
-- correctly labelled after the padel pivot; football pitches set FOOTBALL.
ALTER TABLE "Pitch" ADD COLUMN "sport" "Sport" NOT NULL DEFAULT 'PADEL';
