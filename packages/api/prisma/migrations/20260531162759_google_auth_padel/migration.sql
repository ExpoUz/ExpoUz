/*
  Warnings:

  - The values [BASKETBALL,VOLLEYBALL,BADMINTON] on the enum `Sport` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[pitchBookingId]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[pitchBookingId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PitchBookingType" AS ENUM ('GROUP_HIRE', 'OPEN_JOIN');

-- CreateEnum
CREATE TYPE "PitchBookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED_REFUND', 'CANCELLED_PENALTY', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'NO_SHOW');

-- AlterEnum
ALTER TYPE "ConvType" ADD VALUE 'PITCH_HIRE';

-- AlterEnum
BEGIN;
CREATE TYPE "Sport_new" AS ENUM ('FOOTBALL', 'PADEL', 'TENNIS');
ALTER TABLE "Match" ALTER COLUMN "sport" DROP DEFAULT;
ALTER TABLE "Match" ALTER COLUMN "sport" TYPE "Sport_new" USING ("sport"::text::"Sport_new");
ALTER TYPE "Sport" RENAME TO "Sport_old";
ALTER TYPE "Sport_new" RENAME TO "Sport";
DROP TYPE "Sport_old";
ALTER TABLE "Match" ALTER COLUMN "sport" SET DEFAULT 'FOOTBALL';
COMMIT;

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_bookingId_fkey";

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "cancellationFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
ADD COLUMN     "cancellationWindowHours" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "pitchBookingId" TEXT,
ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramTopicId" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "telegramTopicId" TEXT,
ALTER COLUMN "cancellationDeadlineHours" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "Pitch" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "pitchBookingId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PitchBooking" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PitchBookingType" NOT NULL DEFAULT 'GROUP_HIRE',
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationHours" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "pricePerParticipant" DECIMAL(12,2),
    "maxParticipants" INTEGER,
    "status" "PitchBookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "cancellationDeadlineHours" INTEGER NOT NULL DEFAULT 5,
    "cancellationFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "notes" TEXT,
    "telegramTopicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchBookingParticipant" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paidAmount" DECIMAL(12,2),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchBookingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PitchBookingParticipant_bookingId_userId_key" ON "PitchBookingParticipant"("bookingId", "userId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_userId_key" ON "UserSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_pitchBookingId_key" ON "Conversation"("pitchBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_pitchBookingId_key" ON "Transaction"("pitchBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pitchBookingId_fkey" FOREIGN KEY ("pitchBookingId") REFERENCES "PitchBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_pitchBookingId_fkey" FOREIGN KEY ("pitchBookingId") REFERENCES "PitchBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchBooking" ADD CONSTRAINT "PitchBooking_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchBooking" ADD CONSTRAINT "PitchBooking_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchBookingParticipant" ADD CONSTRAINT "PitchBookingParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "PitchBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchBookingParticipant" ADD CONSTRAINT "PitchBookingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
