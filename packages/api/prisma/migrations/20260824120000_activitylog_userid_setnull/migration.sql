-- Reconcile the ActivityLog.userId foreign key with the now-optional relation.
-- Making userId nullable (SYSTEM events have no human actor) changed the relation
-- from required to optional, so the FK's ON DELETE action must become SET NULL:
-- deleting a user nulls the actor on their audit rows but NEVER deletes the
-- immutable log entries.

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
