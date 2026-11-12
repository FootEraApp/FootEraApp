import { Prisma } from "@prisma/client";

export type PagamentoLocalConciliacao = {
  id: string;
  provider: string;
  providerRef: string | null;
  valor: Prisma.Decimal | number | string;
  moeda: string;
  status: string;
};

export type PagamentoMercadoPago = {
  id?: string | number;
  status?: string;
  status_detail?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
    } | null;
  } | null;
};

export type AcaoConciliacao =
  | "APROVAR"
  | "CANCELAR_PENDENTE"
  | "AGUARDAR"
  | "CONCILIACAO_MANUAL"
  | "JA_CONCILIADO";

export type ResultadoConciliacao = {
  acao: AcaoConciliacao;
  motivo: string;
  pagamentoId: string;
  providerRef: string | null;
  statusMp: string;
};

const ESTADOS_PENDENTES = new Set([
  "pending",
  "in_process",
  "authorized",
  "in_mediation",
]);

export function classificarConciliacaoMercadoPago(
  local: PagamentoLocalConciliacao,
  mp: PagamentoMercadoPago
): ResultadoConciliacao {
  const statusMp = String(
    mp.status ?? ""
  ).trim().toLowerCase();

  const providerRef =
    mp.id == null ? null : String(mp.id);

  const resultado = (
    acao: AcaoConciliacao,
    motivo: string
  ): ResultadoConciliacao => ({
    acao,
    motivo,
    pagamentoId: local.id,
    providerRef,
    statusMp,
  });

  if (
    local.provider !== "MERCADOPAGO" ||
    !providerRef ||
    !/^\d+$/.test(providerRef)
  ) {
    return resultado(
      "CONCILIACAO_MANUAL",
      "PROVEDOR_OU_ID_INVALIDO"
    );
  }

  const metadataId =
    mp.metadata?.pagamentoId ??
    mp.metadata?.pagamento_id;

  const identidades = [
    mp.external_reference,
    metadataId,
  ].filter(
    (v) => v != null && String(v).trim() !== ""
  );

  if (
    identidades.length === 0 ||
    identidades.some(
      (v) => String(v).trim() !== local.id
    )
  ) {
    return resultado(
      "CONCILIACAO_MANUAL",
      "IDENTIDADE_NAO_COMPROVADA"
    );
  }

  if (
    local.providerRef &&
    /^\d+$/.test(local.providerRef) &&
    local.providerRef !== providerRef
  ) {
    return resultado(
      "CONCILIACAO_MANUAL",
      "REFERENCIA_DIVERGENTE"
    );
  }

  const valorLocal =
    new Prisma.Decimal(local.valor);

  const valorMp = mp.transaction_amount;

  if (
    local.moeda !== "BRL" ||
    mp.currency_id !== local.moeda ||
    typeof valorMp !== "number" ||
    !Number.isFinite(valorMp) ||
    !new Prisma.Decimal(valorMp).equals(valorLocal)
  ) {
    return resultado(
      "CONCILIACAO_MANUAL",
      "VALOR_OU_MOEDA_DIVERGENTE"
    );
  }

  if (
    statusMp === "approved" &&
    mp.status_detail === "partially_refunded"
  ) {
    return resultado(
      "CONCILIACAO_MANUAL",
      "REEMBOLSO_PARCIAL"
    );
  }

  if (
    statusMp === "refunded" ||
    statusMp === "charged_back"
  ) {
    return resultado(
      "CONCILIACAO_MANUAL",
      "REVERSAO_FINANCEIRA"
    );
  }

  if (ESTADOS_PENDENTES.has(statusMp)) {
    return resultado(
      "AGUARDAR",
      "MP_NAO_FINALIZADO"
    );
  }

  if (statusMp === "approved") {
    if (mp.status_detail !== "accredited") {
        return resultado(
        "CONCILIACAO_MANUAL",
        "DETALHE_APROVACAO_NAO_CONFIRMADO"
        );
    }

    if (local.status === "APROVADO") {
      return resultado(
        "JA_CONCILIADO",
        "JA_APROVADO"
      );
    }

    if (local.status !== "PENDENTE") {
      return resultado(
        "CONCILIACAO_MANUAL",
        "APROVACAO_TARDIA"
      );
    }

    return resultado(
      "APROVAR",
      "MP_APROVADO"
    );
  }

  if (
    statusMp === "cancelled" ||
    statusMp === "rejected"
  ) {
    if (
      local.status === "CANCELADO" ||
      local.status === "FALHOU"
    ) {
      return resultado(
        "JA_CONCILIADO",
        "JA_ENCERRADO"
      );
    }

    if (local.status !== "PENDENTE") {
      return resultado(
        "CONCILIACAO_MANUAL",
        "CANCELAMENTO_TARDIO"
      );
    }

    return resultado(
      "CANCELAR_PENDENTE",
      "MP_CANCELADO"
    );
  }

  return resultado(
    "CONCILIACAO_MANUAL",
    "STATUS_DESCONHECIDO"
  );
}

