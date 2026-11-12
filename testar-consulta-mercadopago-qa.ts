
import assert from "node:assert/strict";

import {
  consultarPagamentoMercadoPago,
  classificarConciliacaoMercadoPago,
} from "./server/services/billingConciliacaoMercadoPagoService.js";

const PAGAMENTO_ID = "123456789";
const TOKEN_TESTE = "TOKEN_SIMULADO_NAO_REAL";

const local = {
  id: "footera-qa-123",
  provider: "MERCADOPAGO",
  providerRef: "PREF-QA-123",
  valor: "25.00",
  moeda: "BRL",
  status: "PENDENTE",
};

const retornoBase = {
  id: PAGAMENTO_ID,
  status: "approved",
  status_detail: "accredited",
  external_reference: local.id,
  metadata: {
    pagamentoId: local.id,
  },
  transaction_amount: 25,
  currency_id: "BRL",
};

let passou = 0;
let falhou = 0;

async function testar(
  nome: string,
  executar: () => Promise<void>
) {
  try {
    await executar();
    passou++;
    console.log("✔", nome);
  } catch (erro) {
    falhou++;
    console.error("✖", nome, erro);
  }
}

function resposta(
  dados: unknown,
  status = 200
): typeof fetch {
  return async () => {
    return new Response(
      JSON.stringify(dados),
      {
        status,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  };
}

function consultar(
  dados: unknown,
  status = 200
) {
  return consultarPagamentoMercadoPago(
    PAGAMENTO_ID,
    {
      token: TOKEN_TESTE,
      fetchImpl: resposta(dados, status),
    }
  );
}

async function main() {
  await testar("Consulta aprovada", async () => {
    const mp = await consultar(retornoBase);

    assert.equal(mp.status, "approved");

    const decisao =
      classificarConciliacaoMercadoPago(
        local,
        mp
      );

    assert.equal(decisao.acao, "APROVAR");
  });

  await testar("Pagamento pendente", async () => {
    const mp = await consultar({
      ...retornoBase,
      status: "pending",
    });

    assert.equal(
      classificarConciliacaoMercadoPago(
        local,
        mp
      ).acao,
      "AGUARDAR"
    );
  });

  await testar("Pagamento cancelado", async () => {
    const mp = await consultar({
      ...retornoBase,
      status: "cancelled",
    });

    assert.equal(
      classificarConciliacaoMercadoPago(
        local,
        mp
      ).acao,
      "CANCELAR_PENDENTE"
    );
  });

  await testar("Valor diferente", async () => {
    const mp = await consultar({
      ...retornoBase,
      transaction_amount: 26,
    });

    assert.equal(
      classificarConciliacaoMercadoPago(
        local,
        mp
      ).acao,
      "CONCILIACAO_MANUAL"
    );
  });

  await testar("Identidade diferente", async () => {
    const mp = await consultar({
      ...retornoBase,
      external_reference: "outro-pagamento",
    });

    assert.equal(
      classificarConciliacaoMercadoPago(
        local,
        mp
      ).acao,
      "CONCILIACAO_MANUAL"
    );
  });

  await testar("Reembolso parcial", async () => {
    const mp = await consultar({
      ...retornoBase,
      status_detail: "partially_refunded",
    });

    assert.equal(
      classificarConciliacaoMercadoPago(
        local,
        mp
      ).acao,
      "CONCILIACAO_MANUAL"
    );
  });

  await testar("Chargeback", async () => {
    const mp = await consultar({
      ...retornoBase,
      status: "charged_back",
    });

    assert.equal(
      classificarConciliacaoMercadoPago(
        local,
        mp
      ).acao,
      "CONCILIACAO_MANUAL"
    );
  });

  await testar("Erro HTTP 401", async () => {
    await assert.rejects(
      consultar(
        { message: "Unauthorized" },
        401
      ),
      /MP_QUERY_HTTP_401/
    );
  });

  await testar("Erro HTTP 404", async () => {
    await assert.rejects(
      consultar(
        { message: "Not found" },
        404
      ),
      /MP_QUERY_HTTP_404/
    );
  });

  await testar("Erro HTTP 500", async () => {
    await assert.rejects(
      consultar(
        { message: "Server error" },
        500
      ),
      /MP_QUERY_HTTP_500/
    );
  });

  await testar("Resposta vazia invalida", async () => {
    await assert.rejects(
      consultar(null),
      /MP_QUERY_INVALID_BODY/
    );
  });

  await testar("Resposta array invalida", async () => {
    await assert.rejects(
      consultar([]),
      /MP_QUERY_INVALID_BODY/
    );
  });

  await testar("ID de consulta invalido", async () => {
    await assert.rejects(
      consultarPagamentoMercadoPago(
        "../123",
        {
          token: TOKEN_TESTE,
          fetchImpl: resposta(retornoBase),
        }
      ),
      /MP_PAYMENT_ID_INVALID/
    );
  });

  await testar("Consulta usa URL correta", async () => {
    let urlRecebida = "";

    const mock: typeof fetch = async (url) => {
      urlRecebida = String(url);

      return new Response(
        JSON.stringify(retornoBase),
        { status: 200 }
      );
    };

    await consultarPagamentoMercadoPago(
      PAGAMENTO_ID,
      {
        token: TOKEN_TESTE,
        fetchImpl: mock,
      }
    );

    assert.equal(
      urlRecebida,
      `https://api.mercadopago.com/v1/payments/${PAGAMENTO_ID}`
    );
  });

  console.log(
    `\nRESULTADO: ${passou}/${passou + falhou}`
  );

  if (falhou > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});