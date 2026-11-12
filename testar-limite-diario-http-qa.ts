/**
 * QA HTTP — cota diária: leitura 0/3,1/3,2/3,3/3 + tentativa de 4º treino livre.
 * Executar em C:\dev\FootEraApp-app com NODE_ENV=test, DATABASE_URL de QA,
 * QA_HTTP_TOKEN (Bearer de atleta de TESTE), QA_API_BASE_URL (ex.: http://127.0.0.1:3001).
 * IMPORTANTE: o servidor Express deve estar iniciado usando O MESMO BANCO QA.
 * Só insere 3 realizações artificiais identificadas pela execução; remove-as em finally.
 * Não modifica assinaturas, treinos originais, submissões ou pontuações.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './server/prisma.js';
import { janelaDiaTreino } from './server/services/limiteDiarioTreinos.service.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
let db: URL;
try { db = new URL(databaseUrl); } catch { throw new Error('BANCO_QA_INCORRETO: DATABASE_URL inválida'); }
if (
  process.env.NODE_ENV !== 'test' ||
  !['127.0.0.1', 'localhost'].includes(db.hostname) ||
  db.port !== '5433' ||
  db.pathname !== '/footera_billing_qa'
) throw new Error('BANCO_QA_INCORRETO: exigido NODE_ENV=test e 127.0.0.1:5433/footera_billing_qa');

const token = (process.env.QA_HTTP_TOKEN ?? '').trim().replace(/^Bearer\s+/i, '');
if (!token) throw new Error('TOKEN_QA_AUSENTE: defina QA_HTTP_TOKEN de um atleta de TESTE autenticado no servidor QA. NÃO compartilhe o token.');
const base = (process.env.QA_API_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const url = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
  throw new Error('API_QA_INCORRETA: servidor HTTP deve ser local (127.0.0.1/localhost)');
}
const prefixo = 'QA_HTTP_3_TREINOS_' + randomUUID().replaceAll('-', '');
const criados: string[] = [];
let atletaId = '';
let etapas = 0;
const afirmar = (condicao: unknown, rotulo: string) => {
  if (!condicao) throw new Error('FALHOU: ' + rotulo);
  etapas++;
  console.log(`APROVADO ${String(etapas).padStart(2, '0')} — ${rotulo}`);
};

async function request(path: string, method = 'GET', data?: Record<string, unknown>) {
  const resposta = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const raw = await resposta.text();
  let json: any;
  try { json = JSON.parse(raw); } catch { json = { raw: raw.slice(0, 600) }; }
  return { status: resposta.status, json };
}

async function estado() {
  const resposta = await request('/api/treinos/limite-diario');
  if (resposta.status !== 200) {
    throw new Error(`GET /api/treinos/limite-diario HTTP ${resposta.status}: ${JSON.stringify(resposta.json)}. Confira montagem de rotas, token e contexto ativo Atleta.`);
  }
  return resposta.json;
}

async function criarMarcador(n: number) {
  const origemId = `${prefixo}_${n}`;
  await prisma.treinoRealizacaoDiaria.create({
    data: {
      atletaId,
      origem: 'LIVRE',
      origemId,
      diaReferencia: janelaDiaTreino(new Date()).dia,
      realizadoEm: new Date(),
    },
  });
  criados.push(origemId);
}

async function executar() {
  console.log('QA HTTP: verificando servidor local e banco footera_billing_qa');
  const inicial = await estado();
  atletaId = String(inicial.atletaId ?? '');
  afirmar(Boolean(atletaId) && inicial.exempt === false && inicial.used === 0 && inicial.remaining === 3,
    'Conta de teste gratuita em 0/3, com atletaId identificado');

  const atleta = await prisma.atleta.findUnique({ where: { id: atletaId }, select: { id: true, usuarioId: true } });
  afirmar(Boolean(atleta), 'Atleta HTTP existe no banco QA (mesma identidade)');

  // Marcador 1 serve como desafio de correspondência: se o servidor estiver
  // apontado a outro banco, sua resposta NÃO passará a 1/3; paramos aqui.
  for (let n = 1; n <= 3; n++) {
    await criarMarcador(n);
    const atual = await estado();
    afirmar(atual.atletaId === atletaId && atual.used === n && atual.remaining === 3 - n,
      `Servidor HTTP lê a mesma base QA: ${n}/3`);
  }

  const antes = await prisma.treinoLivre.count({ where: { atletaId } });
  const resposta = await request('/api/treinos-livres', 'POST', {
    data: new Date().toISOString(),
    duracaoMin: 20,
    tipoAtividade: 'TESTE_QA_HTTP_BLOQUEADO',
    descricao: prefixo,
  });
  afirmar(resposta.status === 403 && resposta.json?.code === 'DAILY_TRAINING_LIMIT_REACHED',
    `Quarto treino livre via HTTP retorna 403 + DAILY_TRAINING_LIMIT_REACHED (recebido ${resposta.status}: ${JSON.stringify(resposta.json)})`);

  const depois = await prisma.treinoLivre.count({ where: { atletaId } });
  afirmar(depois === antes, 'POST bloqueado não criou TreinoLivre');
  const final = await estado();
  afirmar(final.used === 3 && final.remaining === 0, 'Contador permaneceu em 3/3 após POST bloqueado');
  console.log(`\nRESULTADO: ${etapas}/${etapas} verificações HTTP aprovadas.`);
}

let erro = false;
try { await executar(); }
catch (e) { erro = true; console.error('TESTE_HTTP_FALHOU:', e); }
finally {
  try {
    if (atletaId && criados.length) {
      const removidos = await prisma.treinoRealizacaoDiaria.deleteMany({
        where: { atletaId, origem: 'LIVRE', origemId: { in: criados } },
      });
      if (removidos.count !== criados.length) {
        erro = true;
        console.error('LIMPEZA_QA_INCOMPLETA: confira IDs com prefixo', prefixo);
      } else {
        console.log(`LIMPEZA_QA: ${removidos.count} marcadores temporários removidos.`);
      }
    }
  } catch (e) { erro = true; console.error('LIMPEZA_QA_FALHOU:', e, 'prefixo', prefixo); }
  await prisma.$disconnect();
}
if (erro) process.exitCode = 1;