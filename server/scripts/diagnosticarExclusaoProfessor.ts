
import dotenv from "dotenv";

dotenv.config({ path: "server/.env" });

import { prisma } from "../prisma.js";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433"
  ) {
    throw new Error(
      "Execute somente no PostgreSQL local de teste."
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: "aaaaa" },
    select: {
      id: true,
      nomeDeUsuario: true,
      professor: {
        select: { id: true },
      },
    },
  });

  if (!usuario?.professor) {
    throw new Error(
      "Perfil Professor não encontrado."
    );
  }

  const professorId = usuario.professor.id;

  const [gestores, clubes, escolinhas] =
    await Promise.all([
      prisma.organizacaoGestor.findMany({
        where: { professorId },
      }),
      prisma.professorClube.findMany({
        where: { professorId },
      }),
      prisma.professorEscolinha.findMany({
        where: { professorId },
      }),
    ]);

  console.log("Usuário:", usuario.nomeDeUsuario);
  console.log("Professor ID:", professorId);

  console.log("\nGestores:");
  console.table(gestores);

  console.log("\nVínculos com clubes:");
  console.table(clubes);

  console.log("\nVínculos com escolinhas:");
  console.table(escolinhas);

  console.log("\nResumo:", {
    gestoresAtivos: gestores.filter(
      (item) => item.ativo
    ).length,
    totalClubes: clubes.length,
    totalEscolinhas: escolinhas.length,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
