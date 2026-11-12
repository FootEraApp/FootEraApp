
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  avaliarListaEstornosCompensacaoEvento,
  type EntradaListaEstornos,
  type DecisaoListaEstornos,
} from "./server/services/billingCompensacaoEventoListaEstornosService.js";

function main() {
  const pagamentoId = randomUUID();
  const providerRef = "123456789012345";

  const base: EntradaListaEstornos = {
    pagamentoId,
    providerRef,
    valorOriginal: "25.00",
    moeda: "BRL",
    estornos: [],
  };

  let aprovados = 0;

  function estorno(
    id: number,
    amount: number,
    status = "approved",
    paymentId: string = providerRef
  ) {
    return {
      id,
      payment_id: paymentId,
      amount,
      status,
    };
  }

  function verificar(
    descricao: string,
    estornos: EntradaListaEstornos["estornos"],
    decisaoEsperada: DecisaoListaEstornos,
    motivoEsperado: string,
    totalEsperado: string
  ) {
    const resultado =
      avaliarListaEstornosCompensacaoEvento({
        ...base,
        estornos,
      });

    assert.equal(
      resultado.decisao,
      decisaoEsperada
    );

    assert.equal(
      resultado.motivo,
      motivoEsperado
    );

    assert.equal(
      resultado.totalAprovado,
      totalEsperado
    );

    assert.equal(
      resultado.executarNovoEstorno,
      false
    );

    assert.equal(
      resultado.atualizarPagamento,
      false
    );

    assert.equal(
      resultado.confirmarCompensacao,
      false
    );

    aprovados++;
    console.log("✔", descricao);
  }

  verificar(
    "Um estorno total aprovado exige revisao",
    [estorno(101, 25)],
    "ESTORNO_TOTAL_PARA_REVISAO",
    "VALOR_TOTAL_APROVADO_NA_LISTA",
    "25.00"
  );

  verificar(
    "Dois estornos parciais somando o total",
    [
      estorno(101, 10),
      estorno(102, 15),
    ],
    "ESTORNO_TOTAL_PARA_REVISAO",
    "VALOR_TOTAL_APROVADO_NA_LISTA",
    "25.00"
  );

  verificar(
    "Estorno parcial nao representa devolucao total",
    [estorno(101, 10)],
    "ESTORNO_PARCIAL_REVISAO",
    "VALOR_DEVOLVIDO_INFERIOR_AO_PAGAMENTO",
    "10.00"
  );

  verificar(
    "Estorno pendente mantem conciliacao bloqueada",
    [
      estorno(101, 10),
      estorno(102, 15, "pending"),
    ],
    "AGUARDAR_PROVEDOR",
    "EXISTEM_ESTORNOS_EM_PROCESSAMENTO",
    "10.00"
  );

  verificar(
    "Valor acumulado acima do pagamento e rejeitado",
    [
      estorno(101, 25),
      estorno(102, 10),
    ],
    "REVISAO_MANUAL",
    "TOTAL_ESTORNOS_EXCEDE_PAGAMENTO",
    "35.00"
  );

  verificar(
    "ID de pagamento divergente e rejeitado",
    [estorno(101, 25, "approved", "999999")],
    "REVISAO_MANUAL",
    "IDENTIDADE_DO_ESTORNO_INVALIDA",
    "0.00"
  );

  verificar(
    "IDs de estorno duplicados sao rejeitados",
    [
      estorno(101, 10),
      estorno(101, 15),
    ],
    "REVISAO_MANUAL",
    "IDENTIDADE_DO_ESTORNO_INVALIDA",
    "10.00"
  );

  verificar(
    "Lista vazia nao autoriza novo estorno",
    [],
    "SEM_ESTORNOS_REVISAO",
    "LISTA_VAZIA_NAO_COMPROVA_AUSENCIA_DE_ESTORNO",
    "0.00"
  );

  console.log(
    `\nRESULTADO: ${aprovados}/8`
  );
  console.log(
    "[QA] Nenhum pagamento ou estorno foi alterado."
  );
}

try {
  main();
} catch (erro) {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
}