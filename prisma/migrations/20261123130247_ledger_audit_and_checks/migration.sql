/*
  Warnings:

  - You are about to drop the column `version` on the `accounts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idempotency_key]` on the table `ledger_entries` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "version";

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "description" VARCHAR(255),
ADD COLUMN     "idempotency_key" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_idempotency_key_key" ON "ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_created_by_id_idx" ON "ledger_entries"("created_by_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_balance_non_negative"
  CHECK ("balance" >= 0);

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive"
  CHECK ("amount" > 0),
  ADD CONSTRAINT "ledger_entries_balance_after_non_negative"
  CHECK ("balance_after" >= 0),
  ADD CONSTRAINT "ledger_entries_transfer_matches_type"
  CHECK (
    ("type" = 'DEPOSIT' AND "transfer_id" IS NULL)
    OR ("type" IN ('TRANSFER_IN', 'TRANSFER_OUT') AND "transfer_id" IS NOT NULL)
  );