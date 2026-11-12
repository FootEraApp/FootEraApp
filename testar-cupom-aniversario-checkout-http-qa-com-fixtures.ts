/**
 * FootEra — checkout HTTP QA do cupom 20PARABENS.
 * Usa router real /api/billing, middleware real de JWT e pagamentos INTERNAL_FAKE.
 * Não chama MP, não confirma pagamentos, não provisiona benefícios e não testa webhook.
 * Cria e exclui SOMENTE suas próprias contas, cupom, evento e pagamentos.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

function validarQa() {
  const u = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.NODE_ENV, 'test', 'NODE_ENV_DEVE_SER_TEST');
  assert.ok(['postgresql:', 'postgres:'].includes(u.protocol));
  assert.ok(['127.0.0.1', 'localhost'].includes(u.hostname));
  assert.equal(u.port, '5433');
  assert.equal(u.pathname, '/footera_billing_qa');
  assert.equal(process.env.MP_ACCESS_TOKEN ?? '', '', 'MP_ACCESS_TOKEN_DEVE_ESTAR_VAZIO');
  assert.equal(process.env.BILLING_CUPOM_RESERVA_QA, 'true');
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, 'false');
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, 'false');
}
validarQa();

// Configurar ANTES dos imports dinâmicos dos módulos do servidor.
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.BILLING_SHOW_LEARNING_PLANS = 'true';
process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS = 'true';
process.env.BILLING_SHOW_METODOLOGIAS_LEARNING = 'true';

const prefixo = `qa_birthday_http_${randomUUID().replaceAll('-', '')}`;
const usuarios: string[] = [];
const eventos: string[] = [];
const aulasCriadas: string[] = [];
const metodologiasCriadas: string[] = [];
const pagamentos: string[] = [];
let verificacoes = 0;
let servidor: ReturnType<import('express').Express['listen']> | null = null;

function ok(condicao: unknown, descricao: string) {
  assert.ok(condicao, `FALHOU: ${descricao}`);
  console.log(`APROVADO ${String(++verificacoes).padStart(2, '0')} — ${descricao}`);
}
function br(d: Date) {
  const ps = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const n = (t: string) => Number(ps.find(p => p.type === t)?.value);
  return { ano: n('year'), mes: n('month'), dia: n('day') };
}
const hoje = br(new Date());
const nascimento = (diferencaDia = 0) =>
  new Date(Date.UTC(2000, hoje.mes - 1, hoje.dia + diferencaDia));

async function main() {
  const { prisma } = await import('./server/prisma.js');
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const rotas = (await import('./server/routes/billing.js')).default;
  const db = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
  assert.equal(db[0]?.nome, 'footera_billing_qa');

  async function usuario(sufixo: string, aniversariante: boolean) {
    const u = await prisma.usuario.create({
      data: {
        nome: `QA Cupom HTTP ${sufixo}`,
        nomeDeUsuario: `${prefixo}_${sufixo}`.slice(0, 64),
        email: `${prefixo}_${sufixo}@example.invalid`,
        senhaHash: `NAO_USAR_${prefixo}`,
        tipo: 'Atleta', verified: true,
        dataNascimento: nascimento(aniversariante ? 0 : 1),
        aniversarioElegivelApartirDe: new Date(Date.now() - 45 * 86400000),
      },
    });
    usuarios.push(u.id);
    await prisma.usuarioPapel.create({
      data: { usuarioId: u.id, papel: 'Atleta', status: 'ATIVO' },
    });
    await prisma.atleta.create({
      data: { usuarioId: u.id, idade: 26, categoria: [], dataNascimento: u.dataNascimento },
    });
    return {
      id: u.id,
      token: jwt.sign({ id: u.id, tokenVersion: u.tokenVersion ?? 0 }, process.env.JWT_SECRET!, {
        algorithm: 'HS256', expiresIn: '10m',
      }),
    };
  }

  async function chamar(base: string, token: string | null, caminho: string, body?: unknown) {
    const r = await fetch(`${base}/api/billing${caminho}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const t = await r.text();
    let data: any;
    try { data = JSON.parse(t); } catch { data = { raw: t.slice(0, 500) }; }
    return { status: r.status, data };
  }
  const checarValores = (res: { status: number; data: any }, descricao: string) => {
    assert.equal(res.status, 200, `${descricao}: ${JSON.stringify(res.data)}`);
    const v = res.data;
    assert.ok(Number(v.base) > 0, `${descricao}: base inválida`);
    const baseC = Math.round(Number(v.base) * 100);
    const descontoC = Math.round(Number(v.desconto) * 100);
    const totalC = Math.round(Number(v.total) * 100);
    assert.equal(descontoC, Math.round(baseC * 0.2), `${descricao}: desconto != 20%`);
    assert.equal(totalC, baseC - descontoC, `${descricao}: total incorreto`);
    assert.equal(v.cupom?.codigo, '20PARABENS');
    ok(true, `${descricao}: valor base/desconto/total corretos`);
    return totalC;
  };
  const checarPagamento = async (id: string, userId: string, valorCentavos: number) => {
    const p = await prisma.pagamento.findUniqueOrThrow({ where: { id } });
    assert.equal(p.usuarioId, userId);
    assert.equal(p.status, 'PENDENTE');
    assert.equal(p.provider, 'INTERNAL_FAKE');
    assert.equal(p.valor.mul(100).toNumber(), valorCentavos);
    assert.ok(p.cupomId);
    const reserva = await prisma.cupomReserva.findUniqueOrThrow({ where: { pagamentoId: id } });
    assert.equal(reserva.usuarioId, userId);
    assert.equal(reserva.cupomId, p.cupomId);
    assert.equal(reserva.status, 'RESERVADA');
    const meta = p.meta as any;
    assert.equal(meta?.financeiroV1?.totalCentavos, valorCentavos);
    ok(true, 'Pagamento simulado, snapshot financeiro e reserva persistidos corretamente');
  };

  try {
    const a = await usuario('individual', true);
    const b = await usuario('bundle', true);
    const c = await usuario('evento', true);
    const naoAniversariante = await usuario('outro', false);
    const app = express();
    app.use(express.json());
    app.use('/api/billing', rotas);
    servidor = app.listen(0, '127.0.0.1');
    const ativo = servidor;
    await new Promise<void>((resolve, reject) => {
      if (ativo.listening) return resolve();
      ativo.once('listening', resolve);
      ativo.once('error', reject);
    });
    const base = `http://127.0.0.1:${(ativo.address() as AddressInfo).port}`;
    const pagador = (n: string) => ({ nome: `QA ${n}`, email: `${prefixo}@example.invalid` });

    const semToken = await chamar(base, null, '/aniversario');
    ok(semToken.status === 401, 'Endpoint de aniversário exige autenticação real');
    const presente = await chamar(base, a.token, '/aniversario');
    ok(presente.status === 200 && presente.data.elegivel === true && presente.data.disponivel === true, 'Endpoint mostra benefício ao aniversariante elegível');
    const ausente = await chamar(base, naoAniversariante.token, '/aniversario');
    ok(ausente.status === 200 && ausente.data.elegivel === false, 'Não aniversariante não recebe benefício');

    const item = { planoId: 'ATLETA_PRO', periodicidade: 'Mensal' };
    const previa = await chamar(base, a.token, '/coupon/apply', { ...item, codigo: '20PARABENS' });
    const totalIndividual = checarValores(previa, 'Prévia HTTP da assinatura');
    const interno = await chamar(base, a.token, '/coupon/apply', {
      ...item, codigo: `ANIVERSARIO_${hoje.ano}_${a.id}`,
    });
    ok(interno.status === 403, 'Código interno de aniversário é proibido pela rota HTTP');
    const terceiroInterno = await chamar(base, b.token, '/coupon/apply', {
      ...item, codigo: `ANIVERSARIO_${hoje.ano}_${a.id}`,
    });
    ok(terceiroInterno.status === 403, 'Outro aniversariante também não pode utilizar código interno alheio');
    const fora = await chamar(base, naoAniversariante.token, '/coupon/apply', { ...item, codigo: '20PARABENS' });
    ok(fora.status >= 400 && fora.status < 500, 'Cupom recusado a quem não faz aniversário');

    const checkout = await chamar(base, a.token, '/checkout', {
      ...item, metodo: 'PIX', cupom: '20PARABENS', pagador: pagador('Individual'),
      chaveCliente: randomUUID(),
    });
    assert.equal(checkout.status, 200, `Checkout individual: ${JSON.stringify(checkout.data)}`);
    assert.equal(checkout.data.status, 'PENDENTE');
    assert.ok(checkout.data.pagamento?.id);
    pagamentos.push(checkout.data.pagamento.id);
    ok(true, 'Checkout individual HTTP cria PIX simulado pendente');
    await checarPagamento(checkout.data.pagamento.id, a.id, totalIndividual);
    const duplo = await chamar(base, a.token, '/checkout', {
      ...item, metodo: 'PIX', cupom: '20PARABENS', pagador: pagador('Individual'),
      chaveCliente: randomUUID(),
    });
    ok(duplo.status >= 400 && duplo.status < 500, 'Segundo checkout HTTP com cupom reservado é rejeitado');
    ok((await prisma.pagamento.count({ where: { usuarioId: a.id } })) === 1, 'Segunda tentativa não gera outro pagamento');
    const bannerDepois = await chamar(base, a.token, '/aniversario');
    ok(bannerDepois.status === 200 && bannerDepois.data.disponivel === false, 'Banner fica indisponível depois da reserva');

    const itens = [
      { planoId: 'ATLETA_PRO', periodicidade: 'Mensal' },
      { planoId: 'ATLETA_LEARNING_1', periodicidade: 'Mensal' },
    ];
    const previaBundle = await chamar(base, b.token, '/coupon/apply', { items: itens, codigo: '20PARABENS' });
    const totalBundle = checarValores(previaBundle, 'Prévia HTTP do pacote permitido');
    const bundle = await chamar(base, b.token, '/checkout-bundle', {
      items: itens, metodo: 'PIX', cupom: '20PARABENS', pagador: pagador('Pacote'),
      chaveCliente: randomUUID(),
    });
    assert.equal(bundle.status, 200, `Checkout pacote: ${JSON.stringify(bundle.data)}`);
    assert.ok(bundle.data.pagamento?.id);
    pagamentos.push(bundle.data.pagamento.id);
    ok(true, 'Checkout HTTP de pacote cria pagamento pendente');
    await checarPagamento(bundle.data.pagamento.id, b.id, totalBundle);
    const metaBundle = (await prisma.pagamento.findUniqueOrThrow({ where: { id: bundle.data.pagamento.id } })).meta as any;
    assert.equal(metaBundle?.financeiroV1?.items?.length, 2);
    assert.equal(metaBundle.financeiroV1.items.reduce((s: number, i: any) => s + i.valorFinalCentavos, 0), totalBundle);
    ok(true, 'Rateio dos itens do pacote bate com total cobrado');

    // Evento QA próprio, sem modificar eventos existentes.
    const eventoId = randomUUID();
    await prisma.evento.create({
      data: {
        id: eventoId, titulo: `QA Aniversario ${prefixo}`, descricao: 'Fixture temporária',
        status: 'ABERTO', dataEvento: new Date(Date.now() + 10 * 86400000),
        inscricaoInicio: new Date(Date.now() - 86400000),
        inscricaoFim: new Date(Date.now() + 9 * 86400000),
        vagas: 2, valorInscricao: '50.00', requisitos: [], linkInscricao: null,
      },
    });
    eventos.push(eventoId);
    const eventoItem = { planoId: `EVENTO:${eventoId}`, periodicidade: 'Mensal' };
    const prevEvento = await chamar(base, c.token, '/coupon/apply', { ...eventoItem, codigo: '20PARABENS' });
    const totalEvento = checarValores(prevEvento, 'Prévia HTTP do evento individual');
    const eventoCheckout = await chamar(base, c.token, '/checkout', {
      ...eventoItem, metodo: 'PIX', cupom: '20PARABENS', pagador: pagador('Evento'),
      chaveCliente: randomUUID(),
    });
    assert.equal(eventoCheckout.status, 200, `Checkout evento: ${JSON.stringify(eventoCheckout.data)}`);
    pagamentos.push(eventoCheckout.data.pagamento.id);
    await checarPagamento(eventoCheckout.data.pagamento.id, c.id, totalEvento);
    ok(true, 'Evento individual aplica 20% e cria pagamento/reserva reais (simulados)');
    const eventoBundle = await chamar(base, c.token, '/coupon/apply', {
      items: [eventoItem, item], codigo: '20PARABENS',
    });
    ok(eventoBundle.status === 400 && eventoBundle.data.code === 'EVENT_BUNDLE_NOT_ALLOWED', 'Evento misturado em pacote continua bloqueado');

    // Fixtures exclusivas do QA. Nao dependem de aulas ou metodologias reais.
    const aulaId = randomUUID();
    await prisma.aulaAoVivo.create({
      data: {
        id: aulaId,
        titulo: `QA Aula de aniversario ${prefixo}`,
        descricao: 'Fixture temporaria: nao e uma aula publicada',
        status: 'AGENDADA',
        dataInicio: new Date(Date.now() + 7 * 86400000),
        dataFim: new Date(Date.now() + 7 * 86400000 + 3600000),
        acessoPago: true,
        precoAcesso: '75.00',
        inscricaoInicio: new Date(Date.now() - 86400000),
        inscricaoFim: new Date(Date.now() + 6 * 86400000),
      },
    });
    aulasCriadas.push(aulaId);
    console.log(`FIXTURE_QA_AULA_ID=${aulaId}`);

    const metodologiaId = randomUUID();
    await prisma.metodologiaAvulsa.create({
      data: {
        id: metodologiaId,
        titulo: `QA Metodologia de aniversario ${prefixo}`,
        descricao: 'Fixture temporaria: nao e conteudo publicado',
        ativo: true,
        tipo: 'TRILHAS_TREINO',
        estruturaTipo: 'TRILHA',
        precoAssinaturaMensal: '50.00',
        publicoAlvo: 'AMBOS',
      },
    });
    metodologiasCriadas.push(metodologiaId);
    console.log(`FIXTURE_QA_METODOLOGIA_ID=${metodologiaId}`);

    for (const caso of [
      { titulo: 'AULA_AO_VIVO', planoId: `AULA_AO_VIVO:${aulaId}`, sufixo: 'aula' },
      { titulo: 'METODOLOGIA_AVULSA', planoId: `METODOLOGIA_AVULSA:${metodologiaId}`, sufixo: 'metodologia' },
    ]) {
      const comprador = await usuario(`${caso.sufixo}_${randomUUID().slice(0, 4)}`, true);
      const itemConteudo = { planoId: caso.planoId, periodicidade: 'Mensal' };
      const previaConteudo = await chamar(base, comprador.token, '/coupon/apply', {
        ...itemConteudo,
        codigo: '20PARABENS',
      });
      const totalConteudo = checarValores(previaConteudo, `Previa HTTP ${caso.titulo}`);
      const compraConteudo = await chamar(base, comprador.token, '/checkout', {
        ...itemConteudo,
        metodo: 'PIX',
        cupom: '20PARABENS',
        pagador: pagador(caso.sufixo),
        chaveCliente: randomUUID(),
      });
      assert.equal(compraConteudo.status, 200,
        `Checkout HTTP ${caso.titulo}: ${JSON.stringify(compraConteudo.data)}`);
      assert.equal(compraConteudo.data.status, 'PENDENTE');
      assert.ok(compraConteudo.data.pagamento?.id);
      pagamentos.push(compraConteudo.data.pagamento.id);
      ok(true, `Checkout HTTP ${caso.titulo} criou pagamento PIX fake`);
      await checarPagamento(compraConteudo.data.pagamento.id, comprador.id, totalConteudo);
      ok(true, `${caso.titulo}: desconto de 20% confirmado no valor gravado`);
    }

    console.log(`\nRESULTADO: ${verificacoes} verificações aprovadas.`);
    console.log('NAO COBERTO: cobrança real MP; idempotência com provedor real; webhook; aprovação; PIX pago após meia-noite; cancelamento; documentos.');
  } finally {
    if (servidor) await new Promise<void>(resolve => servidor!.close(() => resolve()));
    // Limpeza por IDs das fixtures; NUNCA por padrões amplos sobre dados reais.
    try {
      if (usuarios.length) {
        await prisma.cupomReserva.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.billingCheckoutOperacao.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.cupomResgate.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.pagamento.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.cupom.deleteMany({ where: { concedidoParaUsuarioId: { in: usuarios }, codigo: { startsWith: 'ANIVERSARIO_' } } });
        await prisma.atleta.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.usuarioPapel.deleteMany({ where: { usuarioId: { in: usuarios } } });
      }
      if (aulasCriadas.length) await prisma.aulaAoVivo.deleteMany({ where: { id: { in: aulasCriadas } } });
      if (metodologiasCriadas.length) await prisma.metodologiaAvulsa.deleteMany({ where: { id: { in: metodologiasCriadas } } });
      if (eventos.length) await prisma.evento.deleteMany({ where: { id: { in: eventos } } });
      if (usuarios.length) await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
      console.log('LIMPEZA_QA: fixtures próprias removidas.');
    } catch (e) {
      console.error('LIMPEZA_QA_FALHOU — IDs para auditoria manual:', { usuarios, eventos, aulasCriadas, metodologiasCriadas, pagamentos });
      throw e;
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(err => { console.error('TESTE_CUPOM_ANIVERSARIO_CHECKOUT_HTTP_QA_FALHOU:', err); process.exitCode = 1; });