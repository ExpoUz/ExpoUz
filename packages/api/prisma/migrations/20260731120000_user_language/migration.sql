-- User UI/notification language preference (BCP-47 primary subtag).
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'uz';
