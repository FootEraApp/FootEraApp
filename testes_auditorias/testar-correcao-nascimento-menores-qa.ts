/** QA da transição de faixa etária de atletas: banco de testes EXCLUSIVO. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepararEvidenciaNascimentoQA } from "./testar-correcao-nascimento-evidencia-fixture-qa.js";

function exigirQA() {
  const u = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.NODE_ENV, 'test', 'NODE_ENV_DEVE_SER_TEST');
  assert.ok(['postgres:', 'postgresql:'].includes(u.protocol));
  assert.equal(u.hostname, '127.0.0.1');
  assert.equal(u.port, '5433');
  assert.equal(u.pathname, '/footera_billing_qa');
  assert.equal(process.env.MP_ACCESS_TOKEN ?? '', '');
  assert.equal(process.env.ENABLE_ACCOUNT_PURGE, 'false');
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, 'false');
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, 'false');
}
exigirQA();

async function main() {
  const { prisma } = await import('./server/prisma.js');
  const { solicitarCorrecaoNascimento, decidirCorrecaoNascimento } =
    await import('./server/services/correcaoNascimentoService.js');
  const ids: string[] = [];
  const marca = `qa_menores_${randomUUID().replace(/-/g, '')}`;
  const data = (s: string) => new Date(`${s}T00:00:00.000Z`);
  let n = 0;
  const ok = (cond: unknown, descricao: string) => {
    assert.ok(cond, descricao);
    console.log(`APROVADO ${String(++n).padStart(2, '0')} — ${descricao}`);
  };
  const hoje = new Date();
  const dataAnosAtras = (anos: number) => {
    // Aniversário no início do ano, evitando ambiguidades do dia da execução.
    const anoBR = Number(new Intl.DateTimeFormat('en-US', {timeZone:'America/Sao_Paulo',year:'numeric'}).format(hoje));
    return `${anoBR - anos}-01-15`;
  };
  const d13 = dataAnosAtras(13);
  const d11 = dataAnosAtras(11);
  const d12 = dataAnosAtras(12);

  async function usuario(sufixo: string, nascimento: string, tipo: 'Atleta'|'Responsavel' = 'Atleta') {
    const u = await prisma.usuario.create({ data: {
      id: randomUUID(), nome:`QA menor ${sufixo}`,
      nomeDeUsuario:`${marca}_${sufixo}`.slice(0, 64),
      email:`${marca}_${sufixo}@example.invalid`, senhaHash:`QA_${marca}`,
      tipo, verified:true, dataNascimento:data(nascimento),
      aniversarioElegivelApartirDe:new Date(Date.now()-60*86400000),
    }});
    ids.push(u.id);
    return u;
  }
  async function atleta(usuarioId: string, nascimento: string, idade: number) {
    return prisma.atleta.create({data: {
      usuarioId, idade, categoria:['Livre'], dataNascimento:data(nascimento),
    }});
  }
  async function solicitar(usuarioId: string, nascimento: string) {
    return solicitarCorrecaoNascimento({ usuarioId, dataSolicitada:nascimento,
      motivo:'Solicitação fictícia para validar a segurança de menores no QA.' });
  }
  async function aprovar(solicitacaoId: string, adminId: string) {
    return decidirCorrecaoNascimento({solicitacaoId, administradorId:adminId,
      decisao:'APROVAR', motivoDecisao:'Verificação documental fictícia validada em QA.',
      verificacaoRef:`QA_MENORES_${marca}`, confirmacaoDocumental:true});
  }
  try {
    const banco = await prisma.$queryRaw<Array<{nome:string}>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome,'footera_billing_qa');
    console.log('[QA] Banco confirmado:',banco[0]?.nome);

    const admin = await usuario('admin', '1990-01-15');
    await prisma.administrador.create({data:{usuarioId:admin.id,cargo:'QA',nivel:'Performance'}});
    const alvo = await usuario('transicao',d13);
    const atletaAlvo = await atleta(alvo.id,d13,13);
    const responsavel = await usuario('responsavel','1985-01-15','Responsavel');
    await prisma.usuarioPapel.create({data:{usuarioId:responsavel.id,papel:'Responsavel',status:'ATIVO'}});
    const pedido = await solicitar(alvo.id,d11);
    await prepararEvidenciaNascimentoQA(prisma, pedido.id, admin.id);

    let erro: any = null;
    try { await aprovar(pedido.id,admin.id); } catch(e) { erro=e; }
    ok(erro?.code==='PRIMARY_GUARDIAN_REQUIRED_FOR_BIRTH_DATE',
       '13 para 11 anos sem responsável principal é bloqueado');
    const antes = await prisma.usuario.findUniqueOrThrow({where:{id:alvo.id}});
    ok(antes.dataNascimento?.toISOString().slice(0,10)===d13,
       'Bloqueio preserva data antiga');
    ok((await prisma.solicitacaoCorrecaoNascimento.findUniqueOrThrow({where:{id:pedido.id}})).status==='PENDENTE_VERIFICACAO',
       'Solicitação permanece pendente para regularização');
    ok((await prisma.logAuditoria.count({where:{entidadeId:pedido.id,acao:'CORRECAO_NASCIMENTO_APROVADA'}}))===0,
       'Bloqueio não produz auditoria falsa');

    await prisma.responsavelAtleta.create({data:{
      atletaId:atletaAlvo.id,responsavelUsuarioId:responsavel.id,
      status:'ATIVO',principal:true,confirmadoEm:new Date(),
    }});
    await aprovar(pedido.id,admin.id);
    const depois = await prisma.usuario.findUniqueOrThrow({where:{id:alvo.id}});
    const atletaDepois = await prisma.atleta.findUniqueOrThrow({where:{id:atletaAlvo.id}});
    ok(depois.dataNascimento?.toISOString().slice(0,10)===d11,
       'Correção com responsável principal confirmado é aprovada');
    ok(atletaDepois.idade===11 && atletaDepois.dataNascimento?.toISOString().slice(0,10)===d11,
       'Idade e nascimento do atleta sincronizados');
    ok(depois.tokenVersion===antes.tokenVersion+1,
       'Sessões do atleta que passou a menor de 12 anos foram invalidadas');
    ok((await prisma.logAuditoria.count({where:{entidadeId:pedido.id,acao:'CORRECAO_NASCIMENTO_APROVADA'}}))===1,
       'Aprovação gera uma auditoria');

    const alvo12 = await usuario('maior12',d11);
    const atleta12 = await atleta(alvo12.id,d11,11);
    const pedido12 = await solicitar(alvo12.id,d12);
    await prepararEvidenciaNascimentoQA(prisma, pedido12.id, admin.id);
    await aprovar(pedido12.id,admin.id);
    const maior = await prisma.atleta.findUniqueOrThrow({where:{id:atleta12.id}});
    ok(maior.idade===12,'11 para 12 anos é aprovado sem desvinculação automática');
    ok((await prisma.responsavelAtleta.count({where:{atletaId:atleta12.id}}))===0,
       'Correção para 12 anos não cria ou remove vínculos');

    console.log(`\nRESULTADO: ${n}/${n} verificações QA aprovadas.`);
  } finally {
    try {
      if (ids.length) {
        await prisma.logAuditoria.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.solicitacaoCorrecaoNascimento.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.responsavelAtleta.deleteMany({where:{OR:[{responsavelUsuarioId:{in:ids}},{atleta:{usuarioId:{in:ids}}}]}});
        await prisma.atleta.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.administrador.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.usuarioPapel.deleteMany({where:{usuarioId:{in:ids}}});
        await prisma.usuario.deleteMany({where:{id:{in:ids}}});
      }
      console.log('LIMPEZA_QA: fixtures desta execução removidas.');
    } finally { await prisma.$disconnect(); }
  }
}
main().catch(e=>{console.error('FALHOU_TESTE_MENORES_QA:',e);process.exitCode=1;});