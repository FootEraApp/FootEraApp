
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  avaliarCompensacaoEvento,
} from "./server/services/billingCompensacaoEventoService.js";

async function main() {
  const pagamentoId = randomUUID();
  const eventoId = randomUUID();
  const mpId = "123456789012345";

  const pagamento = {
    id: pagamentoId,
    plano: `EVENTO:${eventoId}`,
    provider: "MERCADOPAGO",
    providerRef: mpId,
    valor: "25.00",
    moeda: "BRL",
    status: "PENDENTE",
  };

  const mp = {
    id: mpId,
    status: "approved",
    status_detail: "accredited",
    external_reference: pagamentoId,
    metadata: { pagamentoId },
    transaction_amount: 25,
    currency_id: "BRL",
  };

  const base = {
    pagamento,
    eventoId,
    statusPendencia: "PENDENTE_ANALISE",
    mp,
    possuiInscricao: false,
    possuiBeneficio: false,
  };

  let aprovados = 0;

  function testar(
    nome: string,
    entrada: Parameters<
      typeof avaliarCompensacaoEvento
    >[0],
    candidataEsperada: boolean
  ) {
    const resultado =
      avaliarCompensacaoEvento(entrada);

    assert.equal(
      resultado.candidataAnalise,
      candidataEsperada,
      nome
    );

    assert.equal(
      resultado.estornoAutorizado,
      false
    );

    assert.equal(
      resultado.estornoExecutado,
      false
    );

    aprovados++;
    console.log("✔", nome);
  }

  testar(
    "Pagamento aprovado sem vaga vai para analise",
    base,
    true
  );

  testar(
    "Pagamento ainda pendente no MP nao avanca",
    {
      ...base,
      mp: {
        ...mp,
        status: "pending",
      },
    },
    false
  );

  testar(
    "Valor divergente nao avanca",
    {
      ...base,
      mp: {
        ...mp,
        transaction_amount: 20,
      },
    },
    false
  );

  testar(
    "Pagamento ja reembolsado nao avanca",
    {
      ...base,
      mp: {
        ...mp,
        status: "refunded",
      },
    },
    false
  );

  testar(
    "Pagamento com beneficio nao avanca",
    {
      ...base,
      possuiBeneficio: true,
    },
    false
  );

  testar(
    "Pendencia de estorno ja encaminhado nao avanca",
    {
      ...base,
      statusPendencia: "AGUARDANDO_ESTORNO",
    },
    false
  );

  testar(
    "Identidade divergente nao avanca",
    {
      ...base,
      mp: {
        ...mp,
        external_reference: randomUUID(),
      },
    },
    false
  );

  testar(
    "Pagamento com inscricao nao avanca",
    {
      ...base,
      possuiInscricao: true,
    },
    false
  );

  console.log(
    `\nRESULTADO: ${aprovados}/8`
  );
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});