-- CreateEnum
CREATE TYPE "ConvocacaoStatus" AS ENUM ('PENDENTE', 'CONFIRMADO', 'RECUSADO');

-- CreateTable
CREATE TABLE "AvaliacaoTreino" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "treinoAgendadoId" TEXT NOT NULL,
    "submissaoTreinoId" TEXT,
    "nota" INTEGER NOT NULL DEFAULT 0,
    "comentario" TEXT,
    "concluiu" BOOLEAN NOT NULL DEFAULT true,
    "teveDificuldade" BOOLEAN NOT NULL DEFAULT false,
    "dificuldadeMotivo" TEXT,
    "motivoNaoConcluiu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoConvocacao" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT 'Convocação',
    "formacao" TEXT,
    "escala" JSONB,
    "reservasIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,

    CONSTRAINT "EventoConvocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoConvocado" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "posicao" TEXT,
    "tipo" TEXT NOT NULL,
    "status" "ConvocacaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoConvocado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliacaoTreino_treinoAgendadoId_idx" ON "AvaliacaoTreino"("treinoAgendadoId");

-- CreateIndex
CREATE INDEX "AvaliacaoTreino_atletaId_idx" ON "AvaliacaoTreino"("atletaId");

-- CreateIndex
CREATE INDEX "AvaliacaoTreino_createdAt_idx" ON "AvaliacaoTreino"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoTreino_atletaId_treinoAgendadoId_key" ON "AvaliacaoTreino"("atletaId", "treinoAgendadoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoConvocacao_eventoId_turmaId_key" ON "EventoConvocacao"("eventoId", "turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoConvocado_eventoId_turmaId_atletaId_key" ON "EventoConvocado"("eventoId", "turmaId", "atletaId");

-- AddForeignKey
ALTER TABLE "AvaliacaoTreino" ADD CONSTRAINT "AvaliacaoTreino_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoTreino" ADD CONSTRAINT "AvaliacaoTreino_treinoAgendadoId_fkey" FOREIGN KEY ("treinoAgendadoId") REFERENCES "TreinoAgendado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoTreino" ADD CONSTRAINT "AvaliacaoTreino_submissaoTreinoId_fkey" FOREIGN KEY ("submissaoTreinoId") REFERENCES "SubmissaoTreino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoConvocacao" ADD CONSTRAINT "EventoConvocacao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoConvocacao" ADD CONSTRAINT "EventoConvocacao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoConvocado" ADD CONSTRAINT "EventoConvocado_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoConvocado" ADD CONSTRAINT "EventoConvocado_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
