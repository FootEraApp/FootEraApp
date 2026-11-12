/** Teste isolado de reservas vencidas. SOMENTE no banco local footera_billing_qa. */
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env.development'), override: false, quiet: true });
const dbUrl = process.env.DATABASE_URL || '';
const db = new URL(dbUrl || 'http://invalid');
const api = process.env.FOOTERA_QA_API || 'http://127.0.0.1:3001';
if (!['localhost','127.0.0.1'].includes(db.hostname) || db.port !== '5433' || db.pathname !== '/footera_billing_qa') throw new Error('SEGURANÇA: banco deve ser localhost:5433/footera_billing_qa');
if (!['http://127.0.0.1:3001', 'http://localhost:3001'].includes(api)) throw new Error('SEGURANÇA: API deve ser local');
if (process.env.MP_ACCESS_TOKEN) throw new Error('SEGURANÇA: MP_ACCESS_TOKEN precisa estar vazio');
if (!process.env.JWT_SECRET || !process.env.BILLING_WEBHOOK_SECRET || process.env.BILLING_CUPOM_RESERVA_QA !== 'true') throw new Error('Defina JWT_SECRET, BILLING_WEBHOOK_SECRET e BILLING_CUPOM_RESERVA_QA=true');
const prisma = new PrismaClient();
const run = `qa-reserva-vencida-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
let total = 0, passed = 0;
const check = (c: unknown, title: string, detail = '') => { total++; if (c) passed++; console.log(`${c ? '✔' : '✖'} ${title}${detail ? ` — ${detail}` : ''}`); };
async function post(endpoint: string, body: any, headers: Record<string,string> = {}) {
  const r = await fetch(`${api}/api/billing/${endpoint}`, { method: 'POST', headers: { 'content-type':'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  return { status:r.status, body:await r.json().catch(() => ({})) as any };
}
async function main() {
  // Importar após conferir segurança e carregar ambiente. Não inicializa listener HTTP.
  const { revisarReservasCupomVencidasQa } = await import('./server/controllers/billingController.js');
  if (typeof revisarReservasCupomVencidasQa !== 'function') throw new Error('Exporte revisarReservasCupomVencidasQa no billingController.ts');
  const buyer = await prisma.usuario.findFirst({ where: { nomeDeUsuario: { startsWith: 'qa_rec_atleta_' }, verified: true, deletedAt: null, atleta: { isNot: null } }, orderBy: { dataCriacao:'desc' } });
  if (!buyer) throw new Error('Comprador Atleta QA não encontrado');
  const auth = { authorization: `Bearer ${jwt.sign({ id:buyer.id, tokenVersion:buyer.tokenVersion }, process.env.JWT_SECRET!, { expiresIn:'15m' })}` };
  const owner = await prisma.usuario.create({ data: { nomeDeUsuario:`${run}_owner`, senhaHash:'QA_NO_LOGIN', nome:'Creator QA Reserva Vencida', email:`${run}@qa.invalid`, tipo:'Creator' } });
  await prisma.creator.create({ data: { usuarioId:owner.id, tipo:'PESSOA_FISICA', ativo:true, comissaoFootera:'0.1500' } });
  async function setup(suffix:string) {
    const course = await prisma.metodologiaAvulsa.create({ data: { titulo:`QA reserva vencida ${suffix} ${run}`, criadorUsuarioId:owner.id, tipo:'CURSO_FORMACAO', estruturaTipo:'MODULO', ativo:true, precoAssinaturaMensal:'20.00' } });
    const cupom = await prisma.cupom.create({ data: { codigo:`${run}-${suffix}`, tipo:'PERCENTUAL', descontoPerc:10, ativo:true, usosMax:1, usosAtuais:0 } });
    const r = await post('checkout', { planoId:`METODOLOGIA_AVULSA:${course.id}`, periodicidade:'Mensal', metodo:'PIX', cupom:cupom.codigo, pagador:{ nome:'QA Reserva Vencida', email:`${run}@qa.invalid` } }, auth);
    if (r.status !== 200 || !r.body?.pagamento?.id) throw new Error(`Checkout ${suffix} falhou: HTTP ${r.status} ${JSON.stringify(r.body)}`);
    const id = r.body.pagamento.id as string;
    const payment = await prisma.pagamento.findUniqueOrThrow({where:{id}});
    if (payment.provider !== 'INTERNAL_FAKE') throw new Error('SEGURANÇA: provedor do pagamento não é INTERNAL_FAKE');
    const reserva = await prisma.cupomReserva.findUnique({where:{pagamentoId:id}});
    if (!reserva || reserva.status !== 'RESERVADA') throw new Error(`Reserva inicial ${suffix} não encontrada`);
    await prisma.cupomReserva.update({where:{id:reserva.id},data:{expiraEm:new Date(Date.now() - 60000)}});
    return { id, cupom, course };
  }
  const aprovar = await setup('aprovar');
  const cancelar = await setup('cancelar');
  await revisarReservasCupomVencidasQa();
  for (const [name, payment] of [['aprovar',aprovar],['cancelar',cancelar]] as const) {
    const reserva = await prisma.cupomReserva.findUniqueOrThrow({where:{pagamentoId:payment.id}});
    const cupom = await prisma.cupom.findUniqueOrThrow({where:{id:payment.cupom.id}});
    check(reserva.status === 'CONCILIACAO_PENDENTE', `Reserva ${name} entrou em conciliação`, `status=${reserva.status}`);
    check(cupom.usosAtuais === 0, `Cupom ${name} não foi consumido durante revisão`);
  }
  // Ainda ocupa capacidade: tentativa subsequente deve ser recusada.
  const blocked = await post('checkout', { planoId:`METODOLOGIA_AVULSA:${aprovar.course.id}`, periodicidade:'Mensal', metodo:'PIX', cupom:aprovar.cupom.codigo, pagador:{ nome:'QA Reserva Vencida', email:`${run}@qa.invalid` } }, auth);
  check(blocked.status === 409, 'Reserva em conciliação continua bloqueando novo checkout', `HTTP ${blocked.status}`);
  async function event(suffix:string, tipo:'payment_approved'|'payment_canceled', pagamentoId:string) {
    return post('webhook/provider', { provider:'INTERNAL_FAKE', providerEventId:`${run}:${suffix}`, tipo, data:{pagamentoId} }, { 'x-webhook-secret':process.env.BILLING_WEBHOOK_SECRET! });
  }
  const approved = await event('aprovacao', 'payment_approved', aprovar.id);
  const ra = await prisma.cupomReserva.findUniqueOrThrow({where:{pagamentoId:aprovar.id}});
  const pa = await prisma.pagamento.findUniqueOrThrow({where:{id:aprovar.id}});
  const ca = await prisma.cupom.findUniqueOrThrow({where:{id:aprovar.cupom.id}});
  check(approved.status === 200 && pa.status === 'APROVADO' && ra.status === 'CONSUMIDA' && ca.usosAtuais === 1, 'Aprovação consome reserva em conciliação', `HTTP ${approved.status}, reserva=${ra.status}`);
  const canceled = await event('cancelamento', 'payment_canceled', cancelar.id);
  const rc = await prisma.cupomReserva.findUniqueOrThrow({where:{pagamentoId:cancelar.id}});
  const pc = await prisma.pagamento.findUniqueOrThrow({where:{id:cancelar.id}});
  const cc = await prisma.cupom.findUniqueOrThrow({where:{id:cancelar.cupom.id}});
  check(canceled.status === 200 && pc.status === 'CANCELADO' && rc.status === 'LIBERADA' && cc.usosAtuais === 0, 'Cancelamento libera reserva em conciliação', `HTTP ${canceled.status}, reserva=${rc.status}`);
  const canceledAgain = await event('cancelamento', 'payment_canceled', cancelar.id);
  check(canceledAgain.status === 200 && (await prisma.cupomReserva.findUniqueOrThrow({where:{pagamentoId:cancelar.id}})).status === 'LIBERADA', 'Cancelamento repetido mantém reserva liberada');
  console.log(`\nRESULTADO: ${passed}/${total} verificações aprovadas. Banco: footera_billing_qa.`);
  if (passed !== total) process.exitCode = 1;
}
main().catch((err) => {console.error('\nTESTE INTERROMPIDO:', err.message);process.exitCode=1;}).finally(async () => prisma.$disconnect());
