-- Optional bcrypt password hash for email+password admin login.
-- Only email+password admin accounts set this; all other users keep it NULL.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
