-- CreateEnum
CREATE TYPE "public"."PosicaoCampo" AS ENUM ('GOL', 'LD', 'ZD', 'ZE', 'LE', 'VOL1', 'VOL2', 'MEI', 'PD', 'CA', 'PE');

-- CreateEnum
CREATE TYPE "public"."StatusDesafioGrupo" AS ENUM ('ativo', 'concluido', 'expirado');

-- CreateEnum
CREATE TYPE "public"."Nivel" AS ENUM ('Base', 'Avancado', 'Performance');

-- CreateEnum
CREATE TYPE "public"."Categoria" AS ENUM ('Sub9', 'Sub11', 'Sub13', 'Sub15', 'Sub17', 'Sub20', 'Livre');

-- CreateEnum
CREATE TYPE "public"."TipoUsuario" AS ENUM ('Atleta', 'Professor', 'Clube', 'Escolinha', 'Admin');

-- CreateEnum
CREATE TYPE "public"."TipoMidia" AS ENUM ('Imagem', 'Video', 'Documento');

-- CreateEnum
CREATE TYPE "public"."StatusConexao" AS ENUM ('Pendente', 'Aprovado', 'Recusado');

-- CreateEnum
CREATE TYPE "public"."StatusCref" AS ENUM ('Ativo', 'Desativo', 'Pendente');

-- CreateEnum
CREATE TYPE "public"."TipoTreino" AS ENUM ('Tecnico', 'Fisico', 'Tatico', 'Mental');

-- CreateEnum
CREATE TYPE "public"."TipoMensagem" AS ENUM ('NORMAL', 'DESAFIO', 'POST', 'USUARIO', 'CONQUISTA');

