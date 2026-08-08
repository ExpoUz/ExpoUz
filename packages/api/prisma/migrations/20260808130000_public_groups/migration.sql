-- Public community groups in the Chat tab: admin-created, city/sport based.

ALTER TYPE "ConvType" ADD VALUE 'PUBLIC_GROUP';

ALTER TABLE "Conversation" ADD COLUMN "title" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "city" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "sport" "Sport";
