-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('TRANSFER_OUT', 'TRANSFER_IN', 'DEPOSIT');

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "reference_number" VARCHAR(20) NOT NULL,
    "from_account_id" UUID NOT NULL,
    "to_account_id" UUID NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "description" VARCHAR(255),
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "transfer_id" UUID,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "balance_after" DECIMAL(19,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_reference_number_key" ON "transfers"("reference_number");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_idempotency_key_key" ON "transfers"("idempotency_key");

-- CreateIndex
CREATE INDEX "transfers_from_account_id_idx" ON "transfers"("from_account_id");

-- CreateIndex
CREATE INDEX "transfers_to_account_id_idx" ON "transfers"("to_account_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_transfer_id_idx" ON "ledger_entries"("transfer_id");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
