/**
 * QA de idempotencia de estatisticas de submissao do FootEra.
 * Somente banco isolado footera_billing_qa. Nao usa HTTP.
 * Cria usuarios, atletas, um treino programado, agendamentos e submisssoes ficticios;
 * remove exclusivamente os dados identificados nesta execucao no bloco finally.
 * Requer campo SubmissaoTreino.estatisticasProcessadasEm e helper idempotente.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";
import { aplicarEstatisticasPosSubmissao } from "./server/controllers/submissoes/utilsEstatistica.js";

const url = (() => { try { return new URL(process.env.DATABASE_URL ?? ""); } catch { return null; } })();
if (
  process.env.NODE_ENV !== "test" ||
  !url || !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5433" ||
  url.pathname !== "/footera_billing_qa"
) {
  console.error("BANCO_QA_INCORRETO: exija NODE_ENV=test e PostgreSQL 127.0.0.1:5433/footera_billing_qa");
  process.exit(1);
}

const run = randomUUID().replaceAll("-", "");
const prefix = `QA_IDEMPOTENCIA_${run}`;
const usuarios: string[] = [];
const atletas: string[] = [];
const treinos: string[] = [];
const agendamentos: string[] = [];
const submissoes: string[] = [];
let aprovados = 0;
function ok(cond: unknown, nome: string) {
  if (!cond) throw new Error(`FALHOU: ${nome}`);
  console.log(`APROVADO ${String(++aprovados).padStart(2, "0")} — ${nome}`);
}

async function criarAtleta(sufixo: string) {
  const u = await prisma.usuario.create({
    data: {
      nome: `${prefix}_${sufixo}`,
      nomeDeUsuario: `qa_idem_${run.slice(0, 14)}_${sufixo}`,
      email: `qa_idem_${run}_${sufixo}@example.invalid`,
      senhaHash: `QA_NAO_USAR_${run}`,
      tipo: "Atleta",
    },
  });
  usuarios.push(u.id);
  const a = await prisma.atleta.create({
    data: { usuarioId: u.id, idade: 18, categoria: [], nome: `${prefix}_${sufixo}` },
  });
  atletas.push(a.id);
  return a.id;
}

async function criarSubmissao(atletaId: string, treinoProgramadoId: string, aprovado: boolean) {
  const ag = await prisma.treinoAgendado.create({
    data: { titulo: prefix, atletaId, treinoProgramadoId, dataTreino: new Date(), status: "CONCLUIDO", finishedAt: new Date() },
  });
  agendamentos.push(ag.id);
  const sub = await prisma.submissaoTreino.create({
    data: {
      atletaId, treinoAgendadoId: ag.id, aprovado,
      duracaoMinutos: 18,
      pontuacaoSnapshot: 7,
      pontosCreditados: 7, // treino vale 20; preserva penalidade que veio do controller
    },
  });
  submissoes.push(sub.id);
  return { subId: sub.id, agId: ag.id };
}

async function executar() {
  console.log("QA: idempotencia de estatisticas — banco footera_billing_qa");
  const athlete = await criarAtleta("principal");
  const treino = await prisma.treinoProgramado.create({
    data: { nome: prefix, nivel: "Base", categoria: [], dicas: [], pontuacao: 20, duracao: 30 },
  });
  treinos.push(treino.id);
  const primeiro = await criarSubmissao(athlete, treino.id, false);

  const rejeitado = await aplicarEstatisticasPosSubmissao(primeiro.subId, athlete, primeiro.agId, 18);
  const subAntes = await prisma.submissaoTreino.findUniqueOrThrow({ where: { id: primeiro.subId } });
  ok((rejeitado as any)?.processado === false && !subAntes.estatisticasProcessadasEm,
    "Submissao nao aprovada nao processa estatisticas");
  ok((await prisma.estatisticaAtleta.findUnique({ where: { atletaId: athlete } })) === null,
    "Submissao pendente nao credita EstatisticaAtleta");

  await prisma.submissaoTreino.update({ where: { id: primeiro.subId }, data: { aprovado: true } });
  const feito = await aplicarEstatisticasPosSubmissao(primeiro.subId, athlete, primeiro.agId, 18);
  ok((feito as any)?.processado === true, "Primeira submissao aprovada foi processada");
  const s1 = await prisma.submissaoTreino.findUniqueOrThrow({ where: { id: primeiro.subId } });
  const e1 = await prisma.estatisticaAtleta.findUniqueOrThrow({ where: { atletaId: athlete } });
  ok(Boolean(s1.estatisticasProcessadasEm), "Marca persistente de processamento foi registrada");
  ok(s1.pontosCreditados === 7 && s1.pontuacaoSnapshot === 7,
    "Penalidade preservada: 7 pontos, sem sobrescrever com 20");
  ok(e1.totalTreinos === 1 && e1.totalPontos === 7 && Math.abs(e1.horasTreinadas - 0.3) < 1e-8,
    "Estatisticas do atleta corretas apos primeiro credito");
  ok((await prisma.estatisticaTreino.findUniqueOrThrow({ where: { treinoId: treino.id } })).realizacoes === 1,
    "Estatistica do treino reflete uma submissao aprovada");

  const repetida = await aplicarEstatisticasPosSubmissao(primeiro.subId, athlete, primeiro.agId, 18);
  const e2 = await prisma.estatisticaAtleta.findUniqueOrThrow({ where: { atletaId: athlete } });
  ok((repetida as any)?.processado === false && e2.totalTreinos === 1 && e2.totalPontos === 7,
    "Reenvio nao soma estatisticas novamente");

  const segundo = await criarSubmissao(athlete, treino.id, true);
  const paralelas = await Promise.allSettled([
    aplicarEstatisticasPosSubmissao(segundo.subId, athlete, segundo.agId, 18),
    aplicarEstatisticasPosSubmissao(segundo.subId, athlete, segundo.agId, 18),
  ]);
  const processadas = paralelas.filter((x) => x.status === "fulfilled" && (x.value as any)?.processado === true).length;
  const ignoradas = paralelas.filter((x) => x.status === "fulfilled" && (x.value as any)?.processado === false).length;
  ok(processadas === 1 && ignoradas === 1,
    "Concorrencia: so uma chamada processa a mesma submissao");
  const e3 = await prisma.estatisticaAtleta.findUniqueOrThrow({ where: { atletaId: athlete } });
  ok(e3.totalTreinos === 2 && e3.totalPontos === 14,
    "Concorrencia nao duplicou totalTreinos nem totalPontos");
  ok((await prisma.estatisticaTreino.findUniqueOrThrow({ where: { treinoId: treino.id } })).realizacoes === 2,
    "Contador do treino consistente com duas submissoes aprovadas");

  // A pontuacao oficial e calculada por recomputePontuacaoAtleta nos controllers;
  // este script nao precisa alterar PontuacaoAtleta para testar o helper.
  console.log(`\nRESULTADO: ${aprovados}/${aprovados} verificacoes aprovadas.`);
}

async function limpar() {
  // IDs rastreados APENAS nesta execucao. Nao use deleteMany sem os filtros de IDs.
  if (submissoes.length) await prisma.submissaoTreino.deleteMany({ where: { id: { in: submissoes } } });
  if (agendamentos.length) await prisma.treinoAgendado.deleteMany({ where: { id: { in: agendamentos } } });
  if (treinos.length) {
    await prisma.estatisticaTreino.deleteMany({ where: { treinoId: { in: treinos } } });
    await prisma.treinoProgramado.deleteMany({ where: { id: { in: treinos } } });
  }
  if (atletas.length) {
    await prisma.estatisticaAtleta.deleteMany({ where: { atletaId: { in: atletas } } });
    await prisma.atleta.deleteMany({ where: { id: { in: atletas } } });
  }
  if (usuarios.length) await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  console.log("LIMPEZA_QA: fixtures desta execucao removidas.");
}

let erro = false;
try { await executar(); }
catch (e) { erro = true; console.error("TESTE_FALHOU:", e); }
finally {
  try { await limpar(); } catch (e) { erro = true; console.error("LIMPEZA_QA_FALHOU:", e); }
  await prisma.$disconnect();
}
if (erro) process.exitCode = 1;