// server/services/billingEstornoAdministrativoService.ts
// Autorizações administrativas. NÃO executa HTTP nem estorno.
import { Prisma, BillingAutorizacaoEstornoStatus as Status } from "@prisma/client";
import { prisma } from "../prisma.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPCOES = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10000,
  timeout: 15000,
} as const;

type PapelFinanceiro = "SOLICITAR" | "APROVAR" | "EXECUTAR";

function listaAutorizada(papel: PapelFinanceiro): Set<string> {
  const variavel = papel === "SOLICITAR"
    ? "BILLING_REFUND_REQUESTER_IDS"
    : papel === "APROVAR"
      ? "BILLING_REFUND_APPROVER_IDS"
      : "BILLING_REFUND_EXECUTOR_IDS";
  return new Set(
    (process.env[variavel] ?? "")
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => UUID.test(id))
  );
}

async function exigirOperador(usuarioId: string, papel: PapelFinanceiro) {
  if (!UUID.test(usuarioId) || !listaAutorizada(papel).has(usuarioId.toLowerCase())) {
    throw new Error("BILLING_OPERADOR_FINANCEIRO_NAO_AUTORIZADO");
  }
  const admin = await prisma.administrador.findUnique({
    where: { usuarioId },
    select: { usuarioId: true, usuario: { select: { deletedAt: true } } },
  });
  if (!admin || admin.usuario.deletedAt) {
    throw new Error("BILLING_OPERADOR_ADMIN_INATIVO");
  }
}

export async function validarExecutorEstorno(usuarioId: string): Promise<void> {
  await exigirOperador(usuarioId, "EXECUTAR");
}

export async function validarConsultorEstorno(
  usuarioId: string
): Promise<void> {
  const papeis: PapelFinanceiro[] = [
    "SOLICITAR",
    "APROVAR",
    "EXECUTAR",
  ];

  const papelAutorizado = papeis.find(
    (papel) =>
      listaAutorizada(papel).has(usuarioId.toLowerCase())
  );

  if (!papelAutorizado) {
    throw new Error(
      "BILLING_OPERADOR_FINANCEIRO_NAO_AUTORIZADO"
    );
  }

  await exigirOperador(usuarioId, papelAutorizado);
}

function limiteCentavos(): number {
  const s = process.env.BILLING_REFUND_MAX_CENTAVOS ?? "";
  const n = Number(s);
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(n) || n <= 0) {
    throw new Error("BILLING_LIMITE_ESTORNO_NAO_CONFIGURADO");
  }
  return n;
}

