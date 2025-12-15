-- DropForeignKey
ALTER TABLE "public"."AtletaObservado" DROP CONSTRAINT "AtletaObservado_professorId_fkey";

-- AddForeignKey
ALTER TABLE "AtletaObservado" ADD CONSTRAINT "AtletaObservado_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
