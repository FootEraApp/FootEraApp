-- CreateEnum
CREATE TYPE "ConviteTipo" AS ENUM ('ORGANIZACAO', 'TURMA', 'PROFESSOR', 'ATLETA_VINCULO');

-- CreateEnum
CREATE TYPE "ConviteStatus" AS ENUM ('ATIVO', 'UTILIZADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "SolicitacaoTreino" ADD COLUMN     "destinatarioPapel" "TipoUsuario",
ADD COLUMN     "remetentePapel" "TipoUsuario";

-- CreateTable
CREATE TABLE "Convite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tipo" "ConviteTipo" NOT NULL,
    "status" "ConviteStatus" NOT NULL DEFAULT 'ATIVO',
    "criadoPorId" TEXT NOT NULL,
    "destinatarioUsuarioId" TEXT,
    "organizacaoTipo" "OrganizacaoTipo",
    "organizacaoId" TEXT,
    "turmaId" TEXT,
    "professorId" TEXT,
    "usoUnico" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "utilizadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConviteUso" (
    "id" TEXT NOT NULL,
    "conviteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConviteUso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Convite_token_key" ON "Convite"("token");

-- CreateIndex
CREATE INDEX "Convite_status_expiresAt_idx" ON "Convite"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Convite_tipo_status_idx" ON "Convite"("tipo", "status");

-- CreateIndex
CREATE INDEX "Convite_criadoPorId_idx" ON "Convite"("criadoPorId");

-- CreateIndex
CREATE INDEX "Convite_destinatarioUsuarioId_idx" ON "Convite"("destinatarioUsuarioId");

-- CreateIndex
CREATE INDEX "Convite_turmaId_idx" ON "Convite"("turmaId");

-- CreateIndex
CREATE INDEX "Convite_professorId_idx" ON "Convite"("professorId");

-- CreateIndex
CREATE INDEX "Convite_organizacaoTipo_organizacaoId_idx" ON "Convite"("organizacaoTipo", "organizacaoId");

-- CreateIndex
CREATE INDEX "ConviteUso_usuarioId_idx" ON "ConviteUso"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConviteUso_conviteId_usuarioId_key" ON "ConviteUso"("conviteId", "usuarioId");

-- CreateIndex
CREATE INDEX "SolicitacaoTreino_remetenteId_destinatarioId_status_idx" ON "SolicitacaoTreino"("remetenteId", "destinatarioId", "status");

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_destinatarioUsuarioId_fkey" FOREIGN KEY ("destinatarioUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteUso" ADD CONSTRAINT "ConviteUso_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "Convite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteUso" ADD CONSTRAINT "ConviteUso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
