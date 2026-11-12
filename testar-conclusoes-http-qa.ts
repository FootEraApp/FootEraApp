/**
 * QA HTTP do bloqueio de conclusões AGENDADAS e SUBMISSÃO individual em 3/3.
 * NÃO cobre turmas, responsáveis, metodologia ou assinaturas Learning.
 * Executar apenas com token de conta Atleta QA sem assinaturas, em banco isolado.
 * Cria 3 marcadores de cota, 1 TreinoProgramado e 3 TreinoAgendado temporários.
 * Todas as mutações de teste são rastreadas e removidas em finally.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './server/prisma.js';
import { janelaDiaTreino } from './server/services/limiteDiarioTreinos.service.js';

const db = (() => { try { return new URL(process.env.DATABASE_URL ?? ''); } catch { return null; } })();
if (!db || process.env.NODE_ENV !== 'test' || !['localhost','127.0.0.1'].includes(db.hostname) || db.port !== '5433' || db.pathname !== '/footera_billing_qa') {
  throw new Error('BANCO_QA_INCORRETO: use NODE_ENV=test e DATABASE_URL=postgresql://...@127.0.0.1:5433/footera_billing_qa');
}
const base = (process.env.QA_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const api = new URL(base);
if (api.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(api.hostname)) throw new Error('API_QA_INCORRETA: API deve ser HTTP local');
const token = (process.env.QA_HTTP_TOKEN || '').trim().replace(/^Bearer\s+/i, '');
if (!token) throw new Error('TOKEN_QA_AUSENTE: informe JWT válido de Atleta QA; não compartilhe JWT');
const prefixo = `QA_CONCLUSOES_${randomUUID().replaceAll('-', '')}`;
const marcadorIds: string[] = [];
const agendamentoIds: string[] = [];
let treinoId: string | undefined;
let atletaId: string | undefined;
let aprovado = 0;
function ok(cond: unknown, descricao: string) {
  if (!cond) throw new Error(`FALHOU: ${descricao}`);
  console.log(`APROVADO ${String(++aprovado).padStart(2,'0')} — ${descricao}`);
}
async function req(path: string, method = 'GET', body?: Record<string, unknown>) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type':'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 350) }; }
  return { status: r.status, json };
}
async function limite() {
  const r = await req('/api/treinos/limite-diario');
  if (r.status !== 200) throw new Error(`Limite HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  return r.json;
}
async function estadoAgendamento(id: string) {
  const [ag, sub, ledger, usuario] = await Promise.all([
    prisma.treinoAgendado.findUnique({ where: { id }, select: { status:true, execucaoStatus:true, finishedAt:true } }),
    prisma.submissaoTreino.count({ where: { treinoAgendadoId: id } }),
    prisma.treinoRealizacaoDiaria.count({ where: { atletaId: atletaId!, origem:'AGENDADO', origemId: id } }),
    prisma.treinoUsuario.count({ where: { treinoId: id, status: 'COMPLETED' } }),
  ]);
  return { ag, sub, ledger, usuario };
}
async function executar() {
  console.log('QA HTTP: conclusão de agendados + submissão individual com limite 3/3');
  const inicial = await limite();
  atletaId = String(inicial.atletaId ?? '');
  ok(!!atletaId && inicial.exempt === false && inicial.used === 0 && inicial.remaining === 3,
    'Conta QA gratuita começa em 0/3');
  const atleta = await prisma.atleta.findUnique({ where: { id: atletaId }, select: { id:true, usuarioId:true } });
  ok(!!atleta, 'Identidade HTTP corresponde a atleta do banco QA');
  const dia = janelaDiaTreino(new Date()).dia;
  // Criar um marcador e comparar API: não seguimos se a API usar outro banco.
  for (let i = 0; i < 3; i++) {
    const origemId = `${prefixo}_MARCADOR_${i}`;
    await prisma.treinoRealizacaoDiaria.create({ data: { atletaId, origem: 'LIVRE', origemId, diaReferencia: dia, realizadoEm: new Date() } });
    marcadorIds.push(origemId);
    const l = await limite();
    ok(l.atletaId === atletaId && l.used === i+1 && l.remaining === 2-i,
      `API e banco sincronizados em ${i+1}/3`);
  }

  const treino = await prisma.treinoProgramado.create({
    data: { nome: prefixo, nivel:'Base', categoria:[], dicas:[], pontuacao:13, duracao:20 },
  });
  treinoId = treino.id;
  const agora = new Date();
  for (let i = 0; i < 3; i++) {
    const ag = await prisma.treinoAgendado.create({
      data: {
        atletaId, treinoProgramadoId: treinoId,
        titulo: `${prefixo}_${i}`,
        dataTreino: new Date(agora.getTime() + i * 60000),
        status:'AGENDADO',
        ...(i === 1 ? { startedAt: new Date(agora.getTime() - 60000) } : {}),
      },
    });
    agendamentoIds.push(ag.id);
  }
  ok(agendamentoIds.length === 3, 'Agendamentos fictícios criados');

  const testes = [
    { nome:'POST concluirTreino', id: agendamentoIds[0], path:`/api/treinos/agendados/${agendamentoIds[0]}/complete`, body: { duracaoMinutos: 15 } },
    { nome:'POST finalizarTreinoAgendado', id: agendamentoIds[1], path:`/api/treinos/${agendamentoIds[1]}/finish`, body: {} },
    { nome:'POST submissão individual', id: agendamentoIds[2], path:'/api/submissoes/treino', body: { treinoAgendadoId: agendamentoIds[2], duracaoMinutos: 15 } },
  ];
  const pontosAntes = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId }, select: { pontuacaoTotal:true, pontuacaoPerformance:true } });
  const estatAntes = await prisma.estatisticaAtleta.findUnique({ where: { atletaId }, select: { totalTreinos:true, totalPontos:true } });
  for (const t of testes) {
    const antes = await estadoAgendamento(t.id);
    const r = await req(t.path, 'POST', t.body);
    ok(r.status === 403 && r.json?.code === 'DAILY_TRAINING_LIMIT_REACHED',
      `${t.nome}: 403 + DAILY_TRAINING_LIMIT_REACHED (recebido ${r.status}: ${JSON.stringify(r.json).slice(0, 350)})`);
    const depois = await estadoAgendamento(t.id);
    ok(JSON.stringify(depois) === JSON.stringify(antes), `${t.nome}: sem alteração de agendamento, submissão, histórico ou TreinoUsuario`);
    const l = await limite();
    ok(l.used === 3 && l.remaining === 0, `${t.nome}: contador permaneceu 3/3`);
  }
  const pontosDepois = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId }, select: { pontuacaoTotal:true, pontuacaoPerformance:true } });
  const estatDepois = await prisma.estatisticaAtleta.findUnique({ where: { atletaId }, select: { totalTreinos:true, totalPontos:true } });
  ok(JSON.stringify(pontosDepois) === JSON.stringify(pontosAntes) && JSON.stringify(estatDepois) === JSON.stringify(estatAntes),
    'Tentativas recusadas não alteraram pontos e estatísticas do atleta');
  console.log(`\nRESULTADO: ${aprovado}/${aprovado} verificações aprovadas.`);
}
async function limpar() {
  if (agendamentoIds.length) {
    // Se alguma rota gravar apesar do bloqueio, não apague silenciosamente a evidência.
    const extras = await prisma.submissaoTreino.count({ where: { treinoAgendadoId: { in: agendamentoIds } } });
    const ledger = await prisma.treinoRealizacaoDiaria.count({ where: { atletaId, origem:'AGENDADO', origemId: { in: agendamentoIds } } });
    if (extras || ledger) {
      throw new Error(`LIMPEZA_INTERROMPIDA: há ${extras} submissões e ${ledger} realizações inesperadas; IDs: ${agendamentoIds.join(', ')}`);
    }
    await prisma.treinoUsuario.deleteMany({ where: { treinoId: { in: agendamentoIds } } });
    await prisma.treinoAgendado.deleteMany({ where: { id: { in: agendamentoIds } } });
  }
  if (treinoId) {
    await prisma.estatisticaTreino.deleteMany({ where: { treinoId } });
    await prisma.treinoProgramado.delete({ where: { id: treinoId } });
  }
  if (atletaId && marcadorIds.length) {
    await prisma.treinoRealizacaoDiaria.deleteMany({ where: { atletaId, origem:'LIVRE', origemId: { in: marcadorIds } } });
  }
  console.log('LIMPEZA_QA: registros temporários removidos.');
}
let falhou = false;
try { await executar(); } catch (e) { falhou = true; console.error('TESTE_FALHOU:', e); }
finally {
  try { await limpar(); } catch (e) { falhou = true; console.error('LIMPEZA_QA_FALHOU:', e); }
  await prisma.$disconnect();
}
if (falhou) process.exitCode = 1;