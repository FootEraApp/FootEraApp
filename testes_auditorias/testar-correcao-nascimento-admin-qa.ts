/** FootEra — QA administrativo de correção de nascimento.
 * Apenas 127.0.0.1:5433/footera_billing_qa; sem Mercado Pago real.
 * Testa o serviço transacional. NÃO substitui testes HTTP de autenticação.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepararEvidenciaNascimentoQA } from "./testar-correcao-nascimento-evidencia-fixture-qa.js";

function exigirQa() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.NODE_ENV, 'test', 'NODE_ENV_DEVE_SER_TEST');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '5433');
  assert.equal(url.pathname, '/footera_billing_qa');
  assert.equal(process.env.MP_ACCESS_TOKEN ?? '', '');
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, 'false');
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, 'false');
}
exigirQa();

async function main() {
  const { prisma } = await import('./server/prisma.js');
  const {
    solicitarCorrecaoNascimento,
    decidirCorrecaoNascimento,
  } = await import('./server/services/correcaoNascimentoService.js');

  const marcador = `qa_nascimento_${randomUUID().replace(/-/g, '')}`;
  const ids: string[] = [];
  let aprovados = 0;
  const ok = (condicao: unknown, titulo: string) => {
    assert.ok(condicao, titulo);
    console.log(`APROVADO ${String(++aprovados).padStart(2, '0')} — ${titulo}`);
  };
  const data = (s: string) => new Date(`${s}T00:00:00.000Z`);

  async function criarUsuario(papel: string) {
    const id = randomUUID();
    const u = await prisma.usuario.create({
      data: {
        id,
        nome: `QA Nascimento ${papel}`,
        nomeDeUsuario: `${marcador}_${papel}`.slice(0, 64),
        email: `${marcador}_${papel}@example.invalid`,
        senhaHash: `QA_${marcador}`,
        tipo: 'Atleta',
        verified: true,
        dataNascimento: data('1990-05-17'),
        aniversarioElegivelApartirDe: new Date(Date.now() - 60 * 86400000),
      },
    });
    ids.push(u.id);
    return u;
  }

  try {
    const db = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome, 'footera_billing_qa');

    const admin = await criarUsuario('admin');
    const alvo = await criarUsuario('aprovado');
    const recusado = await criarUsuario('recusado');
    const semPermissao = await criarUsuario('sempermissao');

    await prisma.administrador.create({
      data: { usuarioId: admin.id, cargo: 'QA', nivel: 'Performance' },
    });

    await prisma.atleta.create({
      data: {
        usuarioId: alvo.id,
        idade: 36,
        categoria: ['Livre'],
        dataNascimento: data('1990-05-17'),
      },
    });

    const s = await solicitarCorrecaoNascimento({
      usuarioId: alvo.id,
      dataSolicitada: '1991-05-17',
      motivo: 'Correção de nascimento para validação administrativa QA.',
    });
    ok(s.status === 'PENDENTE_VERIFICACAO', 'Solicitação criada como pendente');

    await assert.rejects(
      decidirCorrecaoNascimento({
        solicitacaoId: s.id,
        administradorId: semPermissao.id,
        decisao: 'APROVAR',
        motivoDecisao: 'Solicitação testada sem permissão.',
        verificacaoRef: 'QA-DOC-VALIDADO-123',
        confirmacaoDocumental: true,
      }),
      (e: any) => e?.code === 'ADMIN_REQUIRED',
    );
    ok(true, 'Usuário comum não consegue aprovar pelo serviço');

    await assert.rejects(
      decidirCorrecaoNascimento({
        solicitacaoId: s.id,
        administradorId: admin.id,
        decisao: 'APROVAR',
        motivoDecisao: 'Tentativa de aprovação sem documento.',
      }),
      (e: any) => e?.code === 'DOCUMENT_VERIFICATION_REQUIRED',
    );
    ok(true, 'Aprovação sem confirmação documental bloqueada');


    // Declaração de conferência sem arquivo não deve autorizar aprovação.
    await assert.rejects(
      decidirCorrecaoNascimento({
        solicitacaoId: s.id, administradorId: admin.id, decisao: 'APROVAR',
        motivoDecisao: 'Tentativa sem documento persistido.',
        verificacaoRef: 'QA-SEM-ARQUIVO-123', confirmacaoDocumental: true,
      }),
      (e: any) => e?.code === 'BIRTH_DOCUMENT_REQUIRED',
    );
    ok(true, 'Aprovação apenas com checkbox e referência é bloqueada');

    await prepararEvidenciaNascimentoQA(prisma, s.id, admin.id);

    const decisao = await decidirCorrecaoNascimento({
      solicitacaoId: s.id,
      administradorId: admin.id,
      decisao: 'APROVAR',
      motivoDecisao: 'Referência de verificação fictícia para QA.',
      verificacaoRef: 'QA-DOC-VALIDADO-123',
      confirmacaoDocumental: true,
      ip: '127.0.0.1',
      userAgent: 'footera-qa',
    });
    ok(decisao.status === 'APROVADA', 'Correção aprovada');

    const [usuarioAtual, atletaAtual, solicitacaoAtual, logs] = await Promise.all([
      prisma.usuario.findUniqueOrThrow({ where: { id: alvo.id } }),
      prisma.atleta.findUniqueOrThrow({ where: { usuarioId: alvo.id } }),
      prisma.solicitacaoCorrecaoNascimento.findUniqueOrThrow({ where: { id: s.id } }),
      prisma.logAuditoria.findMany({
        where: { usuarioId: admin.id, entidadeId: s.id, acao: 'CORRECAO_NASCIMENTO_APROVADA' },
      }),
    ]);
    ok(usuarioAtual.dataNascimento?.toISOString().slice(0, 10) === '1991-05-17', 'Nascimento da conta atualizado');
    ok(atletaAtual.dataNascimento?.toISOString().slice(0, 10) === '1991-05-17', 'Nascimento do atleta sincronizado');
    ok(atletaAtual.idade === 35, 'Idade do atleta recalculada');
    ok(
      !!usuarioAtual.aniversarioElegivelApartirDe &&
      usuarioAtual.aniversarioElegivelApartirDe.getTime() >= Date.now() + 29 * 86400000,
      'Nova carência de pelo menos 30 dias aproximadamente aplicada',
    );
    ok(solicitacaoAtual.revisadoPorId === admin.id && !!solicitacaoAtual.verificadoEm, 'Revisor e verificação registrados');
    ok(logs.length === 1, 'Auditoria obrigatória criada uma vez');

    await assert.rejects(
      decidirCorrecaoNascimento({
        solicitacaoId: s.id,
        administradorId: admin.id,
        decisao: 'APROVAR',
        motivoDecisao: 'Segunda tentativa de aprovação da solicitação.',
        verificacaoRef: 'QA-DOC-VALIDADO-123',
        confirmacaoDocumental: true,
      }),
      (e: any) => e?.code === 'REQUEST_ALREADY_DECIDED',
    );
    ok(true, 'Segunda aprovação rejeitada');

    const sr = await solicitarCorrecaoNascimento({
      usuarioId: recusado.id,
      dataSolicitada: '1992-05-17',
      motivo: 'Solicitação de teste que deve ser recusada pela administração.',
    });
    const dr = await decidirCorrecaoNascimento({
      solicitacaoId: sr.id,
      administradorId: admin.id,
      decisao: 'REJEITAR',
      motivoDecisao: 'Documentação de teste considerada insuficiente.',
    });
    const recusadoAtual = await prisma.usuario.findUniqueOrThrow({ where: { id: recusado.id } });
    ok(dr.status === 'REJEITADA', 'Solicitação recusada');
    ok(recusadoAtual.dataNascimento?.toISOString().slice(0, 10) === '1990-05-17', 'Recusa preserva o nascimento original');

    console.log(`\nRESULTADO: ${aprovados}/${aprovados} verificações aprovadas.`);
    console.log('NÃO COBERTO: autenticação HTTP, armazenamento documental real, falha forçada de auditoria, concorrência e homologação.');
  } finally {
    try {
      // Limpeza somente dos IDs criados neste processo, sem exclusão genérica.
      await prisma.logAuditoria.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.solicitacaoCorrecaoNascimento.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.atleta.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.administrador.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      console.log('LIMPEZA_QA: fixtures desta execução removidas.');
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch(e => {
  console.error('CORRECAO_NASCIMENTO_ADMIN_QA_FALHOU:', e);
  process.exitCode = 1;
});