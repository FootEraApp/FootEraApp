
-- Enums necessários aos vínculos de responsáveis
CREATE TYPE "StatusResponsavelAtleta"
AS ENUM ('PENDENTE', 'ATIVO', 'REVOGADO');

CREATE TYPE "OrigemSolicitacaoResponsavel"
AS ENUM ('ATLETA', 'RESPONSAVEL', 'CADASTRO_MENOR');

-- Tabela de responsáveis vinculados aos atletas
CREATE TABLE "ResponsavelAtleta" (
    "id" TEXT NOT NULL,
    "responsavelUsuarioId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "status" "StatusResponsavelAtleta" NOT NULL DEFAULT 'ATIVO',
    "origemSolicitacao" "OrigemSolicitacaoResponsavel",
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "podeEditarPerfil" BOOLEAN NOT NULL DEFAULT true,
    "podeGerenciarPrivacidade" BOOLEAN NOT NULL DEFAULT true,
    "podeGerenciarTreinos" BOOLEAN NOT NULL DEFAULT true,
    "podeGerenciarConteudo" BOOLEAN NOT NULL DEFAULT true,
    "permitirPerfilPublico" BOOLEAN NOT NULL DEFAULT false,
    "permitirMensagensDiretas" BOOLEAN NOT NULL DEFAULT false,
    "permitirMostrarEmail" BOOLEAN NOT NULL DEFAULT false,
    "parentesco" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "confirmadoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "ResponsavelAtleta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResponsavelAtleta_responsavelUsuarioId_status_idx"
ON "ResponsavelAtleta"("responsavelUsuarioId", "status");

CREATE INDEX "ResponsavelAtleta_atletaId_status_idx"
ON "ResponsavelAtleta"("atletaId", "status");

CREATE UNIQUE INDEX "ResponsavelAtleta_responsavelUsuarioId_atletaId_key"
ON "ResponsavelAtleta"("responsavelUsuarioId", "atletaId");

ALTER TABLE "ResponsavelAtleta"
ADD CONSTRAINT "ResponsavelAtleta_responsavelUsuarioId_fkey"
FOREIGN KEY ("responsavelUsuarioId")
REFERENCES "Usuario"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResponsavelAtleta"
ADD CONSTRAINT "ResponsavelAtleta_atletaId_fkey"
FOREIGN KEY ("atletaId")
REFERENCES "Atleta"("id")
ON DELETE CASCADE ON UPDATE CASCADE;