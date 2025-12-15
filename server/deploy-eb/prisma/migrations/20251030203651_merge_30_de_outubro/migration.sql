-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "email" VARCHAR(191);

-- CreateTable
CREATE TABLE "TurmaUsuario" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "TurmaUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurmaUsuario_turmaId_idx" ON "TurmaUsuario"("turmaId");

-- CreateIndex
CREATE INDEX "TurmaUsuario_usuarioId_idx" ON "TurmaUsuario"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaUsuario_turmaId_usuarioId_key" ON "TurmaUsuario"("turmaId", "usuarioId");

-- AddForeignKey
ALTER TABLE "TurmaUsuario" ADD CONSTRAINT "TurmaUsuario_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaUsuario" ADD CONSTRAINT "TurmaUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
