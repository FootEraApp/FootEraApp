import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  if (process.env.BILLING_SHOW_LEARNING_PLANS !== "true") {
    throw new Error(
        "QA_ABORTADO: defina BILLING_SHOW_LEARNING_PLANS=true para testar o bundle Learning."
    );
    }
    
  const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
  if (process.env.NODE_ENV === 'production' || Boolean(process.env.MP_ACCESS_TOKEN) ||
      process.env.BILLING_CUPOM_RESERVA_QA !== 'true' ||
      process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== 'false' ||
      process.env.ENABLE_BILLING_SCHEDULER !== 'false' ||
      url.protocol !== 'postgresql:' || !['localhost','127.0.0.1'].includes(url.hostname) ||
      url.port !== '5433' || url.pathname !== '/footera_billing_qa') {
    throw new Error('QA_ABORTADO: exige banco local footera_billing_qa e Mercado Pago desligado');
  }

  const { prisma } = await import('./server/prisma.js');
  const pagamentosCriados: string[] = [];
  const operacoesCriadas: string[] = [];
  let aprovados = 0;
  let falhas = 0;
  async function verificar(nome: string, fn: () => Promise<void>) {
    try { await fn(); aprovados++; console.log('✔',nome); }
    catch (err) { falhas++; console.error('✖',nome,err); }
  }
  try {
    const db = await prisma.$queryRaw<Array<{nome:string}>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome, 'footera_billing_qa');
    const atletas = await prisma.atleta.findMany({select:{usuarioId:true},take:100});
    let usuarioId: string | null = null;
    for (const atleta of atletas) {
      const trial = await prisma.assinatura.count({where:{usuarioId:atleta.usuarioId,status:'TRIAL',ativo:true,trialEndsAt:{gt:new Date(Date.now()+7*86400000)}}});
      if (!trial) { usuarioId = atleta.usuarioId; break; }
    }
    assert.ok(usuarioId, 'QA_SEM_ATLETA: necessita Atleta QA sem trial superior a sete dias');
    console.log('[QA] Usuario de teste:',usuarioId);
    const pagadorQa = {
    nome: "Comprador QA FootEra",
    email: "comprador-qa@example.com",
    };

    const { startCheckout, startCheckoutBundle } = await import('./server/controllers/billingController.js');
    type Resp = { status: number; corpo: any };
    async function chamar(fn: typeof startCheckout, body: Record<string,unknown>): Promise<Resp> {
      let status = 200;
      let corpo: any;
      const contexto = { kind:'PERSONAL', tipoUsuario:'Atleta', profileId:null, tipoUsuarioId:null };
      const req: any = { userId:usuarioId, authUser:{id:usuarioId,activeContext:contexto}, body };
      const res: any = {
        status(code:number) {status=code;return this;},
        json(value:any) {corpo=value;return this;},
        send(value:any) {corpo=value;return this;},
      };
      await fn(req,res);
      // Identifica qualquer pagamento criado por ESTA chamada, mesmo se a resposta falhar.
      const id = corpo?.pagamento?.id;
      if (typeof id === 'string') pagamentosCriados.push(id);
      return { status, corpo };
    }
    function snapshot(meta: any) { return meta?.financeiroV1; }
    function assertPagamentoFake(pg:any, totalCentavos:number, quantItems:number) {
      assert.ok(pg?.id);
      assert.equal(pg.usuarioId,usuarioId);
      assert.equal(pg.status,'PENDENTE');
      assert.equal(pg.provider,'INTERNAL_FAKE');
      assert.equal(Number(pg.valor),totalCentavos/100);
      assert.equal(snapshot(pg.meta)?.versao,1);
      assert.equal(snapshot(pg.meta)?.totalCentavos,totalCentavos);
      assert.equal(snapshot(pg.meta)?.items?.length,quantItems);
      assert.equal(snapshot(pg.meta).items.reduce((n:number,i:any)=>n+i.valorFinalCentavos,0),totalCentavos);
    }

    await verificar('Checkout individual calcula ATLETA_PRO em R$ 19,90',async()=>{
      const r = await chamar(startCheckout, {
        planoId: "ATLETA_PRO",
        periodicidade: "Mensal",
        metodo: "PIX",
        pagador: pagadorQa,
        valor: 0.01,
        });
      assert.equal(r.status,200,JSON.stringify(r.corpo));
      assert.equal(r.corpo?.status,'PENDENTE');
      const pg=await prisma.pagamento.findUniqueOrThrow({where:{id:r.corpo.pagamento.id}});
      assertPagamentoFake(pg,1990,1);
      assert.equal(snapshot(pg.meta).items[0].planoId,'ATLETA_PRO');
      assert.equal(snapshot(pg.meta).items[0].valorBaseCentavos,1990);
    });

    await verificar('Checkout bundle soma R$ 19,90 + R$ 44,90 = R$ 64,80',async()=>{
      const r = await chamar(startCheckoutBundle, {
        items: [
            {
            planoId: "ATLETA_PRO",
            periodicidade: "Mensal",
            },
            {
            planoId: "ATLETA_LEARNING_1",
            periodicidade: "Mensal",
            },
        ],
        metodo: "PIX",
        pagador: pagadorQa,
        valor: 0.01,
        });
      assert.equal(r.status,200,JSON.stringify(r.corpo));
      assert.equal(r.corpo?.status,'PENDENTE');
      const pg=await prisma.pagamento.findUniqueOrThrow({where:{id:r.corpo.pagamento.id}});
      assert.equal(pg.plano,'BUNDLE');
      assertPagamentoFake(pg,6480,2);
      assert.deepEqual(snapshot(pg.meta).items.map((i:any)=>i.valorFinalCentavos),[1990,4490]);
      assert.equal((pg.meta as any).bundleItems.length,2);
    });

    await verificar('Plano inexistente bloqueado antes de criar pagamento',async()=>{
      const antes=await prisma.pagamento.count({where:{usuarioId}});
      const r=await chamar(startCheckout,{planoId:'PLANO_QA_INEXISTENTE',periodicidade:'Mensal',metodo:'PIX'});
      assert.notEqual(r.status,200);
      assert.equal(await prisma.pagamento.count({where:{usuarioId}}),antes);
    });

    await verificar('Bundle duplicado bloqueado antes de criar pagamento',async()=>{
      const antes=await prisma.pagamento.count({where:{usuarioId}});
      const r=await chamar(startCheckoutBundle,{items:[
        {planoId:'ATLETA_PRO',periodicidade:'Mensal'},
        {planoId:'ATLETA_PRO',periodicidade:'Mensal'}
      ],metodo:'PIX'});
      assert.equal(r.status,400);
      assert.equal(r.corpo?.code,'BUNDLE_DUPLICATE_ITEMS');
      assert.equal(await prisma.pagamento.count({where:{usuarioId}}),antes);
    });

    await verificar('Evento não pode ser vendido no bundle',async()=>{
      const antes=await prisma.pagamento.count({where:{usuarioId}});
      const r=await chamar(startCheckoutBundle,{items:[
        {planoId:'ATLETA_PRO',periodicidade:'Mensal'},
        {planoId:`EVENTO:${randomUUID()}`,periodicidade:'Mensal'}
      ],metodo:'PIX'});
      assert.equal(r.status,400);
      assert.equal(r.corpo?.code,'EVENT_BUNDLE_NOT_ALLOWED');
      assert.equal(await prisma.pagamento.count({where:{usuarioId}}),antes);
    });

    await verificar('Evento inexistente bloqueado sem criar pagamento',async()=>{
      const antes=await prisma.pagamento.count({where:{usuarioId}});
      const r=await chamar(startCheckout,{planoId:`EVENTO:${randomUUID()}`,periodicidade:'Mensal',metodo:'PIX'});
      assert.notEqual(r.status,200);
      assert.equal(await prisma.pagamento.count({where:{usuarioId}}),antes);
    });
    await verificar('Aula inexistente bloqueada sem criar pagamento',async()=>{
      const antes=await prisma.pagamento.count({where:{usuarioId}});
      const r=await chamar(startCheckout,{planoId:`AULA_AO_VIVO:${randomUUID()}`,periodicidade:'Mensal',metodo:'PIX'});
      assert.notEqual(r.status,200);
      assert.equal(await prisma.pagamento.count({where:{usuarioId}}),antes);
    });

    // --------------------------------------------------------------
    // QA de operacao: nao chama Mercado Pago, nao aprova pagamento.
    // Usa somente o PostgreSQL local footera_billing_qa.
    // --------------------------------------------------------------
    const opService = await import('./server/services/billingCheckoutOperacaoService.js');

    function argsOperacao(chaveCliente: string, modalidade: 'PIX_INDIVIDUAL' | 'PREFERENCIA_INDIVIDUAL', etiqueta: string) {
      return {
        usuarioId: usuarioId!,
        chaveCliente,
        modalidade,
        fingerprintRequisicao: opService.fingerprintCheckout({
          usuarioId,
          contexto: 'PERSONAL:Atleta:QA',
          plano: 'ATLETA_PRO',
          periodicidade: 'Mensal',
          modalidade,
          etiqueta,
          valorCentavos: 1990,
        }),
        criarPagamento: async (tx: any) => tx.pagamento.create({
          data: {
            usuarioId: usuarioId!,
            contextoKind: 'PERSONAL',
            contextoTipo: 'Atleta',
            plano: 'ATLETA_PRO',
            periodicidade: 'Mensal',
            metodo: modalidade === 'PIX_INDIVIDUAL' ? 'PIX' : 'CREDITO',
            status: 'PENDENTE',
            valor: '19.90',
            moeda: 'BRL',
            provider: 'INTERNAL_FAKE',
            meta: { qaCheckoutOperacao: true },
          },
        }),
      };
    }

    async function criarOperacao(modalidade: 'PIX_INDIVIDUAL' | 'PREFERENCIA_INDIVIDUAL' = 'PIX_INDIVIDUAL') {
      const args = argsOperacao(randomUUID(), modalidade, randomUUID());
      const primeiro = await opService.prepararCheckoutAtomico(args);
      pagamentosCriados.push(primeiro.pagamento.id);
      operacoesCriadas.push(primeiro.operacao.id);
      return { args, primeiro };
    }

    await verificar('Fingerprint canonico ignora ordem das propriedades', async () => {
      assert.equal(
        opService.fingerprintCheckout({ usuarioId, items: [{ planoId: 'ATLETA_PRO', valor: 1990 }], metodo: 'PIX' }),
        opService.fingerprintCheckout({ metodo: 'PIX', items: [{ valor: 1990, planoId: 'ATLETA_PRO' }], usuarioId }),
      );
      assert.notEqual(
        opService.fingerprintCheckout({ usuarioId, cupom: null }),
        opService.fingerprintCheckout({ usuarioId, cupom: 'QA10' }),
      );
    });

    await verificar('Mesma chave reutiliza pagamento sem duplicar', async () => {
      const { args, primeiro } = await criarOperacao();
      const segundo = await opService.prepararCheckoutAtomico(args);
      assert.equal(primeiro.reutilizada, false);
      assert.equal(segundo.reutilizada, true);
      assert.equal(segundo.pagamento.id, primeiro.pagamento.id);
      assert.equal(segundo.operacao.id, primeiro.operacao.id);
      assert.equal(await prisma.pagamento.count({ where: { id: primeiro.pagamento.id } }), 1);
    });

    await verificar('Mesma chave com fingerprint diferente e recusada', async () => {
      const { args } = await criarOperacao();
      await assert.rejects(
        () => opService.prepararCheckoutAtomico({
          ...args,
          fingerprintRequisicao: opService.fingerprintCheckout({ outroCupom: 'NOVO' }),
        }),
        (erro: any) => erro?.codigo === 'BILLING_CHECKOUT_IDEMPOTENCY_CONFLICT',
      );
    });

    await verificar('Somente uma aquisicao de envio e permitida', async () => {
      const { primeiro } = await criarOperacao();
      const resultados = await Promise.all(Array.from({ length: 6 }, () =>
        opService.adquirirEnvioCheckout(primeiro.operacao.id)
      ));
      assert.equal(resultados.filter(Boolean).length, 1);
      const op = await prisma.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: primeiro.operacao.id } });
      assert.equal(op.status, 'ENVIO_POSSIVEL');
    });

    await verificar('Resposta perdida marca INCONCLUSIVA sem reenvio', async () => {
      const { primeiro } = await criarOperacao();
      assert.equal(await opService.adquirirEnvioCheckout(primeiro.operacao.id), true);
      assert.equal(await opService.marcarCheckoutInconclusivo(primeiro.operacao.id, new Error('QA_TIMEOUT')), true);
      assert.equal(await opService.adquirirEnvioCheckout(primeiro.operacao.id), false);
      assert.equal(await opService.marcarCheckoutInconclusivo(primeiro.operacao.id, new Error('OUTRO')), false);
      const op = await prisma.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: primeiro.operacao.id } });
      assert.equal(op.status, 'INCONCLUSIVA');
    });

    await verificar('PIX confirmado recupera codigo sem criar pagamento', async () => {
      const { args, primeiro } = await criarOperacao();
      assert.equal(await opService.adquirirEnvioCheckout(primeiro.operacao.id), true);
      await opService.confirmarCheckoutExterno({
        operacaoId: primeiro.operacao.id,
        providerRef: '990000000001',
        pixCopiaECola: 'PIX_QA_NAO_PAGAVEL',
      });
      const op = await opService.consultarCheckoutDoUsuario(usuarioId!, args.chaveCliente);
      assert.equal(op?.status, 'CONFIRMADA');
      assert.equal(op?.pagamentoId, primeiro.pagamento.id);
      const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: primeiro.pagamento.id } });
      assert.equal(pg.providerRef, '990000000001');
      assert.equal(pg.pixCopiaECola, 'PIX_QA_NAO_PAGAVEL');
      assert.equal(pg.status, 'PENDENTE');
      assert.equal((await opService.prepararCheckoutAtomico(args)).reutilizada, true);
    });

    await verificar('Confirmacao PIX repetida e idempotente', async () => {
      const { primeiro } = await criarOperacao();
      await opService.adquirirEnvioCheckout(primeiro.operacao.id);
      await opService.confirmarCheckoutExterno({ operacaoId: primeiro.operacao.id, providerRef: '990000000002', pixCopiaECola: 'QA_PIX' });
      await opService.confirmarCheckoutExterno({ operacaoId: primeiro.operacao.id, providerRef: '990000000002', pixCopiaECola: 'QA_PIX' });
      const op = await prisma.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: primeiro.operacao.id } });
      assert.equal(op.status, 'CONFIRMADA');
      await assert.rejects(
        () => opService.confirmarCheckoutExterno({ operacaoId: primeiro.operacao.id, providerRef: '990000000099' }),
        (erro: any) => erro?.codigo === 'BILLING_CHECKOUT_PROVIDER_REF_CONFLICT',
      );
    });

    await verificar('Preferencia confirmada nao gera outro pagamento', async () => {
      const { args, primeiro } = await criarOperacao('PREFERENCIA_INDIVIDUAL');
      await opService.adquirirEnvioCheckout(primeiro.operacao.id);
      await opService.confirmarPreferenciaCheckout({ operacaoId: primeiro.operacao.id, preferenciaId: 'pref-qa-001' });
      await opService.confirmarPreferenciaCheckout({ operacaoId: primeiro.operacao.id, preferenciaId: 'pref-qa-001' });
      const op = await opService.consultarCheckoutDoUsuario(usuarioId!, args.chaveCliente);
      assert.equal(op?.status, 'CONFIRMADA');
      assert.equal(op?.providerRef, 'pref-qa-001');
      assert.equal((await opService.prepararCheckoutAtomico(args)).pagamento.id, primeiro.pagamento.id);
    });

    await verificar('Duas preparacoes simultaneas nao criam dois pagamentos', async () => {
      const args = argsOperacao(randomUUID(), 'PIX_INDIVIDUAL', randomUUID());
      const resultados = await Promise.allSettled([
        opService.prepararCheckoutAtomico(args),
        opService.prepararCheckoutAtomico(args),
      ]);
      const concluidos = resultados.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof opService.prepararCheckoutAtomico>>> => r.status === 'fulfilled');
      for (const r of concluidos) {
        if (!pagamentosCriados.includes(r.value.pagamento.id)) pagamentosCriados.push(r.value.pagamento.id);
        if (!operacoesCriadas.includes(r.value.operacao.id)) operacoesCriadas.push(r.value.operacao.id);
      }
      const registros = await prisma.billingCheckoutOperacao.findMany({
        where: { usuarioId: usuarioId!, chaveCliente: args.chaveCliente },
      });
      for (const op of registros) {
        if (!operacoesCriadas.includes(op.id)) operacoesCriadas.push(op.id);
        if (!pagamentosCriados.includes(op.pagamentoId)) pagamentosCriados.push(op.pagamentoId);
      }
      assert.ok(concluidos.length >= 1, 'Ambas as preparacoes falharam');
      assert.equal(registros.length, 1);
      assert.equal(new Set(concluidos.map(r => r.value.pagamento.id)).size, 1);
      assert.equal(await prisma.pagamento.count({ where: { id: registros[0].pagamentoId } }), 1);
    });
        
    await verificar(
    "Diagnostico positivo de checkout inconclusivo",
    async () => {
        const { primeiro } = await criarOperacao();

        assert.equal(
        await opService.adquirirEnvioCheckout(
            primeiro.operacao.id
        ),
        true
        );

        assert.equal(
        await opService.marcarCheckoutInconclusivo(
            primeiro.operacao.id,
            new Error("QA_RESPOSTA_PERDIDA")
        ),
        true
        );

        const diagnostico =
        await opService.diagnosticarCheckoutInconclusivo(
            primeiro.operacao.id
        );

        assert.equal(
        diagnostico.status,
        "INCONCLUSIVA"
        );

        assert.equal(
        diagnostico.requerConciliacao,
        true
        );

        assert.equal(
        diagnostico.metodoRecuperacao,
        "IDENTIDADE_EXTERNA_DESCONHECIDA"
        );

        assert.equal(
        diagnostico.podeCriarOutraCobranca,
        false
        );

        assert.equal(
        await opService.adquirirEnvioCheckout(
            primeiro.operacao.id
        ),
        false
        );
    }
    );

    await verificar(
    "Consulta de checkout isolada por usuario",
    async () => {
        const { args, primeiro } = await criarOperacao();

        const propria =
        await opService.consultarCheckoutDoUsuario(
            usuarioId!,
            args.chaveCliente
        );

        const outroUsuario =
        await opService.consultarCheckoutDoUsuario(
            randomUUID(),
            args.chaveCliente
        );

        assert.equal(
        propria?.pagamentoId,
        primeiro.pagamento.id
        );

        assert.equal(
        outroUsuario,
        null
        );
    }
    );

    await verificar(
    "Controller protege usuario e contexto do checkout",
    async () => {
        const { args, primeiro } = await criarOperacao();

        const { getCheckoutOperacao } =
        await import(
            "./server/controllers/billingController.js"
        );

        async function consultar(
        id: string,
        tipoUsuario: string
        ) {
        let statusHttp = 200;
        let corpo: any = null;

        const req: any = {
            userId: id,
            authUser: {
            id,
            activeContext: {
                kind: "PERSONAL",
                tipoUsuario,
                profileId: null,
                tipoUsuarioId: null,
            },
            },
            params: {
            chaveCliente: args.chaveCliente,
            },
        };

        const res: any = {
            status(code: number) {
            statusHttp = code;
            return this;
            },
            json(value: unknown) {
            corpo = value;
            return this;
            },
        };

        await getCheckoutOperacao(req, res);

        return { statusHttp, corpo };
        }

        const dono = await consultar(
        usuarioId!,
        "Atleta"
        );

        assert.equal(
        dono.statusHttp,
        200,
        JSON.stringify(dono.corpo)
        );

        assert.equal(
        dono.corpo?.operacao?.pagamentoId,
        primeiro.pagamento.id
        );

        const usuarioDiferente = await consultar(
        randomUUID(),
        "Atleta"
        );

        assert.equal(
        usuarioDiferente.statusHttp,
        404
        );

        const contextoDiferente = await consultar(
        usuarioId!,
        "Professor"
        );

        assert.equal(
        contextoDiferente.statusHttp,
        404
        );
    }
    );

  } finally {
    try {
      for (const id of operacoesCriadas) {
        const op = await prisma.billingCheckoutOperacao.findUnique({ where: { id } });
        if (!op) continue;
        if (op.status === "FALHA_COMPROVADA") throw new Error(`QA_CLEANUP_ABORTADO: operacao ${id} exige auditoria`);
        await prisma.billingCheckoutOperacao.delete({ where: { id } });
      }
      for (const id of pagamentosCriados) {
        const pg=await prisma.pagamento.findUnique({where:{id},include:{beneficios:true}});
        if (!pg) continue;
        if (pg.status!=='PENDENTE' || pg.provider!=='INTERNAL_FAKE' && pg.provider!=='MERCADOPAGO' || pg.beneficios.length || pg.cupomId ||
            await prisma.creatorVenda.count({where:{pagamentoId:id}}) ||
            await prisma.cupomReserva.count({where:{pagamentoId:id}})) {
          throw new Error(`QA_CLEANUP_ABORTADO: pagamento ${id} mudou ou possui relações; preservar para auditoria`);
        }
        if (pg.provider === 'MERCADOPAGO' && !['990000000001','990000000002'].includes(String(pg.providerRef))) throw new Error('QA_CLEANUP_REFERENCIA_EXTERNA_INESPERADA');
        await prisma.pagamento.delete({where:{id}});
        console.log('[QA] Pagamento fake removido:',id);
      }
    } finally { await prisma.$disconnect(); }
  }
  console.log(`\nRESULTADO: ${aprovados}/${aprovados+falhas}`);
  if (falhas) process.exitCode=1;
}
main().catch(e=>{console.error('TESTE INTERROMPIDO:',e);process.exitCode=1;});