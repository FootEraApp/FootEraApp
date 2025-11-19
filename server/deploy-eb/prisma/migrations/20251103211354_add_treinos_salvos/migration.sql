-- DropIndex
DROP INDEX "public"."AtletaObservado_professorId_escolinhaId_clubeId_atletaId_ol_key";

-- CreateTable
CREATE TABLE "TreinoSalvo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "Nivel",
    "tipoTreino" "TipoTreino",
    "categoria" "Categoria"[],
    "duracao" INTEGER,
    "dicas" TEXT[],
    "conteudo" JSONB NOT NULL,
    "professorId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "criadoPorUsuarioId" TEXT,
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "parceiro" BOOLEAN NOT NULL DEFAULT false,
    "expiraEm" TIMESTAMP(3),
    "naoExpira" BOOLEAN NOT NULL DEFAULT false,
    "reutilizacoesProfessores" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreinoSalvo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoSalvoReuso" (
    "id" TEXT NOT NULL,
    "treinoSalvoId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoSalvoReuso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreinoSalvo_professorId_idx" ON "TreinoSalvo"("professorId");

-- CreateIndex
CREATE INDEX "TreinoSalvo_escolinhaId_idx" ON "TreinoSalvo"("escolinhaId");

-- CreateIndex
CREATE INDEX "TreinoSalvo_clubeId_idx" ON "TreinoSalvo"("clubeId");

-- CreateIndex
CREATE INDEX "TreinoSalvo_publico_parceiro_idx" ON "TreinoSalvo"("publico", "parceiro");

-- CreateIndex
CREATE INDEX "TreinoSalvo_expiraEm_idx" ON "TreinoSalvo"("expiraEm");

-- CreateIndex
CREATE INDEX "TreinoSalvoReuso_treinoSalvoId_idx" ON "TreinoSalvoReuso"("treinoSalvoId");

-- CreateIndex
CREATE INDEX "TreinoSalvoReuso_professorId_idx" ON "TreinoSalvoReuso"("professorId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoSalvoReuso_treinoSalvoId_professorId_key" ON "TreinoSalvoReuso"("treinoSalvoId", "professorId");

-- AddForeignKey
ALTER TABLE "TreinoSalvo" ADD CONSTRAINT "TreinoSalvo_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoSalvo" ADD CONSTRAINT "TreinoSalvo_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoSalvo" ADD CONSTRAINT "TreinoSalvo_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoSalvo" ADD CONSTRAINT "TreinoSalvo_criadoPorUsuarioId_fkey" FOREIGN KEY ("criadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoSalvoReuso" ADD CONSTRAINT "TreinoSalvoReuso_treinoSalvoId_fkey" FOREIGN KEY ("treinoSalvoId") REFERENCES "TreinoSalvo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoSalvoReuso" ADD CONSTRAINT "TreinoSalvoReuso_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
