import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ''); }
  catch { throw new Error('QA_ABORTADO: DATABASE_URL invalida'); }
  if (process.env.NODE_ENV === 'production' || process.env.MP_ACCESS_TOKEN ||
      process.env.BILLING_CUPOM_RESERVA_QA !== 'true' ||
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== 'false' ||
      process.env.ENABLE_BILLING_SCHEDULER !== 'false' ||
      url.protocol !== 'postgresql:' ||
      !['localhost','127.0.0.1'].includes(url.hostname) ||
      url.port !== '5433' || url.pathname !== '/footera_billing_qa') {
    throw new Error('QA_ABORTADO: ambiente inseguro');
  }
  const { prisma } = await import('./server/prisma.js');
  const eventoId = randomUUID();
  const testeId = randomUUID();
  const compras = [0,1].map((i) => ({
    usuarioId: '', pagamentoId: randomUUID(),
    mpId: (BigInt(Date.now())*100000n+BigInt(91001+i)).toString(),
  }));
  let eventoCriado = false, passou = 0, falhou = 0;
  const pagamentosCriados: string[] = [];
  async function verificar(nome: string, fn: () => Promise<void>) {
    try { await fn(); passou++; console.log('✔', nome); }
    catch (e) { falhou++; console.error('✖', nome, e); }
  }
  try {
    const db = await prisma.$queryRaw<Array<{nome:string}>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome, 'footera_billing_qa');
    const atletas = await prisma.atleta.findMany({ select: {usuarioId:true}, take:200 });
    const ids = [...new Set(atletas.map(a=>a.usuarioId))].slice(0,2);
    assert.equal(ids.length,2,'QA_SEM_DOIS_ATLETAS');
    compras.forEach((c,i)=>c.usuarioId=ids[i]);
    await prisma.evento.create({data:{
      id:eventoId, titulo:`QA Reentrega ${testeId}`, descricao:'Fixture QA',
      status:'ABERTO', dataEvento:new Date(Date.now()+10*86400000),
      inscricaoInicio:new Date(Date.now()-86400000),
      inscricaoFim:new Date(Date.now()+9*86400000), vagas:1,
      valorInscricao:'25.00', requisitos:[], linkInscricao:null,
    }});
    eventoCriado=true;
    const plano=`EVENTO:${eventoId}`;
    for(const c of compras){
      await prisma.pagamento.create({data:{id:c.pagamentoId, usuarioId:c.usuarioId,
        plano, periodicidade:'Mensal', metodo:'PIX',status:'PENDENTE',valor:'25.00',
        moeda:'BRL',provider:'MERCADOPAGO',providerRef:`PREF-QA-${c.pagamentoId}`,
        contextoKind:'PERSONAL',contextoTipo:'Atleta',contextoPerfilId:null,
      }});
      pagamentosCriados.push(c.pagamentoId);
    }
    const {mercadoPagoWebhook}=await import('./server/controllers/billingController.js');
    const {configurarConsultorMercadoPagoQa}=await import('./server/services/billingMercadoPagoGateway.js');
    configurarConsultorMercadoPagoQa(async (id)=>{
      const c=compras.find(x=>x.mpId===id);
      assert.ok(c,'MP_ID_NAO_RECONHECIDO');
      return {id:c.mpId,status:'approved',status_detail:'accredited',
        external_reference:c.pagamentoId, metadata:{pagamentoId:c.pagamentoId},
        transaction_amount:25,currency_id:'BRL'};
    });
    async function webhook(c:typeof compras[number]){
      let status=0,corpo:any=null;
            
      const req = {
        query: {
          type: "payment",
          "data.id": c.mpId,
        },
        body: {
          type: "payment",
          data: {
            id: c.mpId,
          },
        },
      };

      const res={status(n:number){status=n;return this;},json(v:unknown){corpo=v;return this;}};
      await mercadoPagoWebhook(req as any,res as any);
      return {status,corpo};
    }
    try{
      const a=await webhook(compras[0]);
      const b=await webhook(compras[1]);
      const c=await webhook(compras[1]);
      const d=await webhook(compras[1]);
      console.log('[QA] Webhooks:', [a,b,c,d].map(x=>({status:x.status,code:x.corpo?.code})));
      await verificar('Primeiro webhook aprova ultima vaga', async()=>{
        assert.equal(a.status,200);
      });
      await verificar('Tres tentativas excedentes pedem conciliacao', async()=>{
        for(const r of [b,c,d]){
          assert.equal(r.status,503);
          assert.equal(r.corpo?.code,'BILLING_EVENT_CAPACITY_RECONCILIATION_REQUIRED');
        }
      });
      await verificar('Inscricao confirmada permanece unica',async()=>{
        assert.equal(await prisma.inscricaoEvento.count({where:{eventoId,status:'CONFIRMADA'}}),1);
      });
      await verificar('Beneficio permanece unico',async()=>{
        assert.equal(await prisma.pagamentoBeneficio.count({where:{pagamentoId:{in:pagamentosCriados},tipo:'EVENTO'}}),1);
      });
      await verificar('Pagamento excedente preserva PENDENTE e providerRef',async()=>{
        const pg=await prisma.pagamento.findUniqueOrThrow({where:{id:compras[1].pagamentoId}});
        assert.equal(pg.status,'PENDENTE');
        assert.equal(pg.providerRef,compras[1].mpId);
        assert.equal(pg.pagoEm,null);
      });
      await verificar('Auditoria do excedente e criada somente uma vez',async()=>{
        const logs=await prisma.auditLog.findMany({where:{
          acao:'BILLING_EVENT_CAPACITY_RECONCILIATION', entidade:'Pagamento',
          entidadeId:compras[1].pagamentoId,
        }});
        assert.equal(logs.length,1);
        assert.equal((logs[0].meta as any)?.eventoId,eventoId);
      });
      
      await verificar(
        "Reentregas preservam uma unica pendencia",
        async () => {
          const pendencias =
            await prisma.billingPendenciaEvento.findMany({
              where: {
                pagamentoId: compras[1].pagamentoId,
              },
            });

          assert.equal(pendencias.length, 1);
          assert.equal(
            pendencias[0].status,
            "PENDENTE_ANALISE"
          );
          assert.equal(
            pendencias[0].providerRef,
            compras[1].mpId
          );
        }
      );

      await verificar(
        "Reentregas nao geram estorno ou beneficio",
        async () => {
          const pagamento =
            await prisma.pagamento.findUniqueOrThrow({
              where: {
                id: compras[1].pagamentoId,
              },
            });

          const beneficios =
            await prisma.pagamentoBeneficio.count({
              where: {
                pagamentoId: compras[1].pagamentoId,
              },
            });

          const compensacoes =
            await prisma.billingCompensacaoEvento.count({
              where: {
                pagamentoId: compras[1].pagamentoId,
              },
            });

          assert.equal(pagamento.status, "PENDENTE");
          assert.equal(pagamento.reembolsadoEm, null);
          assert.equal(beneficios, 0);
          assert.equal(compensacoes, 0);
        }
      );
    }finally { configurarConsultorMercadoPagoQa(null); }
  }finally{
    try{
      if(!falhou && eventoCriado && pagamentosCriados.length===2){
        await prisma.$transaction(async tx=>{
          const pagos=await tx.pagamento.findMany({where:{id:{in:pagamentosCriados}}});
          if(pagos.length!==2 || pagos.some(p=>p.plano!==`EVENTO:${eventoId}` || p.provider!=='MERCADOPAGO'))
            throw new Error('QA_CLEANUP_PAGAMENTO_INESPERADO');
          await tx.billingPendenciaEvento.deleteMany({
            where: {
                pagamentoId: {
                in: pagamentosCriados,
                },
            },
            });
          await tx.auditLog.deleteMany({where:{acao:'BILLING_EVENT_CAPACITY_RECONCILIATION',entidade:'Pagamento',entidadeId:{in:pagamentosCriados}}});
          await tx.pagamentoBeneficio.deleteMany({where:{pagamentoId:{in:pagamentosCriados}}});
          await tx.inscricaoEvento.deleteMany({where:{eventoId,usuarioId:{in:compras.map(c=>c.usuarioId)}}});
          for(const id of pagamentosCriados) await tx.pagamento.delete({where:{id}});
          await tx.evento.delete({where:{id:eventoId}});
        });
        console.log('[QA] Fixture, auditoria e pagamentos removidos.');
      }else if(eventoCriado){
        console.warn('[QA] Preservados para auditoria:',{eventoId,pagamentosCriados});
      }
    }finally{await prisma.$disconnect();}
  }
  console.log(`\nRESULTADO: ${passou}/${passou+falhou}`);
  if(falhou)process.exitCode=1;
}
main().catch(e=>{console.error('TESTE INTERROMPIDO:',e);process.exitCode=1;});