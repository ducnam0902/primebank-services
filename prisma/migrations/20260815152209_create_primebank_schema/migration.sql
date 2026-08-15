/*
  Warnings:

  - You are about to drop the `customers` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('RESET_PASSWORD', 'VERIFY_EMAIL', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionCode" AS ENUM ('FOOD', 'SHOPPING', 'TRANSPORT', 'BILLS', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('TRANSFER', 'DEPOSIT', 'WITHDRAW', 'PAYMENT', 'SAVINGS_DEPOSIT', 'SAVINGS_WITHDRAW');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PAYMENT', 'SAVINGS');

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_user_id_fkey";

-- DropTable
DROP TABLE "customers";

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20),
    "date_of_birth" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_otps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "purpose" "Purpose" NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "account_number" VARCHAR(30) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" "TransactionCode" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "from_account_id" UUID,
    "to_account_id" UUID,
    "category_id" UUID,
    "transaction_type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" VARCHAR(255),
    "reference_code" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficiaries" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "bank_code" VARCHAR(20) NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(30) NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "nickname" VARCHAR(100) NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_user_id_key" ON "customer"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_phone_key" ON "customer"("phone");

-- CreateIndex
CREATE INDEX "auth_otps_user_id_idx" ON "auth_otps"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");

-- CreateIndex
CREATE INDEX "accounts_customer_id_idx" ON "accounts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_name_key" ON "transaction_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_code_key" ON "transaction_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_code_key" ON "transactions"("reference_code");

-- CreateIndex
CREATE INDEX "transactions_from_account_id_created_at_idx" ON "transactions"("from_account_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_to_account_id_created_at_idx" ON "transactions"("to_account_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "transactions_status_created_at_idx" ON "transactions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiaries_customer_id_bank_code_account_number_key" ON "beneficiaries"("customer_id", "bank_code", "account_number");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_otps" ADD CONSTRAINT "auth_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE accounts
ADD CONSTRAINT accounts_balance_non_negative
CHECK (balance >= 0);

ALTER TABLE transactions
ADD CONSTRAINT transactions_amount_positive
CHECK (amount > 0);

ALTER TABLE transactions
ADD CONSTRAINT transactions_account_rules
CHECK (
  (
    transaction_type IN (
      'TRANSFER',
      'PAYMENT',
      'SAVINGS_DEPOSIT',
      'SAVINGS_WITHDRAW'
    )
    AND from_account_id IS NOT NULL
    AND to_account_id IS NOT NULL
    AND from_account_id <> to_account_id
  )
  OR
  (
    transaction_type = 'DEPOSIT'
    AND from_account_id IS NULL
    AND to_account_id IS NOT NULL
  )
  OR
  (
    transaction_type = 'WITHDRAW'
    AND from_account_id IS NOT NULL
    AND to_account_id IS NULL
  )
);

CREATE UNIQUE INDEX accounts_one_default_per_customer
ON accounts (customer_id)
WHERE is_default = true;