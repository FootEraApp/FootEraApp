-- CreateTable
CREATE TABLE "AvaliacaoMetodologia" (
    "id" TEXT NOT NULL,
    "metodologiaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoMetodologia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliacaoMetodologia_metodologiaId_idx" ON "AvaliacaoMetodologia"("metodologiaId");

-- CreateIndex
CREATE INDEX "AvaliacaoMetodologia_usuarioId_idx" ON "AvaliacaoMetodologia"("usuarioId");

-- CreateIndex
CREATE INDEX "AvaliacaoMetodologia_createdAt_idx" ON "AvaliacaoMetodologia"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoMetodologia_metodologiaId_usuarioId_key" ON "AvaliacaoMetodologia"("metodologiaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "AvaliacaoMetodologia" ADD CONSTRAINT "AvaliacaoMetodologia_metodologiaId_fkey" FOREIGN KEY ("metodologiaId") REFERENCES "Metodologia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoMetodologia" ADD CONSTRAINT "AvaliacaoMetodologia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
