/**
 * Teste de integração do serviço de limite diário do FootEra.
 * Executar a partir da raiz do monorepo:
 *   $env:DATABASE_URL="postgresql://postgres:...@127.0.0.1:5433/footera_billing_qa"
 *   $env:NODE_ENV="test"
 *   npx tsx .\testar-limite-diario-treinos-qa.ts
 *
 * Cria APENAS fixtures com identificador QA_TREINOS_3_DIA e as remove em finally.
 * Não usa API HTTP; valida regras, banco e concorrência do serviço.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";
import {
  consultarLimiteDiarioTreinos,
  executarComLimiteDiarioTreinos,
  registrarRealizacaoDiaria,
  LimiteDiarioTreinosError,
} from "./server/services/limiteDiarioTreinos.service.js";

const TEST_PREFIX = "QA_TREINOS_3_DIA";
const url = process.env.DATABASE_URL ?? "";
const parsed = (() => { try { return new URL(url); } catch { return null; } })();
const host = parsed?.hostname;
const porta = parsed?.port;
const banco = parsed?.pathname.replace(/^\//, "");
if (
  process.env.NODE_ENV !== "test" ||
  !["127.0.0.1", "localhost"].includes(host ?? "") ||
  porta !== "5433" ||
  banco !== "footera_billing_qa"
) {
  console.error("BANCO_QA_INCORRETO: exigido NODE_ENV=test e 127.0.0.1:5433/footera_billing_qa");
  process.exit(1);
}

const runId = randomUUID().replace(/-/g, "");
const atletas: string[] = [];
const usuarios: string[] = [];
let verificacoes = 0;
function ok(condicao: unknown, descricao: string): asserts condicao {
  if (!condicao) throw new Error(`FALHOU: ${descricao}`);
  verificacoes++;
  console.log(`APROVADO ${String(verificacoes).padStart(2, "0")} — ${descricao}`);
}

async function criarAtletaTeste(sufixo: string) {
  const user = await prisma.usuario.create({
    data: {
      nome: `${TEST_PREFIX}_${sufixo}`,
      nomeDeUsuario: `qa3dia_${runId.slice(0, 16)}_${sufixo}`,
      email: `qa3dia_${runId}_${sufixo}@example.invalid`,
      senhaHash: `NAO_USAR_${runId}`,
      tipo: "Atleta",
    },
  });
  usuarios.push(user.id);
  const atleta = await prisma.atleta.create({
    data: {
      usuarioId: user.id,
      idade: 18,
      categoria: [],
      nome: `${TEST_PREFIX}_${sufixo}`,
    },
  });
  atletas.push(atleta.id);
  return { atletaId: atleta.id, usuarioId: user.id };
}

async function registrarLivre(atletaId: string, descricao: string) {
  return executarComLimiteDiarioTreinos({
    atletaId,
    data: new Date(),
    gravar: async (tx) => {
      const treino = await tx.treinoLivre.create({
        data: {
          atletaId,
          data: new Date(),
          descricao: `${TEST_PREFIX}_${descricao}_${runId}`,
          duracaoMin: 20,
          tipoAtividade: "TESTE_QA",
        },
      });
      await registrarRealizacaoDiaria(tx, {
        atletaId,
        origem: "LIVRE",
        origemId: treino.id,
        realizadoEm: treino.data,
      });
      return treino;
    },
  });
}

async function registrarAgendado(atletaId: string, descricao: string) {
  return executarComLimiteDiarioTreinos({
    atletaId,
    data: new Date(),
    gravar: async (tx) => {
      const agora = new Date();
      const treino = await tx.treinoAgendado.create({
        data: {
          atletaId,
          titulo: `${TEST_PREFIX}_${descricao}_${runId}`,
          dataTreino: agora,
          status: "CONCLUIDO",
          execucaoStatus: "COMPLETED",
          finishedAt: agora,
        },
      });
      await registrarRealizacaoDiaria(tx, {
        atletaId,
        origem: "AGENDADO",
        origemId: treino.id,
        realizadoEm: agora,
      });
      return treino;
    },
  });
}

async function bloquearQuarto(atletaId: string, sufixo: string) {
  try {
    await registrarLivre(atletaId, sufixo);
    return false;
  } catch (erro) {
    if (erro instanceof LimiteDiarioTreinosError) return true;
    throw erro;
  }
}

async function executar() {
  console.log("Banco: footera_billing_qa | Testando serviço + PostgreSQL (não endpoints HTTP)");
  const a = await criarAtletaTeste("principal");
  const inicial = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(!inicial.exempt && inicial.used === 0 && inicial.remaining === 3, "FREE começa com 0/3");

  const livreUm = await registrarLivre(a.atletaId, "primeiro_livre");
  let estado = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(estado.used === 1 && estado.remaining === 2, "Treino LIVRE: 1/3");
  const agendado = await registrarAgendado(a.atletaId, "segundo_agendado");
  estado = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(estado.used === 2 && estado.remaining === 1, "Treino AGENDADO: 2/3");
  await registrarLivre(a.atletaId, "terceiro_livre");
  estado = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(estado.used === 3 && estado.remaining === 0, "Treinos mistos: 3/3");
  await prisma.$transaction(async (tx) => {
    await registrarRealizacaoDiaria(tx, {
      atletaId: a.atletaId,
      origem: "AGENDADO",
      origemId: agendado.id,
      realizadoEm: agendado.finishedAt!,
    });
  });
  ok((await consultarLimiteDiarioTreinos(a.atletaId)).used === 3, "Repetir registro de mesmo agendamento não duplica");

  ok(await bloquearQuarto(a.atletaId, "quarto_bloqueado"), "Quarto treino FREE retorna erro de limite");
  const antesExclusao = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(antesExclusao.used === 3, "Quarto recusado não gera realização");

  await prisma.treinoLivre.delete({ where: { id: livreUm.id } });
  const aposExclusao = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(aposExclusao.used === 3, "Excluir treino livre não devolve vaga (3/3)");
  ok(await bloquearQuarto(a.atletaId, "quarto_apos_exclusao"), "Quarto segue bloqueado após exclusão");

  const assinatura = await prisma.assinatura.create({
    data: {
      usuarioId: a.usuarioId,
      contextoKey: "personal:Atleta",
      plano: "ATLETA_PRO",
      periodicidade: "Mensal",
      startsAt: new Date(Date.now() - 60_000),
      renovaEm: new Date(Date.now() + 86_400_000),
      status: "ATIVA",
      ativo: true,
    },
  });
  const pago = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(pago.exempt && pago.allowed === null && pago.remaining === null, "Assinatura PRO válida isenta atleta");
  await registrarLivre(a.atletaId, "quarto_com_pro");
  const estadoPago = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(estadoPago.used === 4 && estadoPago.exempt, "Atleta PRO registra quarto treino");

  await prisma.assinatura.update({
    where: { id: assinatura.id },
    data: { ativo: false, status: "CANCELADA" },
  });
  const voltouFree = await consultarLimiteDiarioTreinos(a.atletaId);
  ok(!voltouFree.exempt && voltouFree.used === 4 && voltouFree.remaining === 0, "Assinatura cancelada volta a respeitar cota");
  ok(await bloquearQuarto(a.atletaId, "quinto_bloqueado"), "Sem assinatura não registra novo treino");

  const b = await criarAtletaTeste("concorrencia");
  await registrarLivre(b.atletaId, "base_concorrencia_1");
  await registrarLivre(b.atletaId, "base_concorrencia_2");
  ok((await consultarLimiteDiarioTreinos(b.atletaId)).used === 2, "Atleta de concorrência começa em 2/3");

  const tentativas = await Promise.allSettled([
    registrarLivre(b.atletaId, "paralelo_a"),
    registrarLivre(b.atletaId, "paralelo_b"),
  ]);
  const sucesso = tentativas.filter((v) => v.status === "fulfilled").length;
  const rejeicoesLimite = tentativas.filter(
    (v) => v.status === "rejected" && v.reason instanceof LimiteDiarioTreinosError
  ).length;
  ok(sucesso === 1 && rejeicoesLimite === 1, "Concorrência: exatamente um sucesso e um bloqueio");
  ok((await consultarLimiteDiarioTreinos(b.atletaId)).used === 3, "Concorrência não ultrapassa 3/3");
  console.log(`\nRESULTADO: ${verificacoes}/${verificacoes} verificações aprovadas.`);
}

async function limpar() {
  // Somente IDs de usuários e atletas criados nesta execução.
  if (atletas.length) {
    await prisma.treinoRealizacaoDiaria.deleteMany({ where: { atletaId: { in: atletas } } });
    await prisma.treinoLivre.deleteMany({ where: { atletaId: { in: atletas } } });
    await prisma.treinoAgendado.deleteMany({ where: { atletaId: { in: atletas } } });
    await prisma.assinatura.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.atleta.deleteMany({ where: { id: { in: atletas } } });
  }
  if (usuarios.length) {
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  }
  console.log("LIMPEZA_QA: fixtures desta execução removidas.");
}

let falhou = false;
try {
  await executar();
} catch (erro) {
  falhou = true;
  console.error("TESTE_FALHOU:", erro);
} finally {
  try { await limpar(); }
  catch (erro) { falhou = true; console.error("LIMPEZA_QA_FALHOU: verificar fixtures QA_TREINOS_3_DIA", erro); }
  await prisma.$disconnect();
}
if (falhou) process.exitCode = 1;