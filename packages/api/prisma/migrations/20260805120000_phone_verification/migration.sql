-- Phone verification: verified E.164 capture via Telegram contact / Gateway OTP.

-- CreateEnum
CREATE TYPE "PhoneVerifyMethod" AS ENUM ('TELEGRAM_CONTACT', 'TELEGRAM_GATEWAY', 'SMS', 'ADMIN');

-- AlterTable: verification flags on User. Existing rows default to unverified,
-- so users with a placeholder phone (e.g. "+998000…") are prompted at their
-- next gated action rather than losing access.
ALTER TABLE "User" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "phoneVerifyMethod" "PhoneVerifyMethod";

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestId" TEXT,
    "codeHash" TEXT,
    "method" "PhoneVerifyMethod" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneVerification_userId_idx" ON "PhoneVerification"("userId");
CREATE INDEX "PhoneVerification_phone_idx" ON "PhoneVerification"("phone");

-- AddForeignKey
ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
