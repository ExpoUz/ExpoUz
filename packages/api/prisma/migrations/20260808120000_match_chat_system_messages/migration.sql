-- Match chat hardening: one conversation per match (unique matchId) and system
-- message support (join/confirm/time-change) rendered client-side per language.

-- One MATCH_GROUP conversation per match.
CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

-- System vs user messages.
CREATE TYPE "MessageType" AS ENUM ('USER', 'SYSTEM');
ALTER TABLE "Message" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'USER';
