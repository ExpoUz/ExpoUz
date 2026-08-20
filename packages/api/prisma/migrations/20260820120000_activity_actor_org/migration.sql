-- PART 4: actor typing + org context for the immutable activity log.

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PLAYER', 'ORG_STAFF', 'SUPERADMIN', 'SYSTEM');

-- AlterTable: actor becomes nullable (SYSTEM events have no human actor) and
-- gains actorType + org context.
ALTER TABLE "ActivityLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "ActivityLog" ADD COLUMN "actorType" "ActorType",
ADD COLUMN "orgId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_orgId_idx" ON "ActivityLog"("orgId");
CREATE INDEX "ActivityLog_actorType_idx" ON "ActivityLog"("actorType");