-- CreateEnum
CREATE TYPE "public"."TipoMembro" AS ENUM ('DONO', 'ADMIN', 'MEMBRO');

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" TEXT NOT NULL,
    "nomeDeUsuario" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "foto" TEXT,
    "tipo" "public"."TipoUsuario" NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "bairro" TEXT,
    "cpf" TEXT,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Professor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cref" TEXT,
    "areaFormacao" TEXT NOT NULL,
    "escola" TEXT,
    "fotoUrl" TEXT,
    "nome" TEXT NOT NULL,
    "usuarioId" TEXT,
    "statusCref" "public"."StatusCref",
    "qualificacoes" TEXT[],
    "certificacoes" TEXT[],

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Amigo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "amigoId" TEXT NOT NULL,
    "local" TEXT,
    "seguindo" BOOLEAN DEFAULT false,

    CONSTRAINT "Amigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mensagem" (
    "id" TEXT NOT NULL,
    "deId" TEXT NOT NULL,
    "paraId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "atletaId" TEXT,
    "desafioId" TEXT,
    "postId" TEXT,
    "tipo" "public"."TipoMensagem" NOT NULL DEFAULT 'NORMAL',
    "usuarioId" TEXT,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Atleta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT,
    "sobrenome" TEXT,
    "email" TEXT,
    "senhaHash" TEXT,
    "idade" INTEGER NOT NULL,
    "cpf" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "nacionalidade" TEXT,
    "naturalidade" TEXT,
    "posicao" TEXT,
    "altura" DECIMAL(65,30),
    "peso" DECIMAL(65,30),
    "seloQualidade" TEXT,
    "foto" TEXT,
    "categoria" "public"."Categoria"[],
    "consentimento" BOOLEAN NOT NULL DEFAULT false,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "statusConexao" "public"."StatusConexao" NOT NULL DEFAULT 'Pendente',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataUltimaModificacao" TIMESTAMP(3),
    "perfilTipoTreino" TEXT,
    "perfilTipoTreinoAtualizadoEm" TIMESTAMP(3),

    CONSTRAINT "Atleta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoProgramado" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "public"."Nivel" NOT NULL,
    "dataAgendada" TIMESTAMP(3),
    "professorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" "public"."Categoria"[],
    "dicas" TEXT[],
    "duracao" INTEGER,
    "escolinhaId" TEXT,
    "objetivo" TEXT,
    "clubeId" TEXT,
    "expiraEm" TIMESTAMP(3),
    "imagemUrl" TEXT,
    "metas" TEXT,
    "naoExpira" BOOLEAN NOT NULL DEFAULT false,
    "pontuacao" INTEGER,
    "tipoTreino" "public"."TipoTreino",

    CONSTRAINT "TreinoProgramado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoProgramadoExercicio" (
    "id" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "repeticoes" TEXT NOT NULL,

    CONSTRAINT "TreinoProgramadoExercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exercicio" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "public"."Nivel" NOT NULL,
    "categorias" "public"."Categoria"[],
    "videoDemonstrativoUrl" TEXT,

    CONSTRAINT "Exercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesafioOficial" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "nivel" "public"."Nivel" NOT NULL,
    "categoria" "public"."Categoria"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazoSubmissao" TIMESTAMP(3),
    "pontuacao" INTEGER,
    "regras" TEXT,
    "tipoMetrificação" TEXT,

    CONSTRAINT "DesafioOficial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Seguidor" (
    "id" TEXT NOT NULL,
    "seguidoUsuarioId" TEXT NOT NULL,
    "seguidorUsuarioId" TEXT NOT NULL,

    CONSTRAINT "Seguidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RelacaoTreinamento" (
    "id" TEXT NOT NULL,
    "professorId" TEXT,
    "atletaId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelacaoTreinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Postagem" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "videoUrl" TEXT,
    "tipoMidia" "public"."TipoMidia",
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "atletaId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "compartilhamentos" INTEGER DEFAULT 0,

    CONSTRAINT "Postagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Midia" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "public"."TipoMidia" NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataEnvio" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "atletaId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,
    "submissaoDesafioId" TEXT,
    "submissaoTreinoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Midia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Escolinha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "email" TEXT,
    "siteOficial" TEXT,
    "sede" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "cep" TEXT,
    "logo" TEXT,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escolinha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comentario" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Clube" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "telefone1" TEXT,
    "telefone2" TEXT,
    "email" TEXT,
    "siteOficial" TEXT,
    "sede" TEXT,
    "estadio" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "cep" TEXT,
    "logo" TEXT,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SolicitacaoVinculo" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipoEntidade" TEXT NOT NULL,
    "status" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SolicitacaoTreino" (
    "id" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "status" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissaoDesafio" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "desafioId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "aprovado" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "observacao" TEXT,

    CONSTRAINT "SubmissaoDesafio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissaoTreino" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "treinoAgendadoId" TEXT NOT NULL,
    "aprovado" BOOLEAN,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,
    "duracaoMinutos" INTEGER,
    "pontosCreditados" INTEGER,
    "pontuacaoSnapshot" INTEGER,
    "tipoTreinoSnapshot" "public"."TipoTreino",
    "treinoTituloSnapshot" TEXT,

    CONSTRAINT "SubmissaoTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Grupo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foto" TEXT,
    "ownerId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MembroGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "public"."TipoMembro" NOT NULL DEFAULT 'MEMBRO',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "MembroGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MensagemGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "public"."TipoMensagem" NOT NULL DEFAULT 'NORMAL',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluida" BOOLEAN NOT NULL DEFAULT false,
    "excluidaEm" TIMESTAMP(3),
    "excluidaPor" TEXT,

    CONSTRAINT "MensagemGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Administrador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "nivel" "public"."Nivel" NOT NULL,

    CONSTRAINT "Administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogErro" (
    "id" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "path" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "LogErro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Curtida" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curtida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoAgendado" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "local" TEXT,
    "atletaId" TEXT NOT NULL,
    "treinoProgramadoId" TEXT,
    "dataTreino" TIMESTAMP(3),
    "dataExpiracao" TIMESTAMP(3),

    CONSTRAINT "TreinoAgendado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoLivre" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "duracaoMin" INTEGER,

    CONSTRAINT "TreinoLivre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RegistroTreino" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "notas" TEXT,
    "completado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistroTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PontuacaoAtleta" (
    "atletaId" TEXT NOT NULL,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoPerformance" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoDisciplina" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoResponsabilidade" INTEGER NOT NULL DEFAULT 0,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontuacaoAtleta_pkey" PRIMARY KEY ("atletaId")
);

-- CreateTable
CREATE TABLE "public"."Video" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "atletaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" "public"."Categoria"[],
    "nivel" "public"."Nivel" NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ranking" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "posicao" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConfiguracaoSistema" (
    "id" TEXT NOT NULL,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "allowAthleteChallenges" BOOLEAN NOT NULL DEFAULT true,
    "allowProfileEditing" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyPosts" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "ConfiguracaoSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AtividadeRecente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtividadeRecente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoRealizado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "local" TEXT,
    "dataExpiracao" TIMESTAMP(3),

    CONSTRAINT "TreinoRealizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TreinoProgramadoRecebido" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,

    CONSTRAINT "TreinoProgramadoRecebido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DesafioEmGrupo" (
    "id" TEXT NOT NULL,
    "desafioOficialId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "status" "public"."StatusDesafioGrupo" NOT NULL DEFAULT 'ativo',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataExpiracao" TIMESTAMP(3),
    "pontosAcumulados" INTEGER DEFAULT 0,

    CONSTRAINT "DesafioEmGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissaoDesafioEmGrupo" (
    "id" TEXT NOT NULL,
    "submissaoDesafioId" TEXT NOT NULL,
    "desafioEmGrupoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dataEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovado" BOOLEAN,
    "pontosGanhos" INTEGER,

    CONSTRAINT "SubmissaoDesafioEmGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordReset" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EstatisticaAtleta" (
    "atletaId" TEXT NOT NULL,
    "totalTreinos" INTEGER NOT NULL DEFAULT 0,
    "totalDesafios" INTEGER NOT NULL DEFAULT 0,
    "totalPontos" INTEGER NOT NULL DEFAULT 0,
    "horasTreinadas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fisico" INTEGER NOT NULL DEFAULT 0,
    "tecnico" INTEGER NOT NULL DEFAULT 0,
    "tatico" INTEGER NOT NULL DEFAULT 0,
    "mental" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstatisticaAtleta_pkey" PRIMARY KEY ("atletaId")
);

-- CreateTable
CREATE TABLE "public"."Elenco" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "professorId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "atletasIds" TEXT[],
    "maxJogadores" INTEGER NOT NULL DEFAULT 11,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Elenco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AtletaElenco" (
    "id" TEXT NOT NULL,
    "elencoId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "posicao" "public"."PosicaoCampo" NOT NULL,
    "numeroCamisa" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtletaElenco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_MembrosDesafioEmGrupo" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MembrosDesafioEmGrupo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nomeDeUsuario_key" ON "public"."Usuario"("nomeDeUsuario");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "public"."Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_codigo_key" ON "public"."Professor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_fotoUrl_key" ON "public"."Professor"("fotoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_nome_key" ON "public"."Professor"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_usuarioId_key" ON "public"."Professor"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Atleta_usuarioId_key" ON "public"."Atleta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProgramado_codigo_key" ON "public"."TreinoProgramado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProgramado_nome_key" ON "public"."TreinoProgramado"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_codigo_key" ON "public"."Exercicio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_nome_key" ON "public"."Exercicio"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_videoDemonstrativoUrl_key" ON "public"."Exercicio"("videoDemonstrativoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "DesafioOficial_titulo_key" ON "public"."DesafioOficial"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "DesafioOficial_imagemUrl_key" ON "public"."DesafioOficial"("imagemUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RelacaoTreinamento_professorId_atletaId_escolinhaId_clubeId_key" ON "public"."RelacaoTreinamento"("professorId", "atletaId", "escolinhaId", "clubeId");

-- CreateIndex
CREATE UNIQUE INDEX "Postagem_conteudo_key" ON "public"."Postagem"("conteudo");

-- CreateIndex
CREATE UNIQUE INDEX "Postagem_usuarioId_conteudo_key" ON "public"."Postagem"("usuarioId", "conteudo");

-- CreateIndex
CREATE UNIQUE INDEX "Midia_url_key" ON "public"."Midia"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_usuarioId_key" ON "public"."Escolinha"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_nome_key" ON "public"."Escolinha"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_cnpj_key" ON "public"."Escolinha"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_email_key" ON "public"."Escolinha"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_usuarioId_key" ON "public"."Clube"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_nome_key" ON "public"."Clube"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_cnpj_key" ON "public"."Clube"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_email_key" ON "public"."Clube"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_siteOficial_key" ON "public"."Clube"("siteOficial");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoDesafio_videoUrl_key" ON "public"."SubmissaoDesafio"("videoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoTreino_observacao_key" ON "public"."SubmissaoTreino"("observacao");

-- CreateIndex
CREATE INDEX "Grupo_ownerId_idx" ON "public"."Grupo"("ownerId");

-- CreateIndex
CREATE INDEX "Grupo_createdAt_idx" ON "public"."Grupo"("createdAt");

-- CreateIndex
CREATE INDEX "Grupo_updatedAt_idx" ON "public"."Grupo"("updatedAt");

-- CreateIndex
CREATE INDEX "MembroGrupo_usuarioId_idx" ON "public"."MembroGrupo"("usuarioId");

-- CreateIndex
CREATE INDEX "MembroGrupo_grupoId_tipo_idx" ON "public"."MembroGrupo"("grupoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "MembroGrupo_grupoId_usuarioId_key" ON "public"."MembroGrupo"("grupoId", "usuarioId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_grupoId_idx" ON "public"."MensagemGrupo"("grupoId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_usuarioId_idx" ON "public"."MensagemGrupo"("usuarioId");

-- CreateIndex
CREATE INDEX "MensagemGrupo_criadaEm_idx" ON "public"."MensagemGrupo"("criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Administrador_usuarioId_key" ON "public"."Administrador"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoAgendado_titulo_key" ON "public"."TreinoAgendado"("titulo");

-- CreateIndex
CREATE UNIQUE INDEX "Video_url_key" ON "public"."Video"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_atletaId_key" ON "public"."Ranking"("atletaId");

-- CreateIndex
CREATE UNIQUE INDEX "AtividadeRecente_imagemUrl_key" ON "public"."AtividadeRecente"("imagemUrl");

-- CreateIndex
CREATE INDEX "SubmissaoDesafioEmGrupo_desafioEmGrupoId_idx" ON "public"."SubmissaoDesafioEmGrupo"("desafioEmGrupoId");

-- CreateIndex
CREATE INDEX "SubmissaoDesafioEmGrupo_usuarioId_idx" ON "public"."SubmissaoDesafioEmGrupo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "public"."PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_usuarioId_idx" ON "public"."PasswordReset"("usuarioId");

-- CreateIndex
CREATE INDEX "AtletaElenco_atletaId_idx" ON "public"."AtletaElenco"("atletaId");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaElenco_elencoId_posicao_key" ON "public"."AtletaElenco"("elencoId", "posicao");

-- CreateIndex
CREATE UNIQUE INDEX "AtletaElenco_elencoId_atletaId_key" ON "public"."AtletaElenco"("elencoId", "atletaId");

-- CreateIndex
CREATE INDEX "_MembrosDesafioEmGrupo_B_index" ON "public"."_MembrosDesafioEmGrupo"("B");

-- AddForeignKey
ALTER TABLE "public"."Professor" ADD CONSTRAINT "Professor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Amigo" ADD CONSTRAINT "Amigo_amigoId_fkey" FOREIGN KEY ("amigoId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Amigo" ADD CONSTRAINT "Amigo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mensagem" ADD CONSTRAINT "Mensagem_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mensagem" ADD CONSTRAINT "Mensagem_deId_fkey" FOREIGN KEY ("deId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mensagem" ADD CONSTRAINT "Mensagem_desafioId_fkey" FOREIGN KEY ("desafioId") REFERENCES "public"."DesafioOficial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mensagem" ADD CONSTRAINT "Mensagem_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mensagem" ADD CONSTRAINT "Mensagem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Postagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mensagem" ADD CONSTRAINT "Mensagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Atleta" ADD CONSTRAINT "Atleta_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Atleta" ADD CONSTRAINT "Atleta_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "public"."Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Atleta" ADD CONSTRAINT "Atleta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "public"."Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "public"."Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "public"."Exercicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "public"."TreinoProgramado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Seguidor" ADD CONSTRAINT "Seguidor_seguidoUsuarioId_fkey" FOREIGN KEY ("seguidoUsuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Seguidor" ADD CONSTRAINT "Seguidor_seguidorUsuarioId_fkey" FOREIGN KEY ("seguidorUsuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "public"."Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RelacaoTreinamento" ADD CONSTRAINT "RelacaoTreinamento_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "public"."Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Postagem" ADD CONSTRAINT "Postagem_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Postagem" ADD CONSTRAINT "Postagem_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Postagem" ADD CONSTRAINT "Postagem_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "public"."Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Midia" ADD CONSTRAINT "Midia_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Midia" ADD CONSTRAINT "Midia_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "public"."Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Midia" ADD CONSTRAINT "Midia_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "public"."Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Midia" ADD CONSTRAINT "Midia_submissaoDesafioId_fkey" FOREIGN KEY ("submissaoDesafioId") REFERENCES "public"."SubmissaoDesafio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Midia" ADD CONSTRAINT "Midia_submissaoTreinoId_fkey" FOREIGN KEY ("submissaoTreinoId") REFERENCES "public"."SubmissaoTreino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comentario" ADD CONSTRAINT "Comentario_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "public"."Postagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comentario" ADD CONSTRAINT "Comentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Clube" ADD CONSTRAINT "Clube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SolicitacaoVinculo" ADD CONSTRAINT "SolicitacaoVinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SolicitacaoTreino" ADD CONSTRAINT "SolicitacaoTreino_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SolicitacaoTreino" ADD CONSTRAINT "SolicitacaoTreino_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_desafioId_fkey" FOREIGN KEY ("desafioId") REFERENCES "public"."DesafioOficial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_treinoAgendadoId_fkey" FOREIGN KEY ("treinoAgendadoId") REFERENCES "public"."TreinoAgendado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoTreino" ADD CONSTRAINT "SubmissaoTreino_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Grupo" ADD CONSTRAINT "Grupo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MembroGrupo" ADD CONSTRAINT "MembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "public"."Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MembroGrupo" ADD CONSTRAINT "MembroGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "public"."Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MensagemGrupo" ADD CONSTRAINT "MensagemGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Administrador" ADD CONSTRAINT "Administrador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogErro" ADD CONSTRAINT "LogErro_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "public"."Postagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogErro" ADD CONSTRAINT "LogErro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Curtida" ADD CONSTRAINT "Curtida_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "public"."Postagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Curtida" ADD CONSTRAINT "Curtida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "public"."TreinoProgramado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoLivre" ADD CONSTRAINT "TreinoLivre_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RegistroTreino" ADD CONSTRAINT "RegistroTreino_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "public"."TreinoLivre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PontuacaoAtleta" ADD CONSTRAINT "PontuacaoAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Video" ADD CONSTRAINT "Video_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ranking" ADD CONSTRAINT "Ranking_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtividadeRecente" ADD CONSTRAINT "AtividadeRecente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoRealizado" ADD CONSTRAINT "TreinoRealizado_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "public"."TreinoProgramado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoRealizado" ADD CONSTRAINT "TreinoRealizado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramadoRecebido" ADD CONSTRAINT "TreinoProgramadoRecebido_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TreinoProgramadoRecebido" ADD CONSTRAINT "TreinoProgramadoRecebido_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "public"."TreinoProgramado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DesafioEmGrupo" ADD CONSTRAINT "DesafioEmGrupo_desafioOficialId_fkey" FOREIGN KEY ("desafioOficialId") REFERENCES "public"."DesafioOficial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_desafioEmGrupoId_fkey" FOREIGN KEY ("desafioEmGrupoId") REFERENCES "public"."DesafioEmGrupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_submissaoDesafioId_fkey" FOREIGN KEY ("submissaoDesafioId") REFERENCES "public"."SubmissaoDesafio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissaoDesafioEmGrupo" ADD CONSTRAINT "SubmissaoDesafioEmGrupo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordReset" ADD CONSTRAINT "PasswordReset_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EstatisticaAtleta" ADD CONSTRAINT "EstatisticaAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtletaElenco" ADD CONSTRAINT "AtletaElenco_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "public"."Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AtletaElenco" ADD CONSTRAINT "AtletaElenco_elencoId_fkey" FOREIGN KEY ("elencoId") REFERENCES "public"."Elenco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_MembrosDesafioEmGrupo" ADD CONSTRAINT "_MembrosDesafioEmGrupo_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."DesafioEmGrupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_MembrosDesafioEmGrupo" ADD CONSTRAINT "_MembrosDesafioEmGrupo_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
