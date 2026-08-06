-- Host & guest slots so bookings are the single source of truth for occupancy.
-- No unique (userId, matchId) constraint exists to drop; an organizer legitimately
-- holds several guest-slot bookings, and the "already joined" check is scoped in
-- code to non-guest bookings.

ALTER TABLE "Booking" ADD COLUMN "isHostBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "isGuestSlot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "guestLabel" TEXT;

-- Speeds up the occupancy re-count that runs inside every join/leave/cancel tx.
CREATE INDEX "Booking_matchId_status_idx" ON "Booking"("matchId", "status");
