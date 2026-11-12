
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  avaliarRecuperacaoCompensacaoEvento,
} from "./server/services/billingCompensacaoEventoRecuperacaoService.js";

function main() {
  const pagamentoId = randomUUID();
  const providerRef = "123456789012345";

  const evidenciaValida = {
    tipo: "ENCONTRADO" as const,
    pagamentoProviderRef: providerRef,
    estornoId: "refund-qa-001",
    status: "approved",
    valor: "25.00",
    moeda: "BRL",
  };

  const base = {
    pagamentoId,
    providerRef,
    valorOriginal: "25.00",
    moeda: "BRL",
    statusCompensacao: "AGUARDANDO_CONFIRMACAO",
    statusTentativa: "RESULTADO_DESCONHECIDO",
    operacaoExternaExecutada: false,
    evidencia: evidenciaValida,
  };

  let aprovados = 0;

  function verificar(
    descricao: string,
    entrada: Parameters<
      typeof avaliarRecuperacaoCompensacaoEvento
    >[0],
    decisaoEsperada: string,
    motivoEsperado: string
  ) {
    const resultado =
      avaliarRecuperacaoCompensacaoEvento(entrada);

    assert.equal(
      resultado.decisao,
      decisaoEsperada,
      descricao
    );

    assert.equal(
      resultado.motivo,
      motivoEsperado
    );

    // Nenhuma classificacao deste teste
    // pode executar outra operacao financeira.
    assert.equal(
      resultado.atualizarPagamento,
      false
    );

    assert.equal(
      resultado.executarNovoEstorno,
      false
    );

    assert.equal(
      resultado.estornoConfirmadoLocalmente,
      false
    );

    aprovados++;
    console.log("✔", descricao);
  }

  verificar(
    "Estorno confirmado segue para revisao",
    base,
    "ESTORNO_CONFIRMADO_PARA_REVISAO",
    "ESTORNO_EXTERNO_CONFIRMADO"
  );

  verificar(
    "Estorno pendente continua aguardando",
    {
      ...base,
      evidencia: {
        ...evidenciaValida,
        status: "pending",
      },
    },
    "AGUARDAR_PROVEDOR",
    "ESTORNO_EXTERNO_EM_PROCESSAMENTO"
  );

  verificar(
    "Estorno nao encontrado nao libera nova tentativa",
    {
      ...base,
      evidencia: {
        tipo: "NAO_ENCONTRADO",
      },
    },
    "REVISAO_MANUAL",
    "ESTORNO_NAO_LOCALIZADO_RESULTADO_INCONCLUSIVO"
  );

  verificar(
    "Erro de consulta nao libera nova tentativa",
    {
      ...base,
      evidencia: {
        tipo: "CONSULTA_FALHOU",
      },
    },
    "REVISAO_MANUAL",
    "CONSULTA_PROVEDOR_FALHOU"
  );

  verificar(
    "Referencia divergente e recusada",
    {
      ...base,
      evidencia: {
        ...evidenciaValida,
        pagamentoProviderRef: "999999999",
      },
    },
    "REVISAO_MANUAL",
    "EVIDENCIA_INCOMPLETA_OU_DIVERGENTE"
  );

  verificar(
    "Valor de estorno divergente e recusado",
    {
      ...base,
      evidencia: {
        ...evidenciaValida,
        valor: "20.00",
      },
    },
    "REVISAO_MANUAL",
    "VALOR_ESTORNO_DIVERGENTE"
  );

  verificar(
    "Status externo desconhecido e recusado",
    {
      ...base,
      evidencia: {
        ...evidenciaValida,
        status: "rejected",
      },
    },
    "REVISAO_MANUAL",
    "STATUS_ESTORNO_NAO_CONFIRMADO"
  );

  verificar(
    "Estado local incorreto e bloqueado",
    {
      ...base,
      statusCompensacao: "PREPARADA",
    },
    "REVISAO_MANUAL",
    "ESTADO_LOCAL_INCOMPATIVEL"
  );

  console.log(
    `\nRESULTADO: ${aprovados}/8`
  );
}

try {
  main();
} catch (erro) {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
}