
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  avaliarRespostaExternaEstornoQa,
  type EntradaRespostaExternaQa,
} from "./server/services/billingCompensacaoEventoRespostaExternaQaService.js";

function main() {
  const pagamentoId = randomUUID();
  const providerRef = "123456789012345";
  const chave =
    `footera-evento-refund-${pagamentoId}`;

  const base: EntradaRespostaExternaQa = {
    pagamentoId,
    providerRef,
    chaveEsperada: chave,
    chaveUtilizada: chave,
    valorOriginal: "25.00",
    resultado: "RESPOSTA",
    resposta: {
      id: 101,
      payment_id: providerRef,
      amount: 25,
      status: "approved",
    },
  };

  let aprovados = 0;

  function verificar(
    nome: string,
    alteracoes: Partial<EntradaRespostaExternaQa>,
    motivoEsperado: string,
    evidenciaEsperada = false
  ) {
    const resultado =
      avaliarRespostaExternaEstornoQa({
        ...base,
        ...alteracoes,
      });

    assert.equal(
      resultado.motivo,
      motivoEsperado
    );

    assert.equal(
      resultado.evidenciaCompativel,
      evidenciaEsperada
    );

    assert.equal(resultado.exigeRevisao, true);
    assert.equal(
      resultado.executarNovoEstorno,
      false
    );
    assert.equal(
      resultado.repetirRequisicao,
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
    assert.equal(
      resultado.gravarEstornoProviderRef,
      false
    );

    aprovados++;
    console.log("✔", nome);
  }

  verificar(
    "Resposta perdida bloqueia novo estorno",
    { resultado: "SEM_RESPOSTA", resposta: null },
    "RESULTADO_EXTERNO_DESCONHECIDO"
  );

  for (const status of [500, 503]) {
    verificar(
      `HTTP ${status} nao autoriza repeticao`,
      {
        resultado: "ERRO_HTTP",
        httpStatus: status,
        resposta: null,
      },
      "ERRO_HTTP_RESULTADO_INCONCLUSIVO"
    );
  }

  verificar(
    "Timeout permanece inconclusivo",
    { resultado: "SEM_RESPOSTA" },
    "RESULTADO_EXTERNO_DESCONHECIDO"
  );

  verificar(
    "Resposta sem corpo e rejeitada",
    { resposta: null },
    "RESPOSTA_EXTERNA_INVALIDA"
  );

  verificar(
    "Pagamento divergente e rejeitado",
    {
      resposta: {
        id: 101,
        payment_id: "999999",
        amount: 25,
        status: "approved",
      },
    },
    "IDENTIDADE_EXTERNA_NAO_COMPROVADA"
  );

  verificar(
    "ID do estorno ausente e rejeitado",
    {
      resposta: {
        payment_id: providerRef,
        amount: 25,
        status: "approved",
      },
    },
    "IDENTIDADE_EXTERNA_NAO_COMPROVADA"
  );

  verificar(
    "Valor excedente exige revisao",
    {
      resposta: {
        id: 101,
        payment_id: providerRef,
        amount: 30,
        status: "approved",
      },
    },
    "VALOR_EXTERNO_EXCEDENTE"
  );

  verificar(
    "Estorno parcial exige revisao",
    {
      resposta: {
        id: 101,
        payment_id: providerRef,
        amount: 10,
        status: "approved",
      },
    },
    "ESTORNO_PARCIAL_REVISAO"
  );

  verificar(
    "Estorno pendente nao confirma operacao",
    {
      resposta: {
        id: 101,
        payment_id: providerRef,
        amount: 25,
        status: "pending",
      },
    },
    "ESTORNO_AINDA_EM_PROCESSAMENTO"
  );

  verificar(
    "Status desconhecido nao confirma estorno",
    {
      resposta: {
        id: 101,
        payment_id: providerRef,
        amount: 25,
        status: "unexpected",
      },
    },
    "STATUS_EXTERNO_NAO_CONFIRMADO"
  );

  verificar(
    "Resposta compativel ainda exige revisao",
    {},
    "RESPOSTA_COMPATIVEL_EXIGE_REVISAO",
    true
  );

  verificar(
    "Chave de idempotencia divergente e rejeitada",
    {
      chaveUtilizada: "chave-diferente",
    },
    "CHAVE_OU_REFERENCIA_INCONSISTENTE"
  );

  console.log(
    `\nRESULTADO: ${aprovados}/13`
  );

  console.log(
    "[QA] Nenhuma requisicao externa ou operacao financeira."
  );
}

try {
  main();
} catch (erro) {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
}