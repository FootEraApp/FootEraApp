import { prisma } from "../server/prisma.js"

function normalizarNomeExercicio(nome: string) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function main() {
  console.log("Iniciando deduplicação de exercícios...");

  // 1) preencher nomeNormalizado que estiver nulo
  const exercicios = await prisma.exercicio.findMany({
    select: { id: true, nome: true, nomeNormalizado: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  for (const ex of exercicios) {
    const nomeNormalizado = normalizarNomeExercicio(ex.nome);
    if (ex.nomeNormalizado !== nomeNormalizado) {
      await prisma.exercicio.update({
        where: { id: ex.id },
        data: { nomeNormalizado },
      });
    }
  }

  const personalizados = await prisma.exercicioPersonalizado.findMany({
    select: { id: true, nome: true, nomeNormalizado: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });

  for (const ex of personalizados) {
    const nomeNormalizado = normalizarNomeExercicio(ex.nome);
    if (ex.nomeNormalizado !== nomeNormalizado) {
      await prisma.exercicioPersonalizado.update({
        where: { id: ex.id },
        data: { nomeNormalizado },
      });
    }
  }

  // 2) recarrega já normalizados
  const exerciciosAtualizados = await prisma.exercicio.findMany({
    select: { id: true, nome: true, nomeNormalizado: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const personalizadosAtualizados = await prisma.exercicioPersonalizado.findMany({
    select: { id: true, nome: true, nomeNormalizado: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });

  // 3) deduplicar dentro de Exercicio (mantém o mais antigo)
  const vistosExercicio = new Map<string, string>();
  for (const ex of exerciciosAtualizados) {
    const chave = ex.nomeNormalizado;
    if (!chave) continue;

    if (!vistosExercicio.has(chave)) {
      vistosExercicio.set(chave, ex.id);
      continue;
    }

    console.log(`Apagando Exercicio duplicado: ${ex.nome} (${ex.id})`);
    await prisma.exercicio.delete({ where: { id: ex.id } });
  }

  // 4) deduplicar dentro de ExercicioPersonalizado (mantém o mais antigo)
  const vistosPersonalizado = new Map<string, string>();
  for (const ex of personalizadosAtualizados) {
    const chave = ex.nomeNormalizado;
    if (!chave) continue;

    if (!vistosPersonalizado.has(chave)) {
      vistosPersonalizado.set(chave, ex.id);
      continue;
    }

    console.log(`Apagando ExercicioPersonalizado duplicado: ${ex.nome} (${ex.id})`);
    await prisma.exercicioPersonalizado.delete({ where: { id: ex.id } });
  }

  // 5) apagar personalizados que conflitam com Exercicio
  const exerciciosFinais = await prisma.exercicio.findMany({
    select: { nomeNormalizado: true },
  });

  const oficiaisSet = new Set(
    exerciciosFinais.map((e) => e.nomeNormalizado).filter(Boolean)
  );

  const personalizadosFinais = await prisma.exercicioPersonalizado.findMany({
    select: { id: true, nome: true, nomeNormalizado: true },
  });

  for (const p of personalizadosFinais) {
    if (p.nomeNormalizado && oficiaisSet.has(p.nomeNormalizado)) {
      console.log(
        `Apagando personalizado por conflito com exercício oficial: ${p.nome} (${p.id})`
      );
      await prisma.exercicioPersonalizado.delete({
        where: { id: p.id },
      });
    }
  }

  console.log("Deduplicação concluída.");
}

main()
  .catch((err) => {
    console.error("Erro ao deduplicar exercícios:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });