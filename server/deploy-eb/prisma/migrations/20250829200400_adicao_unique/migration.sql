/*
  Warnings:

  - A unique constraint covering the columns `[videoUrl]` on the table `SubmissaoDesafio` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoDesafio_videoUrl_key" ON "public"."SubmissaoDesafio"("videoUrl");
