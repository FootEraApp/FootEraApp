-- AlterTable
ALTER TABLE "MetodologiaEstrutura" ADD COLUMN     "percentualPerdaAtraso" INTEGER DEFAULT 20,
ADD COLUMN     "prazoInicio" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TreinoProgramado" ADD COLUMN     "criadorUsuarioId" TEXT;

-- CreateTable
CREATE TABLE "ProfessorParceiro" (
    "id" TEXT NOT NULL,
    "professorAId" TEXT NOT NULL,
    "professorBId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessorParceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificadoMetodologia" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "metodologiaId" TEXT NOT NULL,
    "metodologiaAssinanteId" TEXT,
    "codigoValidacao" TEXT NOT NULL,
    "nomeUsuario" TEXT NOT NULL,
    "tituloMetodologia" TEXT NOT NULL,
    "nomeEmissor" TEXT NOT NULL,
    "concluidoEm" TIMESTAMP(3),
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imagemUrl" TEXT,
    "pdfUrl" TEXT,

    CONSTRAINT "CertificadoMetodologia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessorParceiro_professorAId_professorBId_key" ON "ProfessorParceiro"("professorAId", "professorBId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificadoMetodologia_codigoValidacao_key" ON "CertificadoMetodologia"("codigoValidacao");

-- CreateIndex
CREATE UNIQUE INDEX "CertificadoMetodologia_usuarioId_metodologiaId_key" ON "CertificadoMetodologia"("usuarioId", "metodologiaId");

-- CreateIndex
CREATE INDEX "TreinoProgramado_criadorUsuarioId_idx" ON "TreinoProgramado"("criadorUsuarioId");

-- AddForeignKey
ALTER TABLE "ProfessorParceiro" ADD CONSTRAINT "ProfessorParceiro_professorAId_fkey" FOREIGN KEY ("professorAId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessorParceiro" ADD CONSTRAINT "ProfessorParceiro_professorBId_fkey" FOREIGN KEY ("professorBId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinoProgramado" ADD CONSTRAINT "TreinoProgramado_criadorUsuarioId_fkey" FOREIGN KEY ("criadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoMetodologia" ADD CONSTRAINT "CertificadoMetodologia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificadoMetodologia" ADD CONSTRAINT "CertificadoMetodologia_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
