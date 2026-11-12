/**
 * FootEra — QA de isenção Learning e datas de realização.
 * Salvar na RAIZ do monorepo e executar: npx tsx .\testar-learning-datas-limite-qa.ts
 * Não exige Express/JWT. Usa somente usuários, atletas, assinaturas e treinos fictícios.
 * Teste OPCIONAL de data futura HTTP: definir QA_HTTP_TOKEN e QA_API_BASE_URL,
 * com servidor local ligado ao MESMO banco QA. Não imprima nem compartilhe tokens.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";
import {
  consultarLimiteDiarioTreinos,
  executarComLimiteDiarioTreinos,
  registrarRealizacaoDiaria,
  janelaDiaTreino,
  LimiteDiarioTreinosError,
} from "./server/services/limiteDiarioTreinos.service.js";

const parsed = (() => {
  try { return new URL(process.env.DATABASE_URL ?? ""); }
  catch { return null; }
})();
if (
  process.env.NODE_ENV !== "test" || !parsed ||
  !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
  parsed.port !== "5433" ||
  parsed.pathname !== "/footera_billing_qa"
) {
  console.error("BANCO_QA_INCORRETO: NODE_ENV=test e banco 127.0.0.1:5433/footera_billing_qa obrigatórios.");
  process.exit(1);
}

const run = randomUUID().replace(/-/g, "");
const tag = `QA_LEARNING_DATAS_${run}`;
const usuarios: string[] = [];
const atletas: string[] = [];
let checks = 0;
function aprovar(cond: unknown, descricao: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${descricao}`);
  checks++;
  console.log(`APROVADO ${String(checks).padStart(2, "0")} — ${descricao}`);
}

async function criarAtleta(sufixo: string) {
  const user = await prisma.usuario.create({
    data: {
      nome: `${tag}_${sufixo}`,
      nomeDeUsuario: `qa_learn_${run.slice(0, 14)}_${sufixo}`,
      email: `qa_learn_${run}_${sufixo}@example.invalid`,
      senhaHash: `SEM_LOGIN_${run}`,
      tipo: "Atleta",
    },
  });
  usuarios.push(user.id);
  const atleta = await prisma.atleta.create({
    data: {
      usuarioId: user.id,
      idade: 18,
      categoria: [],
      nome: `${tag}_${sufixo}`,
    },
  });
  atletas.push(atleta.id);
  return { usuarioId: user.id, atletaId: atleta.id };
}

async function treinar(atletaId: string, quando: Date, nome: string) {
  return executarComLimiteDiarioTreinos({
    atletaId,
    data: quando,
    gravar: async (tx) => {
      const ag = await tx.treinoAgendado.create({
        data: {
          atletaId,
          titulo: `${tag}_${nome}`,
          dataTreino: quando,
          status: "CONCLUIDO",
          execucaoStatus: "COMPLETED",
          finishedAt: quando,
        },
      });
      await registrarRealizacaoDiaria(tx, {
        atletaId, origem: "AGENDADO", origemId: ag.id, realizadoEm: quando,
      });
      return ag;
    },
  });
}

async function treinarTres(atletaId: string, quando: Date, nome: string) {
  for (let i = 1; i <= 3; i++) await treinar(atletaId, quando, `${nome}_${i}`);
}

async function bloqueiaQuarto(atletaId: string, quando: Date, nome: string) {
  const antes = await prisma.treinoRealizacaoDiaria.count({ where: { atletaId } });
  let bloqueado = false;
  try { await treinar(atletaId, quando, nome); }
  catch (err) {
    if (!(err instanceof LimiteDiarioTreinosError)) throw err;
    bloqueado = true;
    aprovar(err.date === janelaDiaTreino(quando).dia,
      `Bloqueio refere-se à data correta (${err.date})`);
  }
  const depois = await prisma.treinoRealizacaoDiaria.count({ where: { atletaId } });
  aprovar(bloqueado && depois === antes, `${nome}: tentativa recusada sem gravar realização`);
}

async function criarAssinatura(usuarioId: string, plano: string, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return prisma.assinatura.create({
    data: {
      usuarioId,
      contextoKey: "personal:Atleta",
      plano,
      periodicidade: "Mensal",
      startsAt: new Date(now - 86_400_000),
      renovaEm: new Date(now + 30 * 86_400_000),
      status: "ATIVA",
      ativo: true,
      ...overrides,
    },
  });
}

async function opcionalHttpFuturo() {
  const token = String(process.env.QA_HTTP_TOKEN ?? "").trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    console.log("OPCIONAL NÃO EXECUTADO — validação HTTP de data futura: defina QA_HTTP_TOKEN para executá-la.");
    return;
  }
  const base = new URL(process.env.QA_API_BASE_URL ?? "http://127.0.0.1:3001");
  if (
    base.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(base.hostname) ||
    base.port !== "3001" ||
    base.pathname !== "/"
  ) throw new Error("API_QA_INCORRETA: use http://127.0.0.1:3001");
  const root = base.origin;
  const headers = { Authorization: `Bearer ${token}` };
  const info = await fetch(`${root}/api/treinos/limite-diario`, {
    headers, signal: AbortSignal.timeout(15000),
  });
  const dados: any = await info.json().catch(() => ({}));
  if (info.status !== 200 || !dados?.atletaId) {
    throw new Error(`HTTP_QA_IDENTIDADE_INVALIDA: ${info.status}; confirme JWT de atleta QA.`);
  }
  const existe = await prisma.atleta.findUnique({
    where: { id: dados.atletaId }, select: { id: true },
  });
  aprovar(Boolean(existe), "Token HTTP corresponde a atleta existente no banco QA");
  const antes = await prisma.treinoLivre.count({ where: { atletaId: dados.atletaId } });
  const form = new FormData();
  form.append("data", new Date(Date.now() + 86_400_000).toISOString());
  form.append("descricao", `${tag}_FUTURO_REJEITADO`);
  form.append("duracaoMin", "10");
  form.append("tipoAtividade", "TESTE_QA");
  const resp = await fetch(`${root}/api/treinos-livres`, {
    method: "POST", headers, body: form, signal: AbortSignal.timeout(15000),
  });
  const json: any = await resp.json().catch(() => ({}));
  aprovar(resp.status === 400 && json.code === "FUTURE_TRAINING_DATE",
    `API recusa treino de amanhã com FUTURE_TRAINING_DATE (HTTP ${resp.status}, código ${json.code})`);
  const depois = await prisma.treinoLivre.count({ where: { atletaId: dados.atletaId } });
  aprovar(antes === depois, "Data futura não criou treino livre via HTTP");
}

async function executar() {
  console.log("QA final: Learning 1 / Learning 3 / datas e virada de dia — banco footera_billing_qa");
  const agora = new Date();
  const { dia: hoje, inicio } = janelaDiaTreino(agora);
  const ontemData = new Date(inicio.getTime() - 12 * 60 * 60_000);
  const anteontemData = new Date(inicio.getTime() - 36 * 60 * 60_000);
  const ontem = janelaDiaTreino(ontemData).dia;
  aprovar(ontem !== hoje && ontem !== janelaDiaTreino(anteontemData).dia,
    "Datas do QA são dias distintos em America/Sao_Paulo");

  // Isenção Learning 1 e Learning 3, inclusive após 3 treinos.
  for (const [sufixo, plano] of [["learning1", "ATLETA_LEARNING_1"], ["learning3", "ATLETA_LEARNING_3"]] as const) {
    const a = await criarAtleta(sufixo);
    const assinatura = await criarAssinatura(a.usuarioId, plano);
    const estado = await consultarLimiteDiarioTreinos(a.atletaId);
    aprovar(estado.exempt && estado.allowed === null && estado.remaining === null,
      `${plano}: assinatura ativa libera treinos ilimitados`);
    await treinarTres(a.atletaId, agora, `${sufixo}_base`);
    await treinar(a.atletaId, agora, `${sufixo}_quarto`);
    const aposQuarto = await consultarLimiteDiarioTreinos(a.atletaId);
    aprovar(aposQuarto.exempt && aposQuarto.used === 4,
      `${plano}: quarto treino foi gravado no mesmo dia`);
    await prisma.assinatura.update({
      where: { id: assinatura.id }, data: { ativo: false, status: "CANCELADA" },
    });
    const cancelado = await consultarLimiteDiarioTreinos(a.atletaId);
    aprovar(!cancelado.exempt && cancelado.used === 4 && cancelado.remaining === 0,
      `${plano}: cancelamento remove isenção sem apagar histórico`);
    await bloqueiaQuarto(a.atletaId, agora, `${sufixo}_apos_cancelamento`);
  }

  // Expiração, assinatura de início futuro e trial.
  const exp = await criarAtleta("expirado");
  await treinarTres(exp.atletaId, agora, "exp_base");
  const assExp = await criarAssinatura(exp.usuarioId, "ATLETA_LEARNING_1", {
    renovaEm: new Date(Date.now() - 1000),
  });
  aprovar(!(await consultarLimiteDiarioTreinos(exp.atletaId)).exempt,
    "Learning expirado não concede isenção");
  await bloqueiaQuarto(exp.atletaId, agora, "expirado_quarto");
  await prisma.assinatura.update({
    where: { id: assExp.id },
    data: { startsAt: new Date(Date.now() + 86_400_000), renovaEm: new Date(Date.now() + 60 * 86_400_000) },
  });
  aprovar(!(await consultarLimiteDiarioTreinos(exp.atletaId)).exempt,
    "Assinatura que começa amanhã não concede isenção hoje");
  await bloqueiaQuarto(exp.atletaId, agora, "inicio_futuro_quarto");

  const trial = await criarAtleta("trial");
  await treinarTres(trial.atletaId, agora, "trial_base");
  const assTrial = await criarAssinatura(trial.usuarioId, "ATLETA_LEARNING_3", {
    status: "TRIAL",
    trialStartsAt: new Date(Date.now() - 86_400_000),
    trialEndsAt: new Date(Date.now() + 86_400_000),
  });
  aprovar((await consultarLimiteDiarioTreinos(trial.atletaId)).exempt,
    "Learning 3 em TRIAL válido libera isenção");
  await treinar(trial.atletaId, agora, "trial_quarto");
  aprovar((await consultarLimiteDiarioTreinos(trial.atletaId)).used === 4,
    "Learning 3 em TRIAL válido permite quarto treino");
  await prisma.assinatura.update({
    where: { id: assTrial.id }, data: { trialEndsAt: new Date(Date.now() - 1000) },
  });
  aprovar(!(await consultarLimiteDiarioTreinos(trial.atletaId)).exempt,
    "Learning 3 com TRIAL encerrado perde isenção");
  await bloqueiaQuarto(trial.atletaId, agora, "trial_expirado_quinto");

  // Separação da cota por dia, retroativos e meia-noite Brasília.
  const dias = await criarAtleta("datas");
  await treinarTres(dias.atletaId, ontemData, "ontem_base");
  let e = await consultarLimiteDiarioTreinos(dias.atletaId, ontemData);
  aprovar(e.used === 3 && e.date === ontem, "Ontem contabiliza exatamente 3/3");
  await bloqueiaQuarto(dias.atletaId, ontemData, "quarto_ontem");
  e = await consultarLimiteDiarioTreinos(dias.atletaId, agora);
  aprovar(e.used === 0 && e.remaining === 3 && e.date === hoje,
    "Hoje começa com 0/3 mesmo depois de ontem atingir 3/3");
  await treinar(dias.atletaId, agora, "hoje_um");
  e = await consultarLimiteDiarioTreinos(dias.atletaId, agora);
  aprovar(e.used === 1 && e.remaining === 2, "Treino de hoje conta em hoje, não em ontem");
  await treinar(dias.atletaId, anteontemData, "retroativo_anteontem");
  e = await consultarLimiteDiarioTreinos(dias.atletaId, anteontemData);
  aprovar(e.used === 1 && e.remaining === 2, "Treino retroativo usa a cota de anteontem");
  aprovar((await consultarLimiteDiarioTreinos(dias.atletaId, ontemData)).used === 3 &&
    (await consultarLimiteDiarioTreinos(dias.atletaId, agora)).used === 1,
    "Retroativo não altera as contagens de ontem e hoje");
  const marcados = await prisma.treinoRealizacaoDiaria.findMany({
    where: { atletaId: dias.atletaId },
    select: { diaReferencia: true },
  });
  aprovar(marcados.filter(x => x.diaReferencia === ontem).length === 3 &&
    marcados.filter(x => x.diaReferencia === hoje).length === 1,
    "Histórico permanente guarda o dia correto para cada realização");

  await opcionalHttpFuturo();
  console.log(`\nRESULTADO: ${checks}/${checks} verificações aprovadas.`);
}

async function limpar() {
  if (atletas.length) {
    await prisma.treinoRealizacaoDiaria.deleteMany({ where: { atletaId: { in: atletas } } });
    await prisma.treinoLivre.deleteMany({ where: { atletaId: { in: atletas } } });
    await prisma.treinoAgendado.deleteMany({ where: { atletaId: { in: atletas } } });
  }
  if (usuarios.length) {
    await prisma.assinatura.deleteMany({ where: { usuarioId: { in: usuarios } } });
  }
  if (atletas.length) {
    await prisma.atleta.deleteMany({ where: { id: { in: atletas } } });
  }
  if (usuarios.length) {
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  }
  console.log("LIMPEZA_QA: usuários, assinaturas, treinos e histórico desta execução removidos.");
}

let falhou = false;
try { await executar(); }
catch (err) { falhou = true; console.error("TESTE_QA_FALHOU:", err); }
finally {
  try { await limpar(); }
  catch (err) { falhou = true; console.error(`LIMPEZA_QA_FALHOU: investigar prefixo ${tag}:`, err); }
  await prisma.$disconnect();
}
if (falhou) process.exitCode = 1;