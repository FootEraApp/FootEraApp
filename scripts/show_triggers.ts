import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const triggers = await prisma.$queryRawUnsafe<any[]>(`
    SELECT event_object_table AS tabela, trigger_name, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table IN ('PontuacaoAtleta','EstatisticaAtleta','RelacaoTreinamento')
    ORDER BY 1,2;
  `);
  console.table(triggers);

  const trgFuncs = await prisma.$queryRawUnsafe<any[]>(`
    SELECT c.relname AS tabela, t.tgname AS trigger_name, p.proname AS function_name
    FROM pg_trigger t
    JOIN pg_class c  ON c.oid = t.tgrelid
    JOIN pg_proc  p  ON p.oid = t.tgfoid
    WHERE c.relname IN ('PontuacaoAtleta','EstatisticaAtleta','RelacaoTreinamento')
      AND NOT t.tgisinternal
    ORDER BY 1,2;
  `);
  console.table(trgFuncs);
}
main().finally(() => prisma.$disconnect());