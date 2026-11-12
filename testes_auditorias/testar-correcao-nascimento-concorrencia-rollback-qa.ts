/**
 * FOOTERA — QA de concorrência e rollback da correção de nascimento.
 * Usa exclusivamente banco 127.0.0.1:5433/footera_billing_qa.
 * Não chama Mercado Pago e não toca no banco footera.
 * Cria trigger temporário restrito a UM UUID QA para forçar falha de auditoria.
 * Remove trigger/função e fixtures no finally.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepararEvidenciaNascimentoQA } from "./testar-correcao-nascimento-evidencia-fixture-qa.js";

function exigirQa() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.NODE_ENV, 'test', 'NODE_ENV_DEVE_SER_TEST');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'PROTOCOLO_QA_INVALIDO');
  assert.equal(url.hostname, '127.0.0.1', 'HOST_QA_INVALIDO');
  assert.equal(url.port, '5433', 'PORTA_QA_INVALIDA');
  assert.equal(url.pathname, '/footera_billing_qa', 'BANCO_QA_INVALIDO');
  assert.equal(process.env.MP_ACCESS_TOKEN ?? '', '', 'MP_REAL_PROIBIDO');
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, 'false');
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, 'false');
  assert.equal(process.env.ENABLE_ACCOUNT_PURGE, 'false');
}
exigirQa();

async function main() {
  const { prisma } = await import('./server/prisma.js');
  const { solicitarCorrecaoNascimento, decidirCorrecaoNascimento } =
    await import('./server/services/correcaoNascimentoService.js');
  const ids: string[] = [];
  const marcador = `qa_nasc_cr_${randomUUID().replace(/-/g, '')}`;
  let verificacoes = 0;
  const ok = (condicao: unknown, mensagem: string) => {
    assert.ok(condicao, mensagem);
    console.log(`APROVADO ${String(++verificacoes).padStart(2, '0')} — ${mensagem}`);
  };
  const data = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const nomeSQL = `qa_nasc_${randomUUID().replace(/-/g, '')}`; // só a-z, 0-9, underscore
  const nomeFuncao = `${nomeSQL}_fn`;
  const nomeTrigger = `${nomeSQL}_trg`;
  let triggerCriado = false;
  let funcaoCriada = false;
  let concluido = false;

  async function criarUsuario(sufixo: string) {
    const usuario = await prisma.usuario.create({
      data: {
        nome: `QA Nascimento ${sufixo}`,
        nomeDeUsuario: `${marcador}_${sufixo}`.slice(0, 64),
        email: `${marcador}_${sufixo}@example.invalid`,
        senhaHash: `QA_${marcador}`,
        tipo: 'Atleta',
        verified: true,
        dataNascimento: data('1990-05-17'),
        aniversarioElegivelApartirDe: new Date(Date.now() - 60 * 86400000),
      },
    });
    ids.push(usuario.id);
    return usuario;
  }

  const decidir = (solicitacaoId: string, administradorId: string) =>
    decidirCorrecaoNascimento({
      solicitacaoId,
      administradorId,
      decisao: 'APROVAR',
      motivoDecisao: 'Confirmação documental simulada exclusivamente no QA.',
      verificacaoRef: 'QA-CONFERENCIA-DOCUMENTAL-123',
      confirmacaoDocumental: true,
    });

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, 'footera_billing_qa');

    const admin = await criarUsuario('admin');
    const concorrente = await criarUsuario('concorrente');
    const rollback = await criarUsuario('rollback');
    await prisma.administrador.create({
      data: { usuarioId: admin.id, cargo: 'QA', nivel: 'Performance' },
    });
    const sc = await solicitarCorrecaoNascimento({
      usuarioId: concorrente.id,
      dataSolicitada: '1991-05-17',
      motivo: 'Teste de duas decisões simultâneas na mesma solicitação.',
    });
    await prepararEvidenciaNascimentoQA(prisma, sc.id, admin.id);

    const resultados = await Promise.allSettled([
      decidir(sc.id, admin.id),
      decidir(sc.id, admin.id),
    ]);
    console.log('[QA] Decisões simultâneas:', resultados.map(r => r.status === 'fulfilled'
      ? { status: 'fulfilled', decisao: r.value.status }
      : { status: 'rejected', erro: String((r.reason as any)?.code ?? (r.reason as any)?.message ?? r.reason) }));
    const sucessos = resultados.filter(r => r.status === 'fulfilled');
    const falhas = resultados.filter(r => r.status === 'rejected');
    ok(sucessos.length === 1 && falhas.length === 1,
      'Exatamente uma decisão foi aceita entre duas chamadas concorrentes');
    const [estadoConcorrente, pedidoConcorrente, logsConcorrentes] = await Promise.all([
      prisma.usuario.findUniqueOrThrow({ where: { id: concorrente.id } }),
      prisma.solicitacaoCorrecaoNascimento.findUniqueOrThrow({ where: { id: sc.id } }),
      prisma.logAuditoria.findMany({ where: { entidadeId: sc.id, acao: 'CORRECAO_NASCIMENTO_APROVADA' } }),
    ]);
    ok(estadoConcorrente.dataNascimento?.toISOString().slice(0,10) === '1991-05-17',
      'Conta atualizada após disputa');
    ok(pedidoConcorrente.status === 'APROVADA', 'Solicitação ficou aprovada');
    ok(logsConcorrentes.length === 1, 'Exatamente uma auditoria de aprovação');

    const sr = await solicitarCorrecaoNascimento({
      usuarioId: rollback.id,
      dataSolicitada: '1992-05-17',
      motivo: 'Forçar falha na gravação de auditoria e provar rollback integral.',
    });
    await prepararEvidenciaNascimentoQA(prisma, sr.id, admin.id);

    // Trigger estritamente limitado a esta solicitação QA, em banco QA.
    // Identificadores de DDL são formados somente por caracteres seguros acima.
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${nomeFuncao}"() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'QA_AUDITORIA_FORCADA';
      END $$;
    `);
    funcaoCriada = true;
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${nomeTrigger}"
      BEFORE INSERT ON "LogAuditoria"
      FOR EACH ROW WHEN (NEW."entidadeId" = '${sr.id}')
      EXECUTE FUNCTION "${nomeFuncao}"();
    `);
    triggerCriado = true;

    let auditoriaFalhou = false;
    try {
      await decidir(sr.id, admin.id);
    } catch (erro: any) {
      auditoriaFalhou = true;
      console.log('[QA] Falha de auditoria induzida:', String(erro?.message ?? erro).slice(0, 400));
    }
    ok(auditoriaFalhou, 'Falha obrigatória de auditoria cancela a decisão');
    const [contaRollback, pedidoRollback, logsRollback] = await Promise.all([
      prisma.usuario.findUniqueOrThrow({ where: { id: rollback.id } }),
      prisma.solicitacaoCorrecaoNascimento.findUniqueOrThrow({ where: { id: sr.id } }),
      prisma.logAuditoria.count({ where: { entidadeId: sr.id, acao: 'CORRECAO_NASCIMENTO_APROVADA' } }),
    ]);
    ok(contaRollback.dataNascimento?.toISOString().slice(0, 10) === '1990-05-17',
      'Rollback preservou o nascimento anterior');
    ok(pedidoRollback.status === 'PENDENTE_VERIFICACAO' && !pedidoRollback.revisadoEm,
      'Rollback preservou o estado pendente da solicitação');
    ok(logsRollback === 0, 'Falha de auditoria não deixou log de aprovação parcial');

    // Remove o gatilho ANTES de sair, para validar a recuperação da operação.
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nomeTrigger}" ON "LogAuditoria"`);
    triggerCriado = false;
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nomeFuncao}"()`);
    funcaoCriada = false;
    const segundaTentativa = await decidir(sr.id, admin.id);
    ok(segundaTentativa.status === 'APROVADA', 'Solicitação pode ser aprovada após normalizar auditoria');

    concluido = true;
    console.log(`\nRESULTADO: ${verificacoes}/${verificacoes} verificações aprovadas.`);
    console.log('NÃO COBERTO: permissões HTTP, verificação documental real e concorrência entre múltiplas instâncias.');
  } finally {
    // Remoção do trigger sempre acontece antes da limpeza de fixtures.
    try {
      if (triggerCriado) {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${nomeTrigger}" ON "LogAuditoria"`);
        triggerCriado = false;
      }
      if (funcaoCriada) {
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${nomeFuncao}"()`);
        funcaoCriada = false;
      }
      await prisma.logAuditoria.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.solicitacaoCorrecaoNascimento.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.administrador.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      console.log('LIMPEZA_QA: trigger temporário, função e fixtures removidos.');
    } finally {
      await prisma.$disconnect();
    }
  }
  if (!concluido) throw new Error('TESTE_NAO_CONCLUIDO');
}
main().catch(erro => {
  console.error('CORRECAO_NASCIMENTO_CONCORRENCIA_ROLLBACK_QA_FALHOU:', erro);
  process.exitCode = 1;
});