export async function consultarPagamentoMercadoPago(
  paymentId: string,
  options: {
    token?: string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<PagamentoMercadoPago> {
  if (!/^\d+$/.test(paymentId)) {
    throw new Error("MP_PAYMENT_ID_INVALID");
  }

  const token =
    options.token ?? process.env.MP_ACCESS_TOKEN;

  if (!token) {
    throw new Error("MP_ACCESS_TOKEN_MISSING");
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `MP_QUERY_HTTP_${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error("MP_QUERY_INVALID_BODY");
  }

  return data as PagamentoMercadoPago;
}

export async function buscarPagamentoPorReferenciaExternaMercadoPago(
  pagamentoId: string,
  options: {
    token?: string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<PagamentoMercadoPago | null> {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuid.test(pagamentoId)) {
    throw new Error("MP_SEARCH_PAYMENT_ID_INVALID");
  }

  const token =
    options.token ?? process.env.MP_ACCESS_TOKEN;

  if (!token) {
    throw new Error("MP_ACCESS_TOKEN_MISSING");
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  const url = new URL(
    "https://api.mercadopago.com/v1/payments/search"
  );

  url.searchParams.set("external_reference", pagamentoId);
  url.searchParams.set("limit", "2");
  url.searchParams.set("offset", "0");
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");

  const resposta = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resposta.ok) {
    throw new Error(
      `MP_SEARCH_HTTP_${resposta.status}`
    );
  }

  const dados: unknown = await resposta.json();

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new Error("MP_SEARCH_INVALID_BODY");
  }

  const corpo = dados as Record<string, unknown>;

  if (!Array.isArray(corpo.results)) {
    throw new Error("MP_SEARCH_INVALID_RESULTS");
  }

  const paging =
    corpo.paging as Record<string, unknown> | undefined;

  const total = paging?.total;

  if (
    typeof total !== "number" ||
    !Number.isSafeInteger(total) ||
    total < 0
  ) {
    throw new Error("MP_SEARCH_TOTAL_UNKNOWN");
  }

  if (total === 0 && corpo.results.length === 0) {
    return null;
  }

  if (total !== 1 || corpo.results.length !== 1) {
    throw new Error("MP_SEARCH_AMBIGUOUS");
  }

  const encontrado: unknown = corpo.results[0];

  if (
    !encontrado ||
    typeof encontrado !== "object" ||
    Array.isArray(encontrado)
  ) {
    throw new Error("MP_SEARCH_INVALID_PAYMENT");
  }

  const pagamento = encontrado as PagamentoMercadoPago;

  if (
    !/^\d+$/.test(String(pagamento.id ?? "")) ||
    String(pagamento.external_reference ?? "") !==
      pagamentoId
  ) {
    throw new Error("MP_SEARCH_IDENTITY_MISMATCH");
  }

  return pagamento;
}

export type DiagnosticoBuscaCheckout = {
  consultada: boolean;
  acao: AcaoConciliacao;
  motivo: string;
};

export async function diagnosticarBuscaCheckoutSemReferencia(
  local: PagamentoLocalConciliacao,
  buscar: (
    pagamentoId: string
  ) => Promise<PagamentoMercadoPago | null> =
    buscarPagamentoPorReferenciaExternaMercadoPago
): Promise<DiagnosticoBuscaCheckout> {
  if (
    local.provider !== "MERCADOPAGO" ||
    local.status !== "PENDENTE" ||
    local.moeda !== "BRL"
  ) {
    return {
      consultada: false,
      acao: "CONCILIACAO_MANUAL",
      motivo: "ESTADO_FINANCEIRO_INCOMPATIVEL",
    };
  }

  if (local.providerRef?.trim()) {
    return {
      consultada: false,
      acao: "CONCILIACAO_MANUAL",
      motivo: "REFERENCIA_EXTERNA_JA_EXISTE",
    };
  }

  try {
    const encontrado = await buscar(local.id);

    if (!encontrado) {
      return {
        consultada: true,
        acao: "CONCILIACAO_MANUAL",
        motivo: "PAGAMENTO_NAO_LOCALIZADO_NA_BUSCA",
      };
    }

    const avaliacao = classificarConciliacaoMercadoPago(
      local,
      encontrado
    );

    return {
      consultada: true,
      acao: avaliacao.acao,
      motivo: avaliacao.motivo,
    };
  } catch {
    return {
      consultada: false,
      acao: "CONCILIACAO_MANUAL",
      motivo: "BUSCA_EXTERNA_INDISPONIVEL",
    };
  }
}

export type EstornoMercadoPago = {
  id?: string | number;
  payment_id?: string | number;
  amount?: number;
  status?: string;
  date_created?: string;
};

export async function consultarEstornosPagamentoMercadoPago(
  paymentId: string,
  options: {
    token?: string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<EstornoMercadoPago[]> {
  if (!/^\d+$/.test(paymentId)) {
    throw new Error("MP_REFUNDS_PAYMENT_ID_INVALID");
  }

  const token =
    options.token ?? process.env.MP_ACCESS_TOKEN;

  if (!token) {
    throw new Error("MP_ACCESS_TOKEN_MISSING");
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
      paymentId
    )}/refunds`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `MP_REFUNDS_QUERY_HTTP_${response.status}`
    );
  }

  const body: unknown = await response.json();

  if (!Array.isArray(body)) {
    throw new Error(
      "MP_REFUNDS_INVALID_RESPONSE"
    );
  }

  return body.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new Error(
        "MP_REFUNDS_INVALID_ITEM"
      );
    }

    const registro = item as Record<
      string,
      unknown
    >;

    if (
      registro.id == null ||
      !["string", "number"].includes(
        typeof registro.id
      ) ||
      typeof registro.status !== "string" ||
      typeof registro.amount !== "number" ||
      !Number.isFinite(registro.amount) ||
      registro.amount <= 0
    ) {
      throw new Error(
        "MP_REFUNDS_INVALID_ITEM"
      );
    }

    return {
      id: registro.id as string | number,
      payment_id:
        typeof registro.payment_id === "string" ||
        typeof registro.payment_id === "number"
          ? registro.payment_id
          : undefined,
      amount: registro.amount,
      status: registro.status,
      date_created:
        typeof registro.date_created === "string"
          ? registro.date_created
          : undefined,
    };
  });
}

export function validarPixRecuperavelMercadoPago(args: {
  pagamentoId: string;
  providerRef: string;
  valor: Prisma.Decimal | string | number;
  moeda: string;
  pixCopiaECola: string;
  mp: PagamentoMercadoPago;
  agora?: Date;
}): boolean {
  const {
    pagamentoId,
    providerRef,
    valor,
    moeda,
    pixCopiaECola,
    mp,
  } = args;

  if (
    !/^\d+$/.test(providerRef) ||
    String(mp.id ?? "") !== providerRef ||
    mp.status !== "pending" ||
    moeda !== "BRL" ||
    mp.currency_id !== "BRL"
  ) {
    return false;
  }

  const identidades = [
    mp.external_reference,
    mp.metadata?.pagamentoId,
    mp.metadata?.pagamento_id,
  ].filter(
    (item) =>
      item != null &&
      String(item).trim() !== ""
  );

  if (
    identidades.length === 0 ||
    identidades.some(
      (item) =>
        String(item).trim() !== pagamentoId
    )
  ) {
    return false;
  }

  if (
    typeof mp.transaction_amount !== "number" ||
    !Number.isFinite(mp.transaction_amount)
  ) {
    return false;
  }

  const esperado = new Prisma.Decimal(valor);
  const externo = new Prisma.Decimal(
    mp.transaction_amount
  );

  if (
    !esperado.isFinite() ||
    esperado.lessThanOrEqualTo(0) ||
    !externo.equals(esperado)
  ) {
    return false;
  }

  const qrExterno =
    mp.point_of_interaction
      ?.transaction_data?.qr_code;

  if (
    !pixCopiaECola.trim() ||
    typeof qrExterno !== "string" ||
    qrExterno !== pixCopiaECola
  ) {
    return false;
  }

  if (mp.date_of_expiration) {
    const vencimento = Date.parse(
      mp.date_of_expiration
    );

    if (
      !Number.isFinite(vencimento) ||
      vencimento <=
        (args.agora ?? new Date()).getTime()
    ) {
      return false;
    }
  }

  return true;
}