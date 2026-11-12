
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function ler(caminho: string): string {
  return readFileSync(caminho, "utf8");
}

const eventos = ler(
  "server/controllers/eventosController.ts"
);
const billing = ler(
  "server/controllers/billingController.ts"
);
const adminBilling = ler(
  "server/routes/adminBilling.ts"
);
const schema = ler(
  "server/prisma/schema.prisma"
);
const middleware = ler(
  "server/middlewares/validarWebhookMercadoPago.ts"
);
const rotasBilling = ler(
  "server/routes/billing.ts"
);

let aprovados = 0;

function verificar(nome: string, fn: () => void) {
  fn();
  aprovados++;
  console.log("✔", nome);
}

verificar(
  "Participar evento usa transacao",
  () => {
    assert.match(eventos, /prisma\.\$transaction/);
  }
);

verificar(
  "Participar evento bloqueia registro de Evento",
  () => {
    assert.match(
      eventos,
      /SELECT "id"\s+FROM "Evento"\s+WHERE "id" = \$\{eventoId\}\s+FOR UPDATE/
    );
  }
);

verificar(
  "Billing bloqueia vagas durante confirmacao",
  () => {
    assert.match(
      billing,
      /SELECT "id", "vagas"\s+FROM "Evento"\s+WHERE "id" = \$\{eventoId\}\s+FOR UPDATE/
    );
  }
);

verificar(
  "Inscricao possui indice unico por evento e usuario",
  () => {
    const inicio = schema.indexOf(
      "model InscricaoEvento {"
    );
    const fim = schema.indexOf(
      "\n}",
      inicio
    );

    assert.ok(inicio >= 0 && fim > inicio);

    const modelo = schema.slice(inicio, fim);

    assert.match(
      modelo,
      /@@unique\(\[eventoId,\s*usuarioId\]\)/
    );
  }
);

verificar(
  "Rota legada nao executa renovacoes antigas",
  () => {
    assert.doesNotMatch(
      adminBilling,
      /processarRenovacoesDiarias/
    );

    assert.match(
      adminBilling,
      /BILLING_LEGACY_SCHEDULER_DISABLED/
    );
  }
);

verificar(
  "Webhook possui verificacao de timestamp",
  () => {
    assert.match(
      middleware,
      /MP_WEBHOOK_TIMESTAMP_INVALID/
    );

    assert.match(
      middleware,
      /timingSafeEqual/
    );
  }
);

verificar(
  "Webhook oficial passa pelo middleware",
  () => {
    assert.match(
      rotasBilling,
      /"\/mercadopago\/webhook",\s*validarWebhookMercadoPago,\s*mercadoPagoWebhook/
    );
  }
);

console.log(
  `\nRESULTADO: ${aprovados}/7`
);

console.log(
  "[QA] Verificacao estatica: nenhum banco, webhook ou pagamento executado."
);