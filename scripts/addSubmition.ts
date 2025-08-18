import { PrismaClient, TipoTreino } from '@prisma/client';

const prisma = new PrismaClient();

function tipoToKey(tipo?: TipoTreino | null) {
  if (!tipo) return null;
  const t = String(tipo).toLowerCase();
  if (t.includes('tecnico') || t.includes('técnico')) return 'tecnico';
  if (t.includes('tatico')  || t.includes('tático'))  return 'tatico';
  if (t.includes('mental')) return 'mental';
  if (t.includes('físico') || t.includes('fisico')) return 'fisico';
  return null;
}

async function getAlvo(atletaUser?: string) {
  if (atletaUser) {
    const u = await prisma.usuario.findUnique({ where: { nomeDeUsuario: atletaUser }, select: { id: true } });
    if (u) {
      const a = await prisma.atleta.findUnique({ where: { usuarioId: u.id } });
      if (a) return a;
    }
  }
  const first = await prisma.atleta.findFirst();
  if (!first) throw new Error('Nenhum atleta encontrado.');
  return first;
}

async function pickAgendadoValido(atletaId: string) {
  const agora = new Date();
  const rows = await prisma.treinoAgendado.findMany({
    where: {
      atletaId,
      submissaoTreinos: { none: {} }
    },
    include: { treinoProgramado: true },
    orderBy: { dataExpiracao: 'asc' }
  });

  return rows.find(r => {
    const prazo = (r as any).dataExpiracao as Date | null ?? r.treinoProgramado?.dataAgendada ?? null;
    return prazo ? new Date(prazo).getTime() > agora.getTime() : true;
  }) || null;
}

async function criarSubmissao(atletaId: string, treinoAgendadoId: string) {
  const sub = await prisma.submissaoTreino.create({
    data: { atletaId, treinoAgendadoId, aprovado: true }
  });

  const withTp = await prisma.submissaoTreino.findUnique({
    where: { id: sub.id },
    include: { treinoAgendado: { include: { treinoProgramado: true } } }
  });

  const tp = withTp?.treinoAgendado?.treinoProgramado;
  const tipoKey = tipoToKey(tp?.tipoTreino);
  const minutos = Number(tp?.duracao ?? 0);
  const pontos  = Number(tp?.pontuacao ?? 0);

  await prisma.submissaoTreino.update({
    where: { id: sub.id },
    data: {
      treinoTituloSnapshot: tp?.nome ?? withTp?.treinoAgendado?.titulo ?? 'Treino',
      tipoTreinoSnapshot: (tp?.tipoTreino ?? null) as TipoTreino | null,
      duracaoMinutos: minutos,
      pontuacaoSnapshot: pontos,
      pontosCreditados: pontos
    }
  });

  await prisma.estatisticaAtleta.upsert({
    where: { atletaId },
    update: {
      totalTreinos:   { increment: 1 },
      horasTreinadas: { increment: minutos / 60 },
      totalPontos:    { increment: pontos },
      ...(tipoKey === 'tecnico' ? { tecnico: { increment: 1 } } : {}),
      ...(tipoKey === 'tatico'  ? { tatico:  { increment: 1 } } : {}),
      ...(tipoKey === 'mental'  ? { mental:  { increment: 1 } } : {}),
      ...(tipoKey === 'fisico'  ? { fisico:  { increment: 1 } } : {})
    },
    create: {
      atletaId,
      totalTreinos: 1,
      totalDesafios: 0,
      totalPontos: pontos,
      horasTreinadas: minutos / 60,
      tecnico: tipoKey === 'tecnico' ? 1 : 0,
      tatico:  tipoKey === 'tatico'  ? 1 : 0,
      mental:  tipoKey === 'mental'  ? 1 : 0,
      fisico:  tipoKey === 'fisico'  ? 1 : 0
    }
  });

  await prisma.pontuacaoAtleta.upsert({
    where: { atletaId },
    update: {
      pontuacaoPerformance: { increment: pontos },
      pontuacaoTotal:       { increment: pontos }
    },
    create: {
      atletaId,
      pontuacaoPerformance: pontos,
      pontuacaoTotal: pontos,
      pontuacaoDisciplina: 0,
      pontuacaoResponsabilidade: 0
    }
  });

  return sub.id;
}

async function main() {
  const alvo = process.argv[2] || 'aaaaa';
  const atleta = await getAlvo(alvo);
  const ag = await pickAgendadoValido(atleta.id);
  if (!ag) {
    console.log('Nenhum treino agendado válido (sem submissão e não expirado) encontrado.');
    return;
  }
  const subId = await criarSubmissao(atleta.id, ag.id);
  console.log(`[OK] Submissão criada e aprovada: ${subId}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
