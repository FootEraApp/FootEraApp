-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('Base', 'Avancado', 'Performance');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('Sub9', 'Sub11', 'Sub13', 'Sub15', 'Sub17', 'Sub20', 'Livre');

-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('Atleta', 'Professor', 'Clube', 'Escolinha', 'Admin');

-- CreateEnum
CREATE TYPE "TipoMidia" AS ENUM ('Imagem', 'Video', 'Documento');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('Pendente', 'Aprovado', 'Recusado');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nomeDeUsuario" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "foto" TEXT,
    "tipo" "TipoUsuario" NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT,
    "bairro" TEXT,
    "cpf" TEXT,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cref" TEXT,
    "areaFormacao" TEXT NOT NULL,
    "escola" TEXT,
    "qualificacoes" TEXT,
    "certificacoes" TEXT,
    "fotoUrl" TEXT,
    "nome" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amigo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "amigoId" TEXT NOT NULL,
    "local" TEXT,
    "seguindo" BOOLEAN DEFAULT false,

    CONSTRAINT "Amigo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "deId" TEXT NOT NULL,
    "paraId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atleta" (
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
    "categoria" "Categoria"[],
    "consentimento" BOOLEAN NOT NULL DEFAULT false,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "statusConexao" "StatusConexao" NOT NULL DEFAULT 'Pendente',
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataUltimaModificacao" TIMESTAMP(3),

    CONSTRAINT "Atleta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoProgramado" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "Nivel" NOT NULL,
    "dataAgendada" TIMESTAMP(3),
    "professorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreinoProgramado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoProgramadoExercicio" (
    "id" TEXT NOT NULL,
    "treinoProgramadoId" TEXT NOT NULL,
    "exercicioId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "repeticoes" TEXT NOT NULL,

    CONSTRAINT "TreinoProgramadoExercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercicio" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "nivel" "Nivel" NOT NULL,
    "categorias" "Categoria"[],
    "videoDemonstrativoUrl" TEXT,

    CONSTRAINT "Exercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesafioOficial" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "nivel" "Nivel" NOT NULL,
    "pontos" INTEGER NOT NULL,
    "categoria" "Categoria"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesafioOficial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seguidor" (
    "id" TEXT NOT NULL,
    "seguidoUsuarioId" TEXT NOT NULL,
    "seguidorUsuarioId" TEXT NOT NULL,

    CONSTRAINT "Seguidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postagem" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "videoUrl" TEXT,
    "tipoMidia" "TipoMidia",
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "atletaId" TEXT,
    "clubeId" TEXT,
    "escolinhaId" TEXT,
    "compartilhamentos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Postagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Midia" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "TipoMidia" NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataEnvio" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "atletaId" TEXT,
    "escolinhaId" TEXT,
    "clubeId" TEXT,

    CONSTRAINT "Midia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escolinha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
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
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "dataCriacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clube" (
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
CREATE TABLE "SolicitacaoVinculo" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipoEntidade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitacaoVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissaoDesafio" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "desafioId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "aprovado" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissaoDesafio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,

    CONSTRAINT "MembroGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Administrador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,

    CONSTRAINT "Administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogErro" (
    "id" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "path" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "referer" TEXT,

    CONSTRAINT "LogErro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curtida" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "postagemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curtida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoAgendado" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "atletaId" TEXT NOT NULL,
    "treinoProgramadoId" TEXT,

    CONSTRAINT "TreinoAgendado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinoLivre" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "duracaoMin" INTEGER,

    CONSTRAINT "TreinoLivre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroTreino" (
    "id" TEXT NOT NULL,
    "treinoId" TEXT NOT NULL,
    "notas" TEXT,
    "completado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistroTreino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontuacaoAtleta" (
    "atletaId" TEXT NOT NULL,
    "pontuacaoTotal" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoPerformance" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoDisciplina" INTEGER NOT NULL DEFAULT 0,
    "pontuacaoResponsabilidade" INTEGER NOT NULL DEFAULT 0,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontuacaoAtleta_pkey" PRIMARY KEY ("atletaId")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "atletaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" "Categoria"[],
    "nivel" "Nivel" NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "id" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "posicao" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nomeDeUsuario_key" ON "Usuario"("nomeDeUsuario");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_codigo_key" ON "Professor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_usuarioId_key" ON "Professor"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Atleta_usuarioId_key" ON "Atleta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TreinoProgramado_codigo_key" ON "TreinoProgramado"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Exercicio_codigo_key" ON "Exercicio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Escolinha_usuarioId_key" ON "Escolinha"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Clube_usuarioId_key" ON "Clube"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Administrador_usuarioId_key" ON "Administrador"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_atletaId_key" ON "Ranking"("atletaId");

-- AddForeignKey
ALTER TABLE "Professor" ADD CONSTRAINT "Professor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amigo" ADD CONSTRAINT "Amigo_amigoId_fkey" FOREIGN KEY ("amigoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amigo" ADD CONSTRAINT "Amigo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_deId_fkey" FOREIGN KEY ("deId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_exercicioId_fkey" FOREIGN KEY ("exercicioId") REFERENCES "Exercicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramadoExercicio" ADD CONSTRAINT "TreinoProgramadoExercicio_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguidor" ADD CONSTRAINT "Seguidor_seguidoUsuarioId_fkey" FOREIGN KEY ("seguidoUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguidor" ADD CONSTRAINT "Seguidor_seguidorUsuarioId_fkey" FOREIGN KEY ("seguidorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_escolinhaId_fkey" FOREIGN KEY ("escolinhaId") REFERENCES "Escolinha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escolinha" ADD CONSTRAINT "Escolinha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clube" ADD CONSTRAINT "Clube_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoVinculo" ADD CONSTRAINT "SolicitacaoVinculo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissaoDesafio" ADD CONSTRAINT "SubmissaoDesafio_desafioId_fkey" FOREIGN KEY ("desafioId") REFERENCES "DesafioOficial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroGrupo" ADD CONSTRAINT "MembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Administrador" ADD CONSTRAINT "Administrador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_postagemId_fkey" FOREIGN KEY ("postagemId") REFERENCES "Postagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curtida" ADD CONSTRAINT "Curtida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoAgendado" ADD CONSTRAINT "TreinoAgendado_treinoProgramadoId_fkey" FOREIGN KEY ("treinoProgramadoId") REFERENCES "TreinoProgramado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoLivre" ADD CONSTRAINT "TreinoLivre_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroTreino" ADD CONSTRAINT "RegistroTreino_treinoId_fkey" FOREIGN KEY ("treinoId") REFERENCES "TreinoLivre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontuacaoAtleta" ADD CONSTRAINT "PontuacaoAtleta_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
