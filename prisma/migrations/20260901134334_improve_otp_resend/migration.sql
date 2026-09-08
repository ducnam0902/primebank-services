/*
  Warnings:

  - The values [TRANSFER] on the enum `Purpose` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Purpose_new" AS ENUM ('RESET_PASSWORD', 'VERIFY_EMAIL');
ALTER TABLE "auth_otps" ALTER COLUMN "purpose" TYPE "Purpose_new" USING ("purpose"::text::"Purpose_new");
ALTER TYPE "Purpose" RENAME TO "Purpose_old";
ALTER TYPE "Purpose_new" RENAME TO "Purpose";
DROP TYPE "public"."Purpose_old";
COMMIT;

-- AlterTable
ALTER TABLE "auth_otps" ADD COLUMN     "consumed_at" TIMESTAMPTZ(3),
ADD COLUMN     "invalidated_at" TIMESTAMPTZ(3);
