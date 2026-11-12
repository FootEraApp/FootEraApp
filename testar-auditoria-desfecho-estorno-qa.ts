
import assert from "node:assert/strict";

import {
  construirAuditoriaDesfecho,
  persistirAuditoriaDesfecho,
} from "./server/services/billingEstornoDesfechoAuditoriaService.js";

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "false"
  ) {
    throw new Error("QA_AUDITORIA_AMBIENTE_INVALIDO");
  }

  const req = {
    ip: "127.0.0.1",
    headers: {
      "user-agent": "FootEra-QA",
    },
  };

  const pagamentoId =
    "11111111-1111-4111-8111-111111111111";

  const operadorId =
    "22222222-2222-4222-8222-222222222222";

  let aprovados = 0;

  async function verificar(
    nome: string,
    fn: () => Promise<void>
  ): Promise<void> {
    await fn();
    aprovados++;
    console.log(`✔ ${nome}`);
  }

  await verificar(
    "Auditoria de execucao possui identidade correta",
    async () => {
      const dados = construirAuditoriaDesfecho(
        req,
        operadorId,
        pagamentoId,
        "EXECUCAO",
        {
          motivo: "ENVIO_NAO_COMPROVADO",
          requerConciliacao: true,
          enviado: null,
        }
      );

      assert.equal(
        dados.acao,
        "BILLING_ESTORNO_EXECUCAO_RESULTADO"
      );

      assert.equal(dados.entidadeId, pagamentoId);
      assert.equal(dados.meta.podeReenviar, false);
      assert.equal(dados.meta.requerConciliacao, true);
    }
  );

  await verificar(
    "Auditoria de conciliacao nao permite reenvio",
    async () => {
      const dados = construirAuditoriaDesfecho(
        req,
        operadorId,
        pagamentoId,
        "CONCILIACAO",
        {
          requerConciliacao: true,
          motivo: "REVISAO_MANUAL",
        }
      );

      assert.equal(
        dados.acao,
        "BILLING_ESTORNO_CONCILIACAO_RESULTADO"
      );

      assert.equal(dados.meta.podeReenviar, false);
    }
  );

  await verificar(
    "Persistencia da auditoria bem-sucedida",
    async () => {
      const dados = construirAuditoriaDesfecho(
        req,
        operadorId,
        pagamentoId,
        "EXECUCAO"
      );

      let chamadas = 0;

      const registrada =
        await persistirAuditoriaDesfecho(
          dados,
          async () => {
            chamadas++;
          }
        );

      assert.equal(registrada, true);
      assert.equal(chamadas, 1);
    }
  );

  await verificar(
    "Falha na auditoria retorna false sem repetir",
    async () => {
      const dados = construirAuditoriaDesfecho(
        req,
        operadorId,
        pagamentoId,
        "EXECUCAO"
      );

      let chamadas = 0;

      const registrada =
        await persistirAuditoriaDesfecho(
          dados,
          async () => {
            chamadas++;
            throw new Error("QA_FALHA_AUDITORIA");
          }
        );

      assert.equal(registrada, false);
      assert.equal(chamadas, 1);
    }
  );

  await verificar(
    "Erro operacional e registrado sem reenvio",
    async () => {
      const dados = construirAuditoriaDesfecho(
        req,
        operadorId,
        pagamentoId,
        "EXECUCAO",
        undefined,
        new Error("BILLING_ENVIO_INCONCLUSIVO")
      );

      assert.equal(dados.meta.falhou, true);
      assert.equal(
        dados.meta.codigoErro,
        "BILLING_ENVIO_INCONCLUSIVO"
      );
      assert.equal(dados.meta.podeReenviar, false);
    }
  );

  console.log(`\nRESULTADO: ${aprovados}/5`);
  console.log("ETAPA4_AUDITORIA_DESFECHO_QA_APROVADA");
}

main().catch((erro) => {
  console.error(
    "ETAPA4_AUDITORIA_DESFECHO_QA_FALHOU:",
    erro
  );

  process.exitCode = 1;
});