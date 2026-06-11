-- CreateEnum
CREATE TYPE "PadelCourtType" AS ENUM ('PANORAMIC', 'CLASSIC', 'SINGLE');

-- CreateEnum
CREATE TYPE "PlayerLevel" AS ENUM ('NEW', 'ROOKIE', 'REGULAR', 'EXPERIENCED', 'VETERAN', 'ELITE');

-- AlterEnum: additive padel court sizes
ALTER TYPE "PitchSize" ADD VALUE IF NOT EXISTS 'SINGLES';
ALTER TYPE "PitchSize" ADD VALUE IF NOT EXISTS 'DOUBLES';

-- AlterTable: Pitch padel attributes
ALTER TABLE "Pitch"
  ADD COLUMN "courtType" "PadelCourtType" NOT NULL DEFAULT 'PANORAMIC',
  ADD COLUMN "isCovered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: User ranking fields
ALTER TABLE "User"
  ADD COLUMN "gamesAttended" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "gamesThisMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "winCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "playerLevel" "PlayerLevel" NOT NULL DEFAULT 'NEW';

-- AlterTable: Match padel defaults (existing rows unchanged; affects new inserts)
ALTER TABLE "Match" ALTER COLUMN "sport" SET DEFAULT 'PADEL';
ALTER TABLE "Match" ALTER COLUMN "format" SET DEFAULT '2v2';
ALTER TABLE "Match" ALTER COLUMN "maxPlayers" SET DEFAULT 4;
ALTER TABLE "Match" ALTER COLUMN "minPlayers" SET DEFAULT 2;
