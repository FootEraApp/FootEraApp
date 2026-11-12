import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.NODE_ENV,'test');
  assert.equal(Boolean(process.env.MP_ACCESS_TOKEN),false);
  assert.equal(process.env.BILLING_CUPOM_RESERVA_QA,'true');
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER,'false');
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER,'false');
  assert.equal(url.protocol,'postgresql:');
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.equal(url.port,'5433');
  assert.equal(url.pathname,'/footera_billing_qa');
  const {prisma} = await import('./server/prisma.js');
  const {prepararCheckoutAtomico, adquirirEnvioCheckout, marcarCheckoutInconclusivo, fingerprintCheckout} =
    await import('./server/services/billingCheckoutOperacaoService.js');
  const cupomId=randomUUID(), pagamentoMarca=`QA_CUPOM_TIMEOUT_${randomUUID()}`;
  const chaveCliente=randomUUID();
  let pgId:string|null=null, opId:string|null=null, sucesso=false;
  try {
    const db=await prisma.$queryRaw<Array<{nome:string}>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome,'footera_billing_qa');
    const atleta=await prisma.atleta.findFirst({select:{usuarioId:true}});
    assert.ok(atleta,'QA_SEM_ATLETA');
    await prisma.cupom.create({data:{id:cupomId,codigo:`QATIMEOUT${randomUUID().replace(/-/g,'')}`,tipo:'PERCENTUAL',descontoPerc:10,ativo:true,usosMax:1,usosAtuais:0}});
    const fp=fingerprintCheckout({usuarioId:atleta.usuarioId,plano:'ATLETA_PRO',metodo:'PIX',cupomId,valorCentavos:1791});
    let criacoes=0;
    const criarPagamento = async (tx: Parameters<Parameters<typeof prepararCheckoutAtomico>[0]['criarPagamento']>[0]) => {
      criacoes++;
      const pg=await tx.pagamento.create({data:{usuarioId:atleta.usuarioId,plano:'ATLETA_PRO',periodicidade:'Mensal',metodo:'PIX',status:'PENDENTE',valor:'17.91',moeda:'BRL',pagadorNome:pagamentoMarca}});
      await tx.cupomReserva.create({data:{cupomId,usuarioId:atleta.usuarioId,pagamentoId:pg.id,status:'RESERVADA',expiraEm:new Date(Date.now()+3600000)}});
      return pg;
    };
    const args={usuarioId:atleta.usuarioId,chaveCliente,modalidade:'PIX_INDIVIDUAL' as const,fingerprintRequisicao:fp,criarPagamento};
    const primeira=await prepararCheckoutAtomico(args); pgId=primeira.pagamento.id; opId=primeira.operacao.id;
    assert.equal(criacoes,1); assert.equal(primeira.reutilizada,false);
    console.log('✔ Pagamento e reserva criados juntos na mesma transação');
    assert.equal(await adquirirEnvioCheckout(opId),true);
    assert.equal(await marcarCheckoutInconclusivo(opId,'QA_TIMEOUT'),true);
    assert.equal(await adquirirEnvioCheckout(opId),false);
    console.log('✔ Timeout conserva bloqueio de novo envio');
    const segunda=await prepararCheckoutAtomico(args);
    assert.equal(segunda.reutilizada,true); assert.equal(segunda.pagamento.id,pgId); assert.equal(criacoes,1);
    console.log('✔ Mesma chave não cria outro pagamento');
    const reservas=await prisma.cupomReserva.findMany({where:{cupomId}});
    assert.equal(reservas.length,1); assert.equal(reservas[0].pagamentoId,pgId); assert.equal(reservas[0].status,'RESERVADA');
    console.log('✔ A mesma reserva permanece associada ao pagamento');
    const cupom=await prisma.cupom.findUniqueOrThrow({where:{id:cupomId}});
    assert.equal(cupom.usosAtuais,0);
    assert.equal(await prisma.cupomResgate.count({where:{cupomId}}),0);
    console.log('✔ Timeout não consome o cupom duas vezes');
    const operacao=await prisma.billingCheckoutOperacao.findUniqueOrThrow({where:{id:opId}});
    assert.equal(operacao.status,'INCONCLUSIVA');
    assert.equal(await prisma.pagamentoBeneficio.count({where:{pagamentoId:pgId}}),0);
    console.log('✔ Checkout segue inconclusivo, sem benefícios');
    sucesso=true; console.log('\nRESULTADO: 6/6');
  } finally {
    if(sucesso&&pgId&&opId){
      await prisma.$transaction(async tx=>{
        const pg=await tx.pagamento.findUniqueOrThrow({where:{id:pgId!}});
        const op=await tx.billingCheckoutOperacao.findUniqueOrThrow({where:{id:opId!}});
        assert.equal(pg.pagadorNome,pagamentoMarca);assert.equal(op.status,'INCONCLUSIVA');
        await tx.cupomReserva.deleteMany({where:{pagamentoId:pgId!}});
        await tx.billingCheckoutOperacao.delete({where:{id:opId!}});
        await tx.pagamento.delete({where:{id:pgId!}});
        await tx.cupom.delete({where:{id:cupomId}});
      });console.log('[QA] Fixtures removidas');
    }else console.warn('[QA] Dados preservados para auditoria',{cupomId,pgId,opId});
    await prisma.$disconnect();
  }
}
main().catch(e=>{console.error('QA_CUPOM_TIMEOUT_FALHOU',e);process.exitCode=1});
