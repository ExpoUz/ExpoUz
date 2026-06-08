-- AlterEnum: extend MatchStatus with DRAFT/PUBLISHED
ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';

-- AlterEnum: new notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANCELLATION_WINDOW_CLOSING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVITE_JOINED';

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('OPEN_EVENT', 'GROUP_BOOKING', 'FULL_BOOKING');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM (
  'REGISTERED', 'LOGIN', 'PROFILE_UPDATED', 'MATCH_CREATED', 'MATCH_JOINED',
  'MATCH_LEFT', 'MATCH_CANCELLED', 'PAYMENT_INITIATED', 'PAYMENT_COMPLETED',
  'PAYMENT_FAILED', 'PAYMENT_REFUNDED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED',
  'INVITE_SENT', 'INVITE_ACCEPTED', 'RATING_GIVEN', 'RATING_RECEIVED', 'ADMIN_ACTION'
);

-- AlterTable: Match booking-type + cancellation-fee + invite + organizer fields
ALTER TABLE "Match"
  ADD COLUMN "cancellationFeePercent" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "bookingType" "BookingType" NOT NULL DEFAULT 'OPEN_EVENT',
  ADD COLUMN "organizerPlayerCount" INTEGER,
  ADD COLUMN "organizerTotalPaid" DECIMAL(12,2),
  ADD COLUMN "extraSpotsAvailable" INTEGER,
  ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fullBookingHours" INTEGER,
  ADD COLUMN "fullBookingTotalCost" DECIMAL(12,2),
  ADD COLUMN "telegramShareLink" TEXT,
  ADD COLUMN "shareCode" TEXT,
  ADD COLUMN "organizerId" TEXT;

-- AlterTable: ActivityLog typed category + description
ALTER TABLE "ActivityLog"
  ADD COLUMN "category" "ActivityCategory",
  ADD COLUMN "description" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_shareCode_key" ON "Match"("shareCode");

-- CreateIndex
CREATE INDEX "ActivityLog_category_idx" ON "ActivityLog"("category");

-- AddForeignKey
ALTER TABLE "Match"
  ADD CONSTRAINT "Match_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
