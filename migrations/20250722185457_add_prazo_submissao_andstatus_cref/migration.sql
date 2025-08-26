-- CreateEnum
CREATE TYPE "StatusCref" AS ENUM ('Ativo', 'Desativo', 'Pendente');

-- AlterTable
ALTER TABLE "DesafioOficial" ADD COLUMN     "prazoSubmissao" TIMESTAMP DEFAULT now();

-- AlterTable
ALTER TABLE "Professor" ADD COLUMN     "statusCref" "StatusCref";
