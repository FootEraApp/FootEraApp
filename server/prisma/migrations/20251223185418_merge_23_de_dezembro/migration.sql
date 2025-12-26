-- DropConstraint (em vez de DropIndex)
ALTER TABLE "public"."AtletaObservado"
DROP CONSTRAINT IF EXISTS "AtletaObservado_owner_atleta_key";

-- DropConstraint (em vez de DropIndex)
ALTER TABLE "public"."RelacaoTreinamento"
DROP CONSTRAINT IF EXISTS "RelacaoTreinamento_professorId_atletaId_escolinhaId_clubeId_key";

-- AlterTable
ALTER TABLE "TreinoProgramado" ADD COLUMN     "criadorProfessorId" TEXT;

-- CreateTable
CREATE TABLE "TreinoProgramadoProfessor" (
    "id" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "papel" TEXT,

    CONSTRAINT "TreinoProgramadoProfessor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreinoProgramadoProfessor_professorId_idx" ON "TreinoProgramadoProfessor"("professorId");

-- CreateIndex
CREATE INDEX "TreinoProgramadoProfessor_treinoProgramadoId_idx" ON "TreinoProgramadoProfessor"("treinoProgramadoId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProgramadoProfessor_treinoProgramadoId_professorId_key" ON "TreinoProgramadoProfessor"("treinoProgramadoId", "professorId");

-- CreateIndex
CREATE INDEX "TreinoProgramado_criadorProfessorId_idx" ON "TreinoProgramado"("criadorProfessorId");

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_criadorProfessorId_fkey" FOREIGN KEY ("criadorProfessorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoProfessor" ADD CONSTRAINT "TreinoProgramadoProfessor_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoProfessor" ADD CONSTRAINT "TreinoProgramadoProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
