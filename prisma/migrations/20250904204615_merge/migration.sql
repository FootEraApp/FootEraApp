-- AlterTable
ALTER TABLE "public"."Comentario" ADD COLUMN     "oculto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Postagem" ADD COLUMN     "oculto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportedCount" INTEGER NOT NULL DEFAULT 0;
