// scripts/backfill_atividades_metodologias.ts
import { prisma } from "../server/prisma.js";

async function main() {
  const metodologias = await prisma.metodologia.findMany({
    select: { id: true, titulo: true, capaUrl: true, criadorUsuarioId: true, criadoEm: true },
  });

  for (const m of metodologias) {
    const link = `/metodologias/${m.id}`;

    const exists = await prisma.atividadeRecente.findFirst({
      where: { usuarioId: m.criadorUsuarioId, tipo: "Metodologia", link },
      select: { id: true },
    });

    if (!exists) {
      await prisma.atividadeRecente.create({
        data: {
          usuarioId: m.criadorUsuarioId,
          tipo: "Metodologia",
          titulo: `Nova metodologia: ${m.titulo}`,
          imagemUrl: m.capaUrl ?? null,
          link,
          createdAt: m.criadoEm ?? undefined,
        },
      });
    }
  }
  console.log(`✅ Concluído. Alterações aplicadas: ${metodologias.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
