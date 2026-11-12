
"use strict";

// QA OFFLINE: não acessa banco nem Mercado Pago.
// Executa as regras TypeScript com tsx.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();

const arquivoServico = path.join(
  root,
  "server",
  "services",
  "billingConciliacaoMercadoPagoService.ts"
);

const tsxCli = path.join(
  root,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs"
);

if (!fs.existsSync(arquivoServico)) {
  throw new Error(
    "Servico de conciliacao nao encontrado."
  );
}

if (!fs.existsSync(tsxCli)) {
  throw new Error(
    "tsx nao encontrado. Execute npm install."
  );
}

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "footera-mp-qa-")
);

const testeTs = path.join(
  tempDir,
  "teste-conciliacao.ts"
);

const codigo = `
import assert from "node:assert/strict";

import {
  classificarConciliacaoMercadoPago,
} from ${JSON.stringify(arquivoServico.replace(/\\/g, "/"))};

const local = {
  id: "pagamento-footera-1",
  provider: "MERCADOPAGO",
  providerRef: "PREF-123",
  valor: "25.00",
  moeda: "BRL",
  status: "PENDENTE",
};

const mp = {
  id: "1234567",
  external_reference: local.id,
  metadata: {
    pagamentoId: local.id,
  },
  currency_id: "BRL",
  transaction_amount: 25,
  status: "approved",
};

let passou = 0;
let falhou = 0;

function testar(nome: string, fn: () => void) {
  try {
    fn();
    passou++;
    console.log("✔ " + nome);
  } catch (error) {
    falhou++;
    console.error("✖ " + nome, error);
  }
}

function acao(
  pagamento: typeof local,
  retorno: typeof mp
) {
  return classificarConciliacaoMercadoPago(
    pagamento,
    retorno
  ).acao;
}

testar("Aprovacao valida", () => {
  assert.equal(acao(local, mp), "APROVAR");
});

testar("Identidade divergente bloqueada", () => {
  assert.equal(
    acao(local, {
      ...mp,
      external_reference: "outro-pagamento",
    }),
    "CONCILIACAO_MANUAL"
  );
});

testar("Identidade ausente bloqueada", () => {
  assert.equal(
    acao(local, {
      ...mp,
      external_reference: "",
      metadata: {} as any,
    }),
    "CONCILIACAO_MANUAL"
  );
});

testar("Valor divergente bloqueado", () => {
  assert.equal(
    acao(local, {
      ...mp,
      transaction_amount: 25.01,
    }),
    "CONCILIACAO_MANUAL"
  );
});

testar("Moeda divergente bloqueada", () => {
  assert.equal(
    acao(local, {
      ...mp,
      currency_id: "USD",
    }),
    "CONCILIACAO_MANUAL"
  );
});

testar("Pagamento pendente deve aguardar", () => {
  assert.equal(
    acao(local, {
      ...mp,
      status: "pending",
    }),
    "AGUARDAR"
  );
});

testar("Aprovacao tardia bloqueada", () => {
  assert.equal(
    acao(
      { ...local, status: "CANCELADO" },
      mp
    ),
    "CONCILIACAO_MANUAL"
  );
});

testar("Aprovacao repetida idempotente", () => {
  assert.equal(
    acao(
      { ...local, status: "APROVADO" },
      mp
    ),
    "JA_CONCILIADO"
  );
});

testar("Cancelamento confirmado", () => {
  assert.equal(
    acao(local, {
      ...mp,
      status: "cancelled",
    }),
    "CANCELAR_PENDENTE"
  );
});

testar("Chargeback exige conciliacao", () => {
  assert.equal(
    acao(local, {
      ...mp,
      status: "charged_back",
    }),
    "CONCILIACAO_MANUAL"
  );
});

testar("Reembolso parcial bloqueado", () => {
  assert.equal(
    acao(local, {
      ...mp,
      status: "approved",
      status_detail: "partially_refunded",
    } as any),
    "CONCILIACAO_MANUAL"
  );
});

testar("Referencia MP divergente bloqueada", () => {
  assert.equal(
    acao(
      { ...local, providerRef: "999999" },
      mp
    ),
    "CONCILIACAO_MANUAL"
  );
});

console.log(
  "\\nRESULTADO: " +
  passou + "/" + (passou + falhou) +
  " verificacoes aprovadas."
);

if (falhou > 0) {
  process.exitCode = 1;
}
`;

try {
  fs.writeFileSync(testeTs, codigo, "utf8");

  const resultado = spawnSync(
    process.execPath,
    [tsxCli, testeTs],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        MP_ACCESS_TOKEN: "",
      },
    }
  );

  if (resultado.error) {
    throw resultado.error;
  }

  if (resultado.status !== 0) {
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(tempDir, {
    recursive: true,
    force: true,
  });
}