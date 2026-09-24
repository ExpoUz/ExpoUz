-- Booking backbone (Steps 5–6): admin confirm/decline, 2h expiry, phone bookings.

-- Step 5: new terminal states for the awaiting-confirmation flow.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Step 5: reason shown to the player when a venue declines an awaiting booking.
ALTER TABLE "Booking" ADD COLUMN "declineReason" TEXT;

-- Step 6: phone bookings — places the venue admin reserves for a caller.
ALTER TABLE "Booking" ADD COLUMN "isPhoneBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "callerName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "callerPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paidOffline" BOOLEAN NOT NULL DEFAULT false;
