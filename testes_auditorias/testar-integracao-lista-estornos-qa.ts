
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  consultarEAnalisarListaEstornosQa,
} from "./server/services/billingCompensacaoEventoConsultaListaQaService.js";

async function main() {
  const pagamentoId = randomUUID();
  const providerRef = "123456789012345";

  let aprovados = 0;

  function resposta(
    status: number,
    body: unknown
  ): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  function estorno(
    id: number,
    amount: number,
    status = "approved",
    paymentId = providerRef
  ) {
    return {
      id,
      payment_id: paymentId,
      amount,
      status,
    };
  }

  async function executar(
    body: unknown,
    httpStatus = 200
  ) {
    let chamadas = 0;

    const fetchQa: typeof fetch =
      async (input, init) => {
        chamadas++;

        assert.equal(
          String(input),
          `https://api.mercadopago.com/v1/payments/${providerRef}/refunds`
        );

        assert.equal(init?.method, "GET");

        return resposta(httpStatus, body);
      };

    const resultado =
      await consultarEAnalisarListaEstornosQa({
        pagamentoId,
        providerRef,
        valorOriginal: "25.00",
        moeda: "BRL",
        fetchQa,
      });

    assert.equal(chamadas, 1);
    assert.equal(
      resultado.executarNovoEstorno,
      false
    );
    assert.equal(
      resultado.atualizarPagamento,
      false
    );
    assert.equal(
      resultado.avaliacao.confirmarCompensacao,
      false
    );

    return resultado;
  }

  async function verificar(
    nome: string,
    fn: () => Promise<void>
  ) {
    await fn();
    aprovados++;
    console.log("✔", nome);
  }

  await verificar(
    "Estorno total aprovado segue para revisao",
    async () => {
      const r = await executar([
        estorno(101, 25),
      ]);

      assert.equal(r.consultaConcluida, true);
      assert.equal(
        r.avaliacao.decisao,
        "ESTORNO_TOTAL_PARA_REVISAO"
      );
      assert.equal(
        r.avaliacao.totalAprovado,
        "25.00"
      );
    }
  );

  await verificar(
    "Dois estornos parciais somam o total",
    async () => {
      const r = await executar([
        estorno(101, 10),
        estorno(102, 15),
      ]);

      assert.equal(
        r.avaliacao.decisao,
        "ESTORNO_TOTAL_PARA_REVISAO"
      );
      assert.equal(
        r.quantidadeRetornada,
        2
      );
    }
  );

  await verificar(
    "Estorno parcial exige revisao",
    async () => {
      const r = await executar([
        estorno(101, 10),
      ]);

      assert.equal(
        r.avaliacao.decisao,
        "ESTORNO_PARCIAL_REVISAO"
      );
      assert.equal(
        r.avaliacao.totalAprovado,
        "10.00"
      );
    }
  );

  await verificar(
    "Estorno pendente mantem bloqueio",
    async () => {
      const r = await executar([
        estorno(101, 10),
        estorno(102, 15, "pending"),
      ]);

      assert.equal(
        r.avaliacao.decisao,
        "AGUARDAR_PROVEDOR"
      );
      assert.equal(
        r.avaliacao.totalPendente,
        "15.00"
      );
    }
  );

  await verificar(
    "Pagamento divergente exige revisao",
    async () => {
      const r = await executar([
        estorno(101, 25, "approved", "99999"),
      ]);

      assert.equal(
        r.avaliacao.decisao,
        "REVISAO_MANUAL"
      );
      assert.equal(
        r.avaliacao.motivo,
        "IDENTIDADE_DO_ESTORNO_INVALIDA"
      );
    }
  );

  await verificar(
    "Lista vazia nao libera estorno",
    async () => {
      const r = await executar([]);

      assert.equal(r.consultaConcluida, true);
      assert.equal(
        r.avaliacao.decisao,
        "SEM_ESTORNOS_REVISAO"
      );
    }
  );

  await verificar(
    "Erro HTTP nao vira lista vazia",
    async () => {
      const r = await executar(
        { message: "Unavailable" },
        503
      );

      assert.equal(r.consultaConcluida, false);
      assert.equal(
        r.avaliacao.motivo,
        "CONSULTA_LISTA_ESTORNOS_FALHOU"
      );
    }
  );

  await verificar(
    "Resposta malformada bloqueia conciliacao",
    async () => {
      const r = await executar({
        refunds: [],
      });

      assert.equal(r.consultaConcluida, false);
      assert.equal(
        r.avaliacao.decisao,
        "REVISAO_MANUAL"
      );
    }
  );

  console.log(
    `\nRESULTADO: ${aprovados}/8`
  );
  console.log(
    "[QA] Nenhuma chamada HTTP externa ou alteracao no banco."
  );
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});