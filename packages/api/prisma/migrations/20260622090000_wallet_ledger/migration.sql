-- Wallet ledger: append-only record of every wallet movement.
CREATE TYPE "WalletTxType" AS ENUM ('TOPUP', 'MATCH_PAYMENT', 'REFUND', 'CANCELLATION_FEE', 'PAYOUT', 'ADMIN_ADJUSTMENT', 'REFERRAL_BONUS', 'WELCOME_BONUS');

CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