async function bloquearPagamento(tx: Prisma.TransactionClient, pagamentoId: string) {
  const linhas = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Pagamento" WHERE "id" = ${pagamentoId} FOR UPDATE
  `;
  if (linhas.length !== 1) throw new Error("BILLING_PAGAMENTO_NAO_ENCONTRADO");
}

async function obterBaseValida(tx: Prisma.TransactionClient, pagamentoId: string) {
  const c = await tx.billingCompensacaoEvento.findUnique({
    where: { pagamentoId },
    include: { pagamento: true, pendencia: true, historicoTentativas: true },
  });
  if (!c) throw new Error("BILLING_COMPENSACAO_NAO_ENCONTRADA");
  const centavos = c.valor.mul(100).toNumber();
  if (
    c.status !== "PREPARADA" || c.confirmadoEm !== null || c.tentativas !== 0 ||
    c.historicoTentativas.length !== 0 ||
    c.chaveIdempotencia !== `footera-evento-refund-${pagamentoId}` ||
    c.pagamento.status !== "PENDENTE" || c.pagamento.reembolsadoEm !== null ||
    c.pagamento.provider !== "MERCADOPAGO" ||
    c.pagamento.providerRef !== c.providerRef || !/^\d+$/.test(c.providerRef) ||
    c.pagamento.plano !== `EVENTO:${c.pendencia.eventoId}` ||
    c.pendencia.pagamentoId !== pagamentoId || c.pendencia.providerRef !== c.providerRef ||
    c.pendencia.motivo !== "BILLING_EVENT_CAPACITY_EXCEEDED" ||
    !["PENDENTE_ANALISE", "EM_ANALISE"].includes(c.pendencia.status) ||
    c.pendencia.resolvidoEm !== null ||
    c.moeda !== "BRL" || c.pagamento.moeda !== "BRL" || c.pendencia.moeda !== "BRL" ||
    !c.pagamento.valor.equals(c.valor) || !c.pendencia.valor.equals(c.valor) ||
    !Number.isSafeInteger(centavos) || centavos <= 0 || centavos > limiteCentavos()
  ) throw new Error("BILLING_COMPENSACAO_NAO_ELEGIVEL_APROVACAO");
  const [beneficios, inscricoes] = await Promise.all([
    tx.pagamentoBeneficio.count({ where: { pagamentoId } }),
    tx.inscricaoEvento.count({ where: {
      eventoId: c.pendencia.eventoId,
      usuarioId: c.pagamento.usuarioId,
      status: { not: "CANCELADA" },
    } }),
  ]);
  if (beneficios || inscricoes) throw new Error("BILLING_COMPENSACAO_ACESSO_EXISTENTE");
  return c;
}

async function registrarAuditoria(
  tx: Prisma.TransactionClient, usuarioId: string, pagamentoId: string,
  acao: string, autorizacaoId: string
) {
  // Obrigatório: falha de gravação desfaz a transação.
  await tx.logAuditoria.create({ data: {
    usuarioId, acao, entidade: "BillingAutorizacaoEstorno", entidadeId: autorizacaoId,
    descricao: `Pagamento ${pagamentoId}`,
    meta: { pagamentoId, autorizacaoId },
  } });
}

export async function solicitarAutorizacaoEstorno(
  pagamentoId: string, solicitanteId: string, motivo: string
) {
  if (!UUID.test(pagamentoId)) throw new Error("BILLING_PAGAMENTO_ID_INVALIDO");
  if (typeof motivo !== "string" || motivo.trim().length < 20 || motivo.trim().length > 1000) {
    throw new Error("BILLING_MOTIVO_INVALIDO");
  }
  await exigirOperador(solicitanteId, "SOLICITAR");
  return prisma.$transaction(async (tx) => {
    await bloquearPagamento(tx, pagamentoId);
    const c = await obterBaseValida(tx, pagamentoId);
    const existente = await tx.billingAutorizacaoEstorno.findUnique({ where: { pagamentoId } });
    if (existente) throw new Error("BILLING_AUTORIZACAO_JA_EXISTENTE");
    const registro = await tx.billingAutorizacaoEstorno.create({ data: {
      pagamentoId, solicitanteId, motivo: motivo.trim(), valor: c.valor,
      moeda: c.moeda, providerRef: c.providerRef, status: Status.PENDENTE,
    } });
    await registrarAuditoria(tx, solicitanteId, pagamentoId, "BILLING_ESTORNO_SOLICITADO", registro.id);
    return registro;
  }, OPCOES);
}

export async function aprovarAutorizacaoEstorno(pagamentoId: string, aprovadorId: string) {
  if (!UUID.test(pagamentoId)) throw new Error("BILLING_PAGAMENTO_ID_INVALIDO");
  await exigirOperador(aprovadorId, "APROVAR");
  return prisma.$transaction(async (tx) => {
    await bloquearPagamento(tx, pagamentoId);
    const c = await obterBaseValida(tx, pagamentoId);
    const a = await tx.billingAutorizacaoEstorno.findUnique({ where: { pagamentoId } });
    if (!a || a.status !== Status.PENDENTE || a.aprovadorId ||
        a.solicitanteId === aprovadorId || a.consumidoEm || a.revogadoEm ||
        a.moeda !== c.moeda || a.providerRef !== c.providerRef || !a.valor.equals(c.valor)) {
      throw new Error("BILLING_AUTORIZACAO_NAO_APROVAVEL");
    }
    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + 30 * 60 * 1000);
    const atualizado = await tx.billingAutorizacaoEstorno.updateMany({
      where: { id: a.id, status: Status.PENDENTE, aprovadorId: null },
      data: { status: Status.APROVADA, aprovadorId, aprovadoEm: agora, expiraEm },
    });
    if (atualizado.count !== 1) throw new Error("BILLING_APROVACAO_CONCORRENTE");
    await registrarAuditoria(tx, aprovadorId, pagamentoId, "BILLING_ESTORNO_APROVADO", a.id);
    return { pagamentoId, autorizacaoId: a.id, expiraEm };
  }, OPCOES);
}

export async function revogarAutorizacaoEstorno(pagamentoId: string, operadorId: string) {
  if (!UUID.test(pagamentoId)) throw new Error("BILLING_PAGAMENTO_ID_INVALIDO");
  await exigirOperador(operadorId, "APROVAR");
  return prisma.$transaction(async (tx) => {
    await bloquearPagamento(tx, pagamentoId);
    const a = await tx.billingAutorizacaoEstorno.findUnique({ where: { pagamentoId } });
    if (
        !a ||
        (
            a.status !== Status.PENDENTE &&
            a.status !== Status.APROVADA
        )
        ) {
        throw new Error("BILLING_AUTORIZACAO_NAO_REVOGAVEL");
        }
    const atualizado = await tx.billingAutorizacaoEstorno.updateMany({
      where: { id: a.id, status: a.status, consumidoEm: null },
      data: { status: Status.REVOGADA, revogadoEm: new Date() },
    });
    if (atualizado.count !== 1) throw new Error("BILLING_REVOGACAO_CONCORRENTE");
    await registrarAuditoria(tx, operadorId, pagamentoId, "BILLING_ESTORNO_REVOGADO", a.id);
    return { pagamentoId, revogada: true };
  }, OPCOES);
}

export async function consultarAutorizacaoEstorno(
  pagamentoId: string,
  operadorId: string
) {
  if (!UUID.test(pagamentoId)) {
    throw new Error("BILLING_PAGAMENTO_ID_INVALIDO");
  }

  await validarConsultorEstorno(operadorId);

  return prisma.billingAutorizacaoEstorno.findUnique({
    where: { pagamentoId },
  });
}

export async function consumirAutorizacaoEstornoNaAquisicao(
  tx: Prisma.TransactionClient,
  pagamentoId: string,
  valor: Prisma.Decimal,
  providerRef: string,
  executorId: string
): Promise<void> {
  const agora = new Date();
  const atualizado = await tx.billingAutorizacaoEstorno.updateMany({
    where: {
      pagamentoId, status: Status.APROVADA, aprovadoEm: { not: null },
      aprovadorId: { not: null }, expiraEm: { gt: agora },
      consumidoEm: null, revogadoEm: null, valor, moeda: "BRL", providerRef,
    },
    data: { status: Status.CONSUMIDA, consumidoEm: agora },
  });
  if (atualizado.count !== 1) throw new Error("BILLING_AUTORIZACAO_FINANCEIRA_NAO_CONSUMIDA");
  const a = await tx.billingAutorizacaoEstorno.findUniqueOrThrow({ where: { pagamentoId } });
  if (a.solicitanteId === a.aprovadorId) throw new Error("BILLING_DUPLA_APROVACAO_INVALIDA");
  await registrarAuditoria(tx, executorId, pagamentoId, "BILLING_ESTORNO_AUTORIZACAO_CONSUMIDA", a.id);
}

/**
 * ETAPA 4 — Verificação prévia, somente leitura.
 *
 * Evita preparar uma tentativa quando não existe
 * autorização administrativa válida.
 *
 * A validação definitiva continua obrigatória
 * dentro da transação de aquisição financeira.
 */
export async function validarAutorizacaoEstornoAntesDoPreparo(
  pagamentoId: string,
  executorId: string
): Promise<void> {
  if (!UUID.test(pagamentoId)) {
    throw new Error("BILLING_PAGAMENTO_ID_INVALIDO");
  }

  await validarExecutorEstorno(executorId);

  const autorizacao =
    await prisma.billingAutorizacaoEstorno.findUnique({
      where: { pagamentoId },
      include: {
        pagamento: {
          include: {
            compensacaoEvento: true,
            pendenciaEvento: true,
          },
        },
      },
    });

  if (!autorizacao) {
    throw new Error(
      "BILLING_AUTORIZACAO_FINANCEIRA_AUSENTE"
    );
  }

  const agora = new Date();
  const pagamento = autorizacao.pagamento;
  const compensacao = pagamento.compensacaoEvento;
  const pendencia = pagamento.pendenciaEvento;

  if (
    autorizacao.status !== Status.APROVADA ||
    !autorizacao.aprovadoEm ||
    !autorizacao.aprovadorId ||
    !autorizacao.expiraEm ||
    autorizacao.expiraEm <= agora ||
    autorizacao.consumidoEm !== null ||
    autorizacao.revogadoEm !== null ||
    autorizacao.solicitanteId ===
      autorizacao.aprovadorId
  ) {
    throw new Error(
      "BILLING_AUTORIZACAO_FINANCEIRA_NAO_APROVADA"
    );
  }

  if (
    !compensacao ||
    !pendencia ||
    compensacao.status !== "PREPARADA" ||
    compensacao.tentativas !== 0 ||
    compensacao.confirmadoEm !== null ||
    pagamento.status !== "PENDENTE" ||
    pagamento.reembolsadoEm !== null ||
    pagamento.provider !== "MERCADOPAGO" ||
    pagamento.providerRef !== autorizacao.providerRef ||
    compensacao.providerRef !== autorizacao.providerRef ||
    pendencia.providerRef !== autorizacao.providerRef ||
    pagamento.plano !== `EVENTO:${pendencia.eventoId}` ||
    autorizacao.moeda !== "BRL" ||
    pagamento.moeda !== "BRL" ||
    compensacao.moeda !== "BRL" ||
    pendencia.moeda !== "BRL" ||
    !autorizacao.valor.equals(pagamento.valor) ||
    !autorizacao.valor.equals(compensacao.valor) ||
    !autorizacao.valor.equals(pendencia.valor)
  ) {
    throw new Error(
      "BILLING_AUTORIZACAO_DADOS_FINANCEIROS_DIVERGENTES"
    );
  }

  // Confere se os dois administradores ainda possuem
  // autorização financeira específica.
  await exigirOperador(
    autorizacao.solicitanteId,
    "SOLICITAR"
  );

  await exigirOperador(
    autorizacao.aprovadorId,
    "APROVAR"
  );
}