type PreferenciaExterna = {
  id?: string;
  external_reference?: string | null;
  init_point?: string | null;
  sandbox_init_point?: string | null;
  preference_expired?: boolean;
  expiration_date_to?: string | null;
  items?: Array<{
    quantity?: number;
    unit_price?: number | string;
    currency_id?: string;
  }>;
};

function validarUrlCheckout(
  valor: unknown
): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  try {
    const url = new URL(valor);

    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "mercadopago.com" ||
        url.hostname.endsWith(".mercadopago.com") ||
        url.hostname === "mercadopago.com.br" ||
        url.hostname.endsWith(".mercadopago.com.br")
      )
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export async function recuperarPreferenciaMercadoPago(
  args: {
    preferenciaId: string;
    pagamentoId: string;
    valorCentavos: number;
    fetchImpl?: typeof fetch;
    token?: string;
  }
) {
  if (
    !args.preferenciaId.trim() ||
    !args.pagamentoId.trim() ||
    !Number.isSafeInteger(args.valorCentavos) ||
    args.valorCentavos <= 0
  ) {
    throw new Error("PREFERENCIA_ENTRADA_INVALIDA");
  }

  if (args.fetchImpl || args.token) {
    const db = new URL(process.env.DATABASE_URL ?? "");

    if (
        process.env.NODE_ENV !== "test" ||
        process.env.MP_ACCESS_TOKEN ||
        process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
        process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
        process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
        db.protocol !== "postgresql:" ||
        !["localhost", "127.0.0.1"].includes(db.hostname) ||
        db.port !== "5433" ||
        db.pathname !== "/footera_billing_qa"
    ) {
        throw new Error("PREFERENCIA_MOCK_QA_DISABLED");
    }

    if (!args.fetchImpl || !args.token) {
        throw new Error("PREFERENCIA_MOCK_INCOMPLETO");
    }
    }

    const token = args.token ?? process.env.MP_ACCESS_TOKEN;
    const executarFetch = args.fetchImpl ?? fetch;

  if (!token) {
    throw new Error("MP_ACCESS_TOKEN_MISSING");
  }

  const resposta = await executarFetch(
    "https://api.mercadopago.com/checkout/preferences/" +
      encodeURIComponent(args.preferenciaId),
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!resposta.ok) {
    throw new Error(
      `MP_PREFERENCIA_CONSULTA_HTTP_${resposta.status}`
    );
  }

  const dados =
    (await resposta.json()) as PreferenciaExterna;

  if (
    dados.id !== args.preferenciaId ||
    dados.external_reference !== args.pagamentoId
  ) {
    throw new Error("PREFERENCIA_IDENTIDADE_DIVERGENTE");
  }

  if (dados.preference_expired === true) {
    throw new Error("PREFERENCIA_EXPIRADA");
  }

  if (dados.expiration_date_to) {
    const vencimento = Date.parse(
      dados.expiration_date_to
    );

    if (
      !Number.isFinite(vencimento) ||
      vencimento <= Date.now()
    ) {
      throw new Error("PREFERENCIA_EXPIRADA");
    }
  }

  if (!Array.isArray(dados.items) || !dados.items.length) {
    throw new Error("PREFERENCIA_ITENS_INVALIDOS");
  }

  let totalCentavos = 0;

  for (const item of dados.items) {
    const valor = Number(item.unit_price);
    const quantidade = item.quantity;

    const centavos = Math.round(valor * 100);

    if (
    !Number.isSafeInteger(quantidade) ||
    quantidade === undefined ||
    quantidade <= 0
    ) {
    throw new Error(
        "PREFERENCIA_QUANTIDADE_INVALIDA"
    );
    }

    if (
      item.currency_id !== "BRL" ||
      !Number.isSafeInteger(centavos) ||
      centavos <= 0 ||
      Math.abs(valor * 100 - centavos) > 0.000001
    ) {
      throw new Error("PREFERENCIA_ITEM_DIVERGENTE");
    }

    totalCentavos += centavos * quantidade;
  }

  if (totalCentavos !== args.valorCentavos) {
    throw new Error("PREFERENCIA_VALOR_DIVERGENTE");
  }

  const checkoutUrl = validarUrlCheckout(
    dados.init_point
  );

  if (!checkoutUrl) {
    throw new Error("PREFERENCIA_URL_INVALIDA");
  }

  return {
    preferenciaId: args.preferenciaId,
    checkoutUrl,
  };
}