-- AlterTable
ALTER TABLE "Usuario"
ADD COLUMN IF NOT EXISTS "localLoginEnabled" BOOLEAN NOT NULL DEFAULT TRUE;

-- Contas criadas apenas pelo Google possuem
-- senha interna aleatória que o usuário não conhece.
UPDATE "Usuario"
SET "localLoginEnabled" = FALSE
WHERE "authProvider"::text = 'GOOGLE';