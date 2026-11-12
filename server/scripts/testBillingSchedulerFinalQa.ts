import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config({ path: "server/.env" });

const DB = "footera_billing_scheduler_qa_20261103";
const AVISO_USER = "1cd77a66-270e-4ce6-832d-08a563d7a86d";
const BLOQUEIO_USER = "eeecc139-3f8e-46fd-a2c9-2eae36db96aa";
const MS_DIA = 24 * 60 * 60 * 1000;

function exigir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(`QA_REPROVADO: ${mensagem}`);
}

function validarAmbiente() {
  const raw = process.env.DATABASE_URL;
  exigir(raw, "DATABASE_URL ausente");
  const url = new URL(raw);
  exigir(["postgres:", "postgresql:"].includes(url.protocol), "protocolo invalido");
  exigir(["localhost", "127.0.0.1"].includes(url.hostname), "host nao local");
  exigir(url.port === "5433", "porta diferente de 5433");
  exigir(decodeURIComponent(url.pathname) === `/${DB}`, "banco nao isolado");
  exigir(process.env.NODE_ENV === "test", "NODE_ENV deve ser test");
  exigir(process.env.BILLING_TEST_MODE === "true", "BILLING_TEST_MODE deve ser true");
  exigir(process.env.BILLING_CUPOM_RESERVA_QA === "false", "BILLING_CUPOM_RESERVA_QA deve ser false");
  exigir(process.env.ENABLE_BILLING_SCHEDULER === "false", "scheduler deve estar desligado");
  exigir(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER === "false", "conciliacao deve estar desligada");
  exigir(process.env.ENABLE_ACCOUNT_PURGE === "false", "exclusao de contas deve estar desligada");
  exigir(!process.env.MP_ACCESS_TOKEN?.trim(), "token MP proibido");
  exigir(!process.env.SMTP_HOST?.trim(), "SMTP proibido");
}

async function main() {
  validarAmbiente();
  const { prisma } = await import("../prisma.js");
  const { processExpiringSubscriptions } = await import("../controllers/billingController.js");
  const criadas: string[] = [];
  const aprovados: string[] = [];

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    exigir(banco[0]?.nome === DB, "conexao Prisma aponta para banco errado");
    const avisoUser = await prisma.usuario.findUnique({ where: { id: AVISO_USER }, select: { id: true, nomeDeUsuario: true, email: true, deletedAt: true } });
    const bloqueioUser = await prisma.usuario.findUnique({ where: { id: BLOQUEIO_USER }, select: { id: true, nomeDeUsuario: true, email: true, deletedAt: true } });
    exigir(avisoUser?.nomeDeUsuario === "qa_sched_aviso_20261103" && avisoUser.email?.endsWith("@example.invalid") && !avisoUser.deletedAt, "usuario aviso nao e fixture segura");
    exigir(bloqueioUser?.nomeDeUsuario === "qa_sched_bloqueio_20261103" && bloqueioUser.email?.endsWith("@example.invalid") && !bloqueioUser.deletedAt, "usuario bloqueio nao e fixture segura");

    const base = await prisma.assinatura.findUnique({ where: { id: "7a797126-9052-4aa4-a685-fea51afe8661" }, select: { plano: true, periodicidade: true, usuarioId: true } });
    exigir(base?.usuarioId === AVISO_USER, "assinatura base de aviso nao corresponde ao usuario QA");

    async function assinatura(cenario: string, bloqueada = false) {
      const id = randomUUID();
      const agora = Date.now();
      const vencimento = new Date(agora + (bloqueada ? -MS_DIA : 2 * MS_DIA));
      const item = await prisma.assinatura.create({
        data: {
          id,
          usuarioId: bloqueada ? BLOQUEIO_USER : AVISO_USER,
          contextoKey: `qa-etapa6-final-${cenario}-${id}`,
          plano: base!.plano,
          periodicidade: base!.periodicidade,
          startsAt: new Date(agora - 35 * MS_DIA),
          renovaEm: vencimento,
          status: bloqueada ? "BLOQUEADA" : "ATIVA",
          ativo: !bloqueada,
          lembreteEnviado: false,
          ...(bloqueada ? { bloqueadoEm: new Date(agora - 60 * 60 * 1000), canceledAt: new Date(agora - 60 * 60 * 1000) } : {}),
        },
      });
      criadas.push(item.id);
      return item;
    }

    async function registros(id: string) {
      return prisma.billingComunicacao.findMany({ where: { assinaturaId: id }, orderBy: { canal: "asc" } });
    }

    async function semear(id: string, ciclo: string, evento: string, status: "FALHOU" | "PROCESSANDO", tentativas: number, proximaTentativaEm: Date | null, atualizadoEm?: Date) {
      for (const canal of ["APP", "EMAIL"] as const) {
        await prisma.billingComunicacao.create({ data: {
          assinaturaId: id,
          cicloKey: ciclo,
          evento,
          canal,
          status,
          tentativas,
          ...(proximaTentativaEm ? { proximaTentativaEm } : {}),
          ...(atualizadoEm ? { atualizadoEm } : {}),
        } });
      }
    }

    async function executar(id: string, usuarioId = AVISO_USER) {
      const r = await processExpiringSubscriptions({ usuarioId, assinaturaId: id });
      exigir(r.ok === true, `${id}: retorno sem ok=true`);
      return r;
    }

    function conferirCanais(itens: Awaited<ReturnType<typeof registros>>, status: string, tentativas: number, evento = "VENCIMENTO_7_DIAS") {
      exigir(itens.length === 2, `esperadas duas comunicacoes; obtidas ${itens.length}`);
      for (const canal of ["APP", "EMAIL"]) {
        const item = itens.find(x => x.canal === canal && x.evento === evento);
        exigir(item?.status === status && item.tentativas === tentativas, `${canal}: esperado ${status}/${tentativas}, encontrado ${item?.status}/${item?.tentativas}`);
      }
    }
    {
      const a = await assinatura("retry-vencido");
      await semear(a.id, a.renovaEm.toISOString(), "VENCIMENTO_7_DIAS", "FALHOU", 1, new Date(Date.now() - MS_DIA));
      await executar(a.id);
      conferirCanais(await registros(a.id), "ENVIADO", 2);
      aprovados.push("RETRY_VENCIDO");
    }
    {
      const a = await assinatura("retry-futuro");
      await semear(a.id, a.renovaEm.toISOString(), "VENCIMENTO_7_DIAS", "FALHOU", 1, new Date(Date.now() + MS_DIA));
      await executar(a.id);
      conferirCanais(await registros(a.id), "FALHOU", 1);
      aprovados.push("RETRY_FUTURO");
    }
    {
      const a = await assinatura("lease-expirado");
      await semear(a.id, a.renovaEm.toISOString(), "VENCIMENTO_7_DIAS", "PROCESSANDO", 1, null, new Date(Date.now() - 35 * 60 * 1000));
      const antes = await registros(a.id);
      exigir(antes.every(x => x.atualizadoEm.getTime() < Date.now() - 30 * 60 * 1000), "fixture lease nao ficou vencida");
      await executar(a.id);
      conferirCanais(await registros(a.id), "ENVIADO", 2);
      aprovados.push("LEASE_EXPIRADO");
    }
    {
      const a = await assinatura("lease-valido");
      await semear(a.id, a.renovaEm.toISOString(), "VENCIMENTO_7_DIAS", "PROCESSANDO", 1, null, new Date());
      await executar(a.id);
      conferirCanais(await registros(a.id), "PROCESSANDO", 1);
      aprovados.push("LEASE_VALIDO");
    }
    {
      const a = await assinatura("limite-cinco");
      await semear(a.id, a.renovaEm.toISOString(), "VENCIMENTO_7_DIAS", "FALHOU", 5, new Date(Date.now() - MS_DIA));
      await executar(a.id);
      conferirCanais(await registros(a.id), "FALHOU", 5);
      aprovados.push("LIMITE_5_TENTATIVAS");
    }

    {
      const a = await assinatura("bloqueio-recuperacao", true);
      await semear(a.id, a.renovaEm.toISOString(), "BLOQUEIO", "FALHOU", 1, new Date(Date.now() - MS_DIA));
      await executar(a.id, BLOQUEIO_USER);
      conferirCanais(await registros(a.id), "ENVIADO", 2, "BLOQUEIO");
      const depois = await prisma.assinatura.findUnique({ where: { id: a.id }, select: { ativo: true, status: true } });
      exigir(depois?.status === "BLOQUEADA" && depois.ativo === false, "bloqueio recuperado alterou assinatura incorretamente");
      aprovados.push("BLOQUEIO_RECUPERADO");
    }
    {
      const a = await assinatura("ciclo-antigo");
      const vencimentoAntigo = new Date(a.renovaEm.getTime() - 10 * MS_DIA);
      await prisma.billingComunicacao.create({ data: {
        assinaturaId: a.id,
        cicloKey: vencimentoAntigo.toISOString(),
        evento: "VENCIMENTO_7_DIAS",
        canal: "APP",
        status: "PENDENTE",
      } });
      await executar(a.id);
      const itens = await registros(a.id);
      const antigo = itens.find(x => x.cicloKey === vencimentoAntigo.toISOString());
      exigir(antigo?.status === "PENDENTE" && antigo.tentativas === 0, "ciclo antigo foi processado");
      const atuais = itens.filter(x => x.cicloKey === a.renovaEm.toISOString());
      conferirCanais(atuais, "ENVIADO", 1);
      aprovados.push("CICLO_ANTIGO_IGNORADO");
    }
    {
      const a = await assinatura("concorrencia-simultanea");

      const resultados = await Promise.all([
        executar(a.id),
        executar(a.id),
      ]);

      exigir(
        resultados.length === 2 &&
        resultados.every((r) => r.ok === true),
        "execucoes simultaneas falharam"
      );

      const comunicacoes = await registros(a.id);

      conferirCanais(
        comunicacoes,
        "ENVIADO",
        1
      );

      exigir(
        comunicacoes.length === 2,
        "concorrencia gerou comunicacoes duplicadas"
      );

      const chaves = new Set(
        comunicacoes.map(
          (item) =>
            `${item.assinaturaId}:${item.cicloKey}:${item.evento}:${item.canal}`
        )
      );

      exigir(
        chaves.size === 2,
        "concorrencia duplicou uma chave de comunicacao"
      );

      aprovados.push("CONCORRENCIA_SIMULTANEA");
    }

    for (const cenario of aprovados) console.log(`APROVADO: ${cenario}`);
    console.log(`ETAPA6_QA_FINAL: ${aprovados.length}/8 APROVADOS`);
    console.log(`FIXTURES_ASSINATURAS: ${criadas.join(", ")}`);
    console.log("ATENCAO: este teste nao simula queda apos aceite SMTP nem mudanca de ciclo durante o envio.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("ETAPA6_QA_FINAL_FALHOU:", error);
  process.exitCode = 1;
});