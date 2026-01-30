import { prisma } from "../server/prisma.js";
import { sanitizeMediaPath } from "../server/utils/mediaSanitizer.js";

async function main() {
  let changes = 0;

  // 1) Usuario.foto
  const usuarios = await prisma.usuario.findMany({ select: { id: true, foto: true } });
  for (const u of usuarios) {
    const fixed = sanitizeMediaPath(u.foto);
    if (fixed !== u.foto) {
      await prisma.usuario.update({ where: { id: u.id }, data: { foto: fixed } });
      changes++;
    }
  }

  // 2) Atleta.foto
  const atletas = await prisma.atleta.findMany({ select: { id: true, foto: true } });
  for (const a of atletas) {
    const fixed = sanitizeMediaPath(a.foto);
    if (fixed !== a.foto) {
      await prisma.atleta.update({ where: { id: a.id }, data: { foto: fixed } });
      changes++;
    }
  }

  // 3) Professor.fotoUrl
  const professores = await prisma.professor.findMany({ select: { id: true, fotoUrl: true } });
  for (const p of professores) {
    const fixed = sanitizeMediaPath(p.fotoUrl);
    if (fixed !== p.fotoUrl) {
      await prisma.professor.update({ where: { id: p.id }, data: { fotoUrl: fixed } });
      changes++;
    }
  }

  // 4) Administrador.fotoUrl (se existir no schema)
  if (prisma.administrador) {
    const admins = await prisma.administrador.findMany({ select: { id: true, fotoUrl: true } as any });
    for (const a of admins as any[]) {
      const fixed = sanitizeMediaPath(a.fotoUrl);
      if (fixed !== a.fotoUrl) {
        await (prisma.administrador as any).update({ where: { id: a.id }, data: { fotoUrl: fixed } });
        changes++;
      }
    }
  }

  // 5) Olheiro.fotoUrl
  const olheiros = await prisma.olheiro.findMany({ select: { id: true, fotoUrl: true } });
  for (const o of olheiros) {
    const fixed = sanitizeMediaPath(o.fotoUrl);
    if (fixed !== o.fotoUrl) {
      await prisma.olheiro.update({ where: { id: o.id }, data: { fotoUrl: fixed } });
      changes++;
    }
  }

  // 6) Clube.logo
  const clubes = await prisma.clube.findMany({ select: { id: true, logo: true } });
  for (const c of clubes) {
    const fixed = sanitizeMediaPath(c.logo);
    if (fixed !== c.logo) {
      await prisma.clube.update({ where: { id: c.id }, data: { logo: fixed } });
      changes++;
    }
  }

  // 7) Escolinha.logo
  const escolinhas = await prisma.escolinha.findMany({ select: { id: true, logo: true } });
  for (const e of escolinhas) {
    const fixed = sanitizeMediaPath(e.logo);
    if (fixed !== e.logo) {
      await prisma.escolinha.update({ where: { id: e.id }, data: { logo: fixed } });
      changes++;
    }
  }

  // 8) TreinoProgramado.imagemUrl
  const treinos = await prisma.treinoProgramado.findMany({ select: { id: true, imagemUrl: true } });
  for (const t of treinos) {
    const fixed = sanitizeMediaPath(t.imagemUrl);
    if (fixed !== t.imagemUrl) {
      await prisma.treinoProgramado.update({ where: { id: t.id }, data: { imagemUrl: fixed } });
      changes++;
    }
  }

  // 9) AtividadeRecente.imagemUrl (se existir)
  if (prisma.atividadeRecente) {
    const atividades = await prisma.atividadeRecente.findMany({ select: { id: true, imagemUrl: true } as any });
    for (const a of atividades as any[]) {
      const fixed = sanitizeMediaPath(a.imagemUrl);
      if (fixed !== a.imagemUrl) {
        await (prisma.atividadeRecente as any).update({ where: { id: a.id }, data: { imagemUrl: fixed } });
        changes++;
      }
    }
  }

  // 10) Postagem.imagemUrl (se existir)
  if (prisma.postagem) {
    const posts = await prisma.postagem.findMany({ select: { id: true, imagemUrl: true } as any });
    for (const p of posts as any[]) {
      const fixed = sanitizeMediaPath(p.imagemUrl);
      if (fixed !== p.imagemUrl) {
        await (prisma.postagem as any).update({ where: { id: p.id }, data: { imagemUrl: fixed } });
        changes++;
      }
    }
  }

  console.log(`✅ Concluído. Alterações aplicadas: ${changes}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });