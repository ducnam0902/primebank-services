/*
  Warnings:

  - You are about to alter the column `token_hash` on the `refresh_tokens` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `Char(64)`.
  - Added the required column `updated_at` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- DropIndex
DROP INDEX "refresh_tokens_user_id_idx";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "last_used_at" TIMESTAMPTZ(3),
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL,
ALTER COLUMN "token_hash" SET DATA TYPE CHAR(64);

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
