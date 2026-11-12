/**
 * FootEra — QA HTTP real do 20PARABENS (sem Mercado Pago).
 * Sobe Express local com server/routes/billing e middleware REAL de autenticacao.
 * Cria duas contas Atleta ficticias e apaga SOMENTE registros dessas contas.
 * COBRE: autenticação, GET aniversario, prévia individual/pacote, precificação,
 * checkout PIX fake, desconto persistido, reserva, segunda cobrança bloqueada,
 * isolamento entre usuários e proteção do código interno.
 * NÃO COBRE: webhook, provisionamento, confirmação, PIX real, cancelamento externo.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

function ambienteSeguro() {
  const u = new URL(process.env.DATABASE_URL ?? '');
  const obrigatorias: Record<string, string> = {
    NODE_ENV: 'test', BILLING_CUPOM_RESERVA_QA: 'true',
    ENABLE_BILLING_SCHEDULER: 'false',
    ENABLE_MP_CONCILIACAO_SCHEDULER: 'false',
  };
  for (const [k,v] of Object.entries(obrigatorias))
    assert.equal(process.env[k],v,`QA_AMBIENTE_${k}`);
  assert.ok(['postgresql:','postgres:'].includes(u.protocol),'QA_PROTOCOLO');
  assert.ok(['127.0.0.1','localhost'].includes(u.hostname),'QA_HOST');
  assert.equal(u.port,'5433','QA_PORTA');
  assert.equal(u.pathname,'/footera_billing_qa','QA_BANCO');
  assert.equal(process.env.MP_ACCESS_TOKEN ?? '','','QA_MP_TOKEN');
}
ambienteSeguro();

async function main() {
  // Definir antes dos imports dinâmicos: o middleware lê JWT_SECRET no import.
  const jwtAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.BILLING_SHOW_LEARNING_PLANS = 'true';
  const { prisma } = await import('./server/prisma.js');
  const { default: express } = await import('express');
  const { default: jwt } = await import('jsonwebtoken');
  const { default: rotasBilling } = await import('./server/routes/billing.js');
  const { resolveUserContext } = await import('./server/services/planResolver.js');

  const prefixo = `QA_ANIV_HTTP_${randomUUID().replaceAll('-','')}`;
  const ids: string[] = [];
  let servidor: ReturnType<ReturnType<typeof express>['listen']> | null = null;
  let aprovados = 0;
  let erro: unknown = null;
  const ok = (cond: unknown, titulo: string, contexto?: unknown) => {
    assert.ok(cond,`${titulo}: ${JSON.stringify(contexto ?? null)}`);
    console.log(`APROVADO ${String(++aprovados).padStart(2,'0')} — ${titulo}`);
  };
  const hoje = new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date());
  const n = (key:string) => Number(hoje.find(x=>x.type===key)?.value);
  const nascimentoHoje = new Date(Date.UTC(2000,n('month')-1,n('day')));
  const nascimentoOutro = new Date(Date.UTC(2000,n('month')-1,n('day')+1));

  async function fixture(sufixo:string, nascimento:Date) {
    const usuario = await prisma.usuario.create({data:{
      nome:`QA aniversario HTTP ${sufixo}`,
      nomeDeUsuario:`${prefixo}_${sufixo}`.toLowerCase(),
      email:`${prefixo}_${sufixo}@example.invalid`.toLowerCase(),
      senhaHash:`NAO_LOGIN_${prefixo}`,tipo:'Atleta',verified:true,
      dataNascimento:nascimento,
      aniversarioElegivelApartirDe:new Date(Date.now()-45*86400000),
    }});
    ids.push(usuario.id);
    await prisma.atleta.create({data:{usuarioId:usuario.id,idade:26,dataNascimento:nascimento}});
    await prisma.usuarioPapel.create({data:{usuarioId:usuario.id,papel:'Atleta',status:'ATIVO',ativadoEm:new Date()}});
    // Falhar cedo se a conta não tiver o contexto REAL necessário para billing.
    const contexto = await resolveUserContext(usuario.id);
    assert.equal(contexto.activeContext?.kind,'PERSONAL','CONTEXTO_QA_NAO_PESSOAL');
    const token = jwt.sign({id:usuario.id,tokenVersion:usuario.tokenVersion},process.env.JWT_SECRET!,{
      expiresIn:'10m',algorithm:'HS256',
    });
    return {id:usuario.id,token};
  }

  try {
    const db = await prisma.$queryRaw<Array<{nome:string}>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome,'footera_billing_qa');
    const dono = await fixture('dono',nascimentoHoje);
    const outro = await fixture('outro',nascimentoOutro);

    const app = express();
    app.use(express.json());
    app.use('/api/billing',rotasBilling);
    const escutando = app.listen(0,'127.0.0.1');
    servidor = escutando;
    if (!escutando.listening) {
      await new Promise<void>((resolve,reject)=>{
        escutando.once('listening',resolve);
        escutando.once('error',reject);
      });
    }
    const base = `http://127.0.0.1:${(escutando.address() as AddressInfo).port}`;
    async function chamar(token:string|null,caminho:string,body?:Record<string,unknown>) {
      const r = await fetch(`${base}/api/billing${caminho}`,{
        method:body?'POST':'GET',
        headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),
          ...(body?{'Content-Type':'application/json'}:{})},
        body:body?JSON.stringify(body):undefined,
        signal:AbortSignal.timeout(20000),
      });
      const t = await r.text();
      let json:any;
      try { json=JSON.parse(t); } catch { json={raw:t.slice(0,500)}; }
      return {status:r.status,json};
    }
    const semToken = await chamar(null,'/aniversario');
    ok(semToken.status===401,'Rota de aniversario exige autenticação',semToken);
    const beneficio = await chamar(dono.token,'/aniversario');
    ok(beneficio.status===200 && beneficio.json.elegivel===true && beneficio.json.disponivel===true,
      'GET aniversario autentica o dono e autoriza beneficio',beneficio);
    const semAniversario = await chamar(outro.token,'/aniversario');
    ok(semAniversario.status===200 && semAniversario.json.elegivel===false,
      'Outro usuario não ganha aniversario',semAniversario);

    const item = {planoId:'ATLETA_PRO',periodicidade:'Mensal'};
    const prev = await chamar(dono.token,'/coupon/apply',{codigo:'20PARABENS',...item});
    ok(prev.status===200 && prev.json.cupom?.codigo==='20PARABENS',
      'Prévia HTTP individual aceita código público, sem vazar o interno',prev);
    const cent = (v:any) => Math.round(Number(v)*100);
    ok(Number.isFinite(Number(prev.json.base)) && cent(prev.json.base)>0 &&
      cent(prev.json.desconto)===Math.round(cent(prev.json.base)*.2) &&
      cent(prev.json.total)===cent(prev.json.base)-cent(prev.json.desconto),
      'Prévia individual aplica 20% em centavos',prev);
    const outroPrev = await chamar(outro.token,'/coupon/apply',{codigo:'20PARABENS',...item});
    ok([400,403,409].includes(outroPrev.status),'Outro usuário não aplica 20PARABENS',outroPrev);
    const cupomInterno = `ANIVERSARIO_${n('year')}_${dono.id}`;
    const interno = await chamar(dono.token,'/coupon/apply',{codigo:cupomInterno,...item});
    ok(interno.status===403 && interno.json.code==='BIRTHDAY_COUPON_PUBLIC_CODE_REQUIRED',
      'API bloqueia uso direto do código interno',interno);

    const bundle = await chamar(dono.token,'/coupon/apply',{
      codigo:'20PARABENS',items:[item,{planoId:'ATLETA_LEARNING_1',periodicidade:'Mensal'}],
    });
    ok(bundle.status===200 && Array.isArray(bundle.json.financeiroV1?.items),
      'Prévia HTTP de pacote permitido produz snapshot financeiro',bundle);
    const finance = bundle.json.financeiroV1;
    ok(finance.items.reduce((s:number,x:any)=>s+x.valorFinalCentavos,0)===finance.totalCentavos &&
      finance.totalCentavos===cent(bundle.json.total) &&
      cent(bundle.json.desconto)===Math.round(cent(bundle.json.base)*.2),
      'Pacote tem rateio íntegro e 20% em centavos',bundle);

    const corpo = { ...item, metodo:'PIX',cupom:'20PARABENS',
      pagador:{nome:'Atleta QA Aniversario',email:'qa@example.invalid'},
      chaveCliente:randomUUID(),
    };
    const checkout = await chamar(dono.token,'/checkout',corpo);
    ok(checkout.status===200 && checkout.json.status==='PENDENTE' && checkout.json.pagamento?.id,
      'Checkout HTTP PIX fake criou pagamento pendente',checkout);
    const pagamentoId = String(checkout.json.pagamento.id);
    const pg = await prisma.pagamento.findUniqueOrThrow({where:{id:pagamentoId}});
    const cupom = await prisma.cupom.findUniqueOrThrow({where:{id:pg.cupomId!}});
    ok(pg.usuarioId===dono.id && cupom.concedidoParaUsuarioId===dono.id &&
      cupom.codigo===cupomInterno,'Pagamento foi vinculado ao cupom exclusivo correto');
    ok(cent(pg.valor.toNumber())===cent(prev.json.total) &&
      (pg.meta as any)?.financeiroV1?.totalCentavos===cent(prev.json.total),
      'Valor persistido e snapshot refletem os 20% da prévia');
    const reserva = await prisma.cupomReserva.findUnique({where:{pagamentoId}});
    ok(reserva?.status==='RESERVADA' && reserva.cupomId===cupom.id && reserva.usuarioId===dono.id,
      'Pagamento HTTP criou reserva atômica correta',reserva);
    const repetido = await chamar(dono.token,'/checkout',{...corpo,chaveCliente:randomUUID()});
    ok([400,403,409].includes(repetido.status),
      'Segundo checkout HTTP com outra chave é recusado',repetido);
    ok(await prisma.pagamento.count({where:{usuarioId:dono.id,cupomId:cupom.id}})===1,
      'Segundo checkout não criou outro pagamento');
    const apos = await chamar(dono.token,'/aniversario');
    ok(apos.status===200 && apos.json.disponivel===false,
      'Banner informa benefício indisponível após reserva',apos);

    console.log(`\nRESULTADO: ${aprovados}/${aprovados} verificações HTTP aprovadas.`);
    console.log('NÃO COBERTO: gateway real; webhook; confirmação e provisionamento; cancelamento; aula/evento/metodologia.');
  } catch(e) {
    erro=e;
    console.error('ANIVERSARIO_HTTP_QA_FALHOU:',e);
    console.error('FIXTURES_COM_PREFIXO:',prefixo);
  } finally {
    if(servidor) await new Promise<void>(resolve=>servidor!.close(()=>resolve()));
    // Deletar APENAS dados vinculados aos usuários criados pelo script.
    try {
      if(ids.length) {
        const pgs = await prisma.pagamento.findMany({where:{usuarioId:{in:ids}},select:{id:true}});
        const pids = pgs.map(p=>p.id);
        const cps = await prisma.cupom.findMany({where:{codigo:{startsWith:'ANIVERSARIO_'},
          concedidoParaUsuarioId:{in:ids}},select:{id:true}});
        const cids = cps.map(c=>c.id);
        await prisma.cupomReserva.deleteMany({where:{OR:[{usuarioId:{in:ids}},{pagamentoId:{in:pids}}]}});
        await prisma.cupomResgate.deleteMany({where:{OR:[{usuarioId:{in:ids}},{cupomId:{in:cids}}]}});
        await prisma.billingCheckoutOperacao.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.pagamentoBeneficio.deleteMany({where:{pagamentoId:{in:pids}}});
        await prisma.pagamento.deleteMany({where:{id:{in:pids}}});
        await prisma.cupom.deleteMany({where:{id:{in:cids}}});
        await prisma.usuarioPapel.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.atleta.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.usuario.deleteMany({where:{id:{in:ids}}});
      }
      console.log('LIMPEZA_QA: fixtures deste teste removidas.');
    } catch(e) {
      console.error('LIMPEZA_QA_FALHOU:',e,'IDS:',ids,'PREFIXO:',prefixo);
      erro ??= e;
    }
    if(jwtAnterior===undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET=jwtAnterior;
    await prisma.$disconnect();
  }
  if(erro) process.exitCode=1;
}
main().catch(e=>{console.error('ANIVERSARIO_QA_INICIALIZACAO_FALHOU:',e);process.exitCode=1});