-- AlterEnum
BEGIN;
CREATE TYPE "TipoTreino_new" AS ENUM ('Tecnico', 'Tatico', 'Mental');
ALTER TABLE "TreinoProgramado" ALTER COLUMN "tipoTreino" TYPE "TipoTreino_new" USING ("tipoTreino"::text::"TipoTreino_new");
ALTER TABLE "SubmissaoTreino" ALTER COLUMN "tipoTreinoSnapshot" TYPE "TipoTreino_new" USING ("tipoTreinoSnapshot"::text::"TipoTreino_new");
ALTER TYPE "TipoTreino" RENAME TO "TipoTreino_old";
ALTER TYPE "TipoTreino_new" RENAME TO "TipoTreino";
DROP TYPE "TipoTreino_old";
COMMIT;

