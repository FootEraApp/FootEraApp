-- AlterTable
ALTER TABLE "Atleta" ADD COLUMN     "professorId" TEXT;

-- AlterTable
ALTER TABLE "RelacaoTreinamento" ADD COLUMN     "ativo" BOOLEAN,
ADD COLUMN     "organizacaoId" TEXT;

-- CreateTable
CREATE TABLE "AtletaHistoricoVinculo" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT,
    "professorId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "nome" TEXT,
    "sobrenome" TEXT,
    "email" TEXT,
    "cpf" TEXT,
    "foto" TEXT,
    "idade" INTEGER,
    "posicao" "PosicaoCampo",
    "nacionalidade" TEXT,
    "naturalidade" TEXT,
    "altura" DECIMAL(65,30),
    "peso" DECIMAL(65,30),
    "categoria" "Categoria"[],
    "seloQualidade" TEXT,
    "inicioVinculo" TIMESTAMP(3),
    "fimVinculo" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtletaHistoricoVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtletaHistoricoVinculo_atletaId_idx" ON "AtletaHistoricoVinculo"("atletaId");

-- CreateIndex
CREATE INDEX "AtletaHistoricoVinculo_professorId_idx" ON "AtletaHistoricoVinculo"("professorId");

-- CreateIndex
CREATE INDEX "AtletaHistoricoVinculo_escolinhaId_idx" ON "AtletaHistoricoVinculo"("escolinhaId");

-- CreateIndex
CREATE INDEX "AtletaHistoricoVinculo_clubeId_idx" ON "AtletaHistoricoVinculo"("clubeId");

-- CreateIndex
CREATE INDEX "AtletaHistoricoVinculo_expiraEm_idx" ON "AtletaHistoricoVinculo"("expiraEm");

-- CreateIndex
CREATE INDEX "Atleta_professorId_idx" ON "Atleta"("professorId");

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtletaHistoricoVinculo" ADD CONSTRAINT "AtletaHistoricoVinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtletaHistoricoVinculo" ADD CONSTRAINT "AtletaHistoricoVinculo_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtletaHistoricoVinculo" ADD CONSTRAINT "AtletaHistoricoVinculo_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtletaHistoricoVinculo" ADD CONSTRAINT "AtletaHistoricoVinculo_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;
