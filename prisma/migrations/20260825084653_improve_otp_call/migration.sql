-- DropIndex
DROP INDEX "auth_otps_user_id_idx";

-- AlterTable
ALTER TABLE "auth_otps" ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "auth_otps_user_id_purpose_idx" ON "auth_otps"("user_id", "purpose");
