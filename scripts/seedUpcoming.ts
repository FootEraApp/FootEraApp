import { PrismaClient, TipoTreino, Nivel, Categoria } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function getAtletaId(alvo?: string) {
  if (alvo) {
    const usuario = await prisma.usuario.findUnique({
      where: { nomeDeUsuario: alvo },
      select: { id: true }
    });
    if (usuario) {
      const at = await prisma.atleta.findUnique({ where: { usuarioId: usuario.id } });
      if (at) return at.id;
    }
  }
  const first = await prisma.atleta.findFirst();
  if (!first) throw new Error('Nenhum atleta encontrado.');
  return first.id;
}

async function ensureTreinoProgramado(
  nome: string,
  tipo: TipoTreino,
  duracaoMin: number,
  pontuacao = 5
) {
  return prisma.treinoProgramado.upsert({
    where: { nome },
    update: {
      tipoTreino: tipo,
      duracao: duracaoMin,
      pontuacao,
      naoExpira: false,
    },
    create: {
      id: crypto.randomUUID(),
      codigo: crypto.randomUUID(),
      nome,
      tipoTreino: tipo,
      duracao: duracaoMin,
      pontuacao,
      naoExpira: false,
      nivel: Nivel.Base,      
      categoria: [],         
      dicas: [],               
      metas: null,          
      imagemUrl: null,         
      objetivo: null           
    }
  });
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60000);
}

async function seed(atletaId: string) {
  const tp1 = await ensureTreinoProgramado('TP Técnica Curta',  TipoTreino.Tecnico, 30, 4);
  const tp2 = await ensureTreinoProgramado('TP Tático Médio',   TipoTreino.Tatico,  45, 6);
  const tp3 = await ensureTreinoProgramado('TP Técnico Longo',  TipoTreino.Tecnico, 60, 8);

  const agora = new Date();

  const agendar = async (tpId: string, base: string, prazoEmMin: number) => {
    const titulo = `${base} #${Math.floor(Math.random() * 100000)}`; 
    const dataTreino = agora;   
    const dataHora   = agora;   

    await prisma.treinoProgramado.update({
      where: { id: tpId },
      data: { dataAgendada: addMinutes(agora, prazoEmMin) }
    }).catch(() => { });

    const r = await prisma.treinoAgendado.create({
      data: {
        titulo,
        atletaId,
        treinoProgramadoId: tpId,
        dataTreino,
      }
    });

    return r;
  };

  const a1 = await agendar(tp1.id, 'Agendado Técnico', 120);
  const a2 = await agendar(tp2.id, 'Agendado Tático', 60 * 24);
  const a3 = await agendar(tp3.id, 'Agendado Técnico (Expirado)', -60);

  console.log('[OK] Criados:');
  console.log('-', a1.titulo);
  console.log('-', a2.titulo);
  console.log('-', a3.titulo);
}

async function main() {
  const alvo = process.argv[2] || 'aaaaa'; 
  const atletaId = await getAtletaId(alvo);
  await seed(atletaId);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
