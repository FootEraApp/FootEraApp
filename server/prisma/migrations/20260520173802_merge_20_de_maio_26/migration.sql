-- CreateTable
CREATE TABLE "AulaAoVivoPresenca" (
    "id" TEXT NOT NULL,
    "aulaAoVivoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoPingEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saiuEm" TIMESTAMP(3),
    "entrouAoVivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AulaAoVivoPresenca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AulaAoVivoPresenca_aulaAoVivoId_idx" ON "AulaAoVivoPresenca"("aulaAoVivoId");

-- CreateIndex
CREATE INDEX "AulaAoVivoPresenca_usuarioId_idx" ON "AulaAoVivoPresenca"("usuarioId");

-- CreateIndex
CREATE INDEX "AulaAoVivoPresenca_ultimoPingEm_idx" ON "AulaAoVivoPresenca"("ultimoPingEm");

-- CreateIndex
CREATE INDEX "AulaAoVivoPresenca_entrouAoVivo_idx" ON "AulaAoVivoPresenca"("entrouAoVivo");

-- CreateIndex
CREATE UNIQUE INDEX "AulaAoVivoPresenca_aulaAoVivoId_usuarioId_key" ON "AulaAoVivoPresenca"("aulaAoVivoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "AulaAoVivoPresenca" ADD CONSTRAINT "AulaAoVivoPresenca_aulaAoVivoId_fkey" FOREIGN KEY ("aulaAoVivoId") REFERENCES "AulaAoVivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AulaAoVivoPresenca" ADD CONSTRAINT "AulaAoVivoPresenca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
