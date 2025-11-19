/*
  Warnings:

  - You are about to drop the column `createdAt` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `tokenHash` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `EmailVerification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[usuarioId]` on the table `EmailVerification` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token]` on the table `EmailVerification` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiraEm` to the `EmailVerification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token` to the `EmailVerification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `EmailVerification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."EmailVerification" DROP CONSTRAINT "EmailVerification_userId_fkey";

-- DropIndex
DROP INDEX "public"."EmailVerification_tokenHash_key";

-- DropIndex
DROP INDEX "public"."EmailVerification_userId_idx";

-- AlterTable
ALTER TABLE "EmailVerification" DROP COLUMN "createdAt",
DROP COLUMN "email",
DROP COLUMN "expiresAt",
DROP COLUMN "tokenHash",
DROP COLUMN "usedAt",
DROP COLUMN "userId",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiraEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "token" TEXT NOT NULL,
ADD COLUMN     "usadoEm" TIMESTAMP(3),
ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_usuarioId_key" ON "EmailVerification"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_token_key" ON "EmailVerification"("token");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
