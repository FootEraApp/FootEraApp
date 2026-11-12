
import assert from "node:assert/strict";

async function main() {
  const db = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    process.env.NODE_ENV === "production" ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const {
    configurarConsultorMercadoPagoQa,
    obterPagamentoMercadoPago,
    configurarConsultorEstornoQa,
    obterEvidenciaEstornoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const mpId = "123456789012";
  let chamadasReais = 0;
  let chamadasMock = 0;
  let aprovados = 0;

  const consultaReal = async (_id: string) => {
    chamadasReais++;

    throw new Error(
      "QA_CONSULTA_REAL_PROIBIDA"
    );
  };

  async function verificar(
    nome: string,
    teste: () => Promise<void>
  ) {
    await teste();
    aprovados++;
    console.log("✔", nome);
  }

  try {
    await verificar(
      "Mock ausente bloqueia consulta real",
      async () => {
        await assert.rejects(
          () =>
            obterPagamentoMercadoPago(
              mpId,
              consultaReal
            ),
          /BILLING_MP_QA_CONSULTOR_NAO_CONFIGURADO/
        );
      }
    );

    await verificar(
      "ID invalido bloqueia consulta",
      async () => {
        await assert.rejects(
          () =>
            obterPagamentoMercadoPago(
              "ID_INVALIDO",
              consultaReal
            ),
          /MP_PAYMENT_ID_INVALID/
        );
      }
    );

    configurarConsultorMercadoPagoQa(
      async (id) => {
        chamadasMock++;
        assert.equal(id, mpId);

        return {
          id: mpId,
          status: "approved",
          status_detail: "accredited",
          currency_id: "BRL",
          transaction_amount: 25,
          external_reference:
            "qa-pagamento-ficticio",
        };
      }
    );

    await verificar(
      "Consulta utiliza exclusivamente o mock",
      async () => {
        const resposta =
          await obterPagamentoMercadoPago(
            mpId,
            consultaReal
          );

        assert.equal(
          String(resposta.id),
          mpId
        );

        assert.equal(
          resposta.status,
          "approved"
        );
      }
    );

    await verificar(
      "Consultas repetidas permanecem simuladas",
      async () => {
        const resultados = await Promise.all(
          Array.from({ length: 6 }, () =>
            obterPagamentoMercadoPago(
              mpId,
              consultaReal
            )
          )
        );

        assert.equal(resultados.length, 6);

        assert.ok(
          resultados.every(
            (r) => String(r.id) === mpId
          )
        );
      }
    );

    await verificar(
      "Nenhuma chamada externa foi executada",
      async () => {
        assert.equal(chamadasReais, 0);
        assert.equal(chamadasMock, 7);
      }
    );

    configurarConsultorMercadoPagoQa(null);

    await verificar(
      "Remover mock restaura bloqueio QA",
      async () => {
        await assert.rejects(
          () =>
            obterPagamentoMercadoPago(
              mpId,
              consultaReal
            ),
          /BILLING_MP_QA_CONSULTOR_NAO_CONFIGURADO/
        );

        assert.equal(chamadasReais, 0);
      }
    );

    await verificar(
      "Estorno sem simulador e recusado",
      async () => {
        await assert.rejects(
          () => obterEvidenciaEstornoQa(mpId),
          /BILLING_ESTORNO_CONSULTOR_QA_NOT_CONFIGURED/
        );
      }
    );

    configurarConsultorEstornoQa(
      async (id) => {
        assert.equal(id, mpId);

        return {
          tipo: "NAO_ENCONTRADO",
        };
      }
    );

    await verificar(
      "Evidencia de estorno permanece simulada",
      async () => {
        const evidencia =
          await obterEvidenciaEstornoQa(
            mpId
          );

        assert.equal(
          evidencia.tipo,
          "NAO_ENCONTRADO"
        );

        assert.equal(chamadasReais, 0);
      }
    );

    assert.equal(aprovados, 8);

    console.log(
      `\nRESULTADO: ${aprovados}/8`
    );

    console.log(
      "[QA] Sem HTTP externo, estorno ou mutacao financeira."
    );
  } finally {
    configurarConsultorMercadoPagoQa(null);
    configurarConsultorEstornoQa(null);
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});