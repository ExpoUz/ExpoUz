-- CreateEnum
CREATE TYPE "BestHand" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "CourtPosition" AS ENUM ('FOREHAND', 'BACKHAND', 'BOTH');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('CASUAL', 'COMPETITIVE');

-- AlterTable: User skill-rating fields
ALTER TABLE "User"
  ADD COLUMN "skillRating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN "levelReliability" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "initialLevelSet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "matchesWon" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "matchesLost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "longestWinStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bestHand" "BestHand" DEFAULT 'RIGHT',
  ADD COLUMN "courtPosition" "CourtPosition" DEFAULT 'BOTH',
  ADD COLUMN "preferredMatchType" "MatchType" DEFAULT 'COMPETITIVE';

-- AlterTable: Match competitive-scoring fields
ALTER TABLE "Match"
  ADD COLUMN "matchType" "MatchType" NOT NULL DEFAULT 'COMPETITIVE',
  ADD COLUMN "minLevel" DOUBLE PRECISION,
  ADD COLUMN "maxLevel" DOUBLE PRECISION,
  ADD COLUMN "resultSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LevelHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "reliability" INTEGER NOT NULL,
    "change" DOUBLE PRECISION NOT NULL,
    "matchId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LevelHistory_userId_idx" ON "LevelHistory"("userId");

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "team1Set1" INTEGER,
    "team2Set1" INTEGER,
    "team1Set2" INTEGER,
    "team2Set2" INTEGER,
    "team1Set3" INTEGER,
    "team2Set3" INTEGER,
    "winningTeam" INTEGER NOT NULL,
    "submittedById" TEXT NOT NULL,
    "confirmedBy" TEXT[],
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_matchId_key" ON "MatchResult"("matchId");

-- CreateTable (implicit m2m: MatchResult <-> User)
CREATE TABLE "_PlayerResults" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PlayerResults_AB_unique" ON "_PlayerResults"("A", "B");

-- CreateIndex
CREATE INDEX "_PlayerResults_B_index" ON "_PlayerResults"("B");

-- AddForeignKey
ALTER TABLE "LevelHistory" ADD CONSTRAINT "LevelHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayerResults" ADD CONSTRAINT "_PlayerResults_A_fkey" FOREIGN KEY ("A") REFERENCES "MatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayerResults" ADD CONSTRAINT "_PlayerResults_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
