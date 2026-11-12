/** QA do 20PARABENS: elegibilidade, integridade, ano e consumo.
 * Sem Mercado Pago, sem AWS. Somente banco QA local.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

function exigirAmbienteQa(): void {
  const u = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(process.env.NODE_ENV, "test", "NODE_ENV_DEVE_SER_TEST");
  assert.ok(["postgres:", "postgresql:"].includes(u.protocol));
  assert.equal(u.hostname, "127.0.0.1");
  assert.equal(u.port, "5433");
  assert.equal(u.pathname, "/footera_billing_qa");
  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
  assert.equal(process.env.ENABLE_ACCOUNT_PURGE, "false");
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, "false");
}
exigirAmbienteQa();

async function main() {
  const { prisma } = await import("./server/prisma.js");
  const { consultarBeneficioAniversario, obterCupomAniversario } = await import(
    "./server/services/billingCupomAniversarioService.js"
  );
  const ids: string[] = [];
  const marcador = `qa_parabens_${randomUUID().replace(/-/g, "")}`;
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const br = (iso: string) => new Date(iso);
  let total = 0;
  const ok = (condicao: unknown, descricao: string) => {
    assert.ok(condicao, descricao);
    console.log(`APROVADO ${String(++total).padStart(2, "0")} — ${descricao}`);
  };
  async function criarUsuario(sufixo: string, nascimento: string) {
    const u = await prisma.usuario.create({
      data: {
        id: randomUUID(),
        nome: `QA Aniversario ${sufixo}`,
        nomeDeUsuario: `${marcador}_${sufixo}`.slice(0, 64),
        email: `${marcador}_${sufixo}@example.invalid`,
        senhaHash: `QA_${marcador}`,
        tipo: "Atleta",
        verified: true,
        dataNascimento: d(nascimento),
        aniversarioElegivelApartirDe: d("2020-01-01"),
      },
    });
    ids.push(u.id);
    return u;
  }
  const esperarErro = async (fn: () => Promise<unknown>, code: string) => {
    await assert.rejects(fn, (e: any) => e?.code === code);
  };

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, "footera_billing_qa");
    const usuario = await criarUsuario("principal", "1990-11-09");
    const aniversario = br("2026-11-09T15:00:00-03:00");
    const ontem = br("2026-11-08T15:00:00-03:00");

    ok(!(await consultarBeneficioAniversario(usuario.id, ontem)).elegivel,
      "Fora do aniversario nao elegivel");
    await esperarErro(() => obterCupomAniversario(usuario.id, "20PARABENS", ontem),
      "BIRTHDAY_COUPON_NOT_TODAY");
    ok(true, "Checkout bloqueia aniversario fora do dia");

    await prisma.usuario.update({ where: { id: usuario.id }, data: { verified: false } });
    ok(!(await consultarBeneficioAniversario(usuario.id, aniversario)).elegivel,
      "Conta nao verificada nao recebe cupom");
    await prisma.usuario.update({ where: { id: usuario.id }, data: {
      verified: true, aniversarioElegivelApartirDe: br("2026-11-10T00:00:00-03:00")
    }});
    ok(!(await consultarBeneficioAniversario(usuario.id, aniversario)).elegivel,
      "Carencia de cadastro/correcao bloqueia cupom");
    await prisma.usuario.update({ where: { id: usuario.id }, data: {
      aniversarioElegivelApartirDe: d("2020-01-01")
    }});

    const oferta = await consultarBeneficioAniversario(usuario.id, aniversario);
    ok(oferta.elegivel && oferta.disponivel && oferta.codigo === "20PARABENS" &&
      oferta.percentual === 20, "Beneficio correto no aniversario");
    ok(oferta.expiraEm === "2026-11-10T03:00:00.000Z",
      "Expiracao corresponde a meia-noite em Sao Paulo");
    ok((await obterCupomAniversario(usuario.id, "ANIVERSARIO_2026_FALSO", aniversario)) === null,
      "Codigo interno informado pelo cliente nao e aceito");

    const cupom = await obterCupomAniversario(usuario.id, "20parabens", aniversario);
    assert.ok(cupom);
    ok(cupom.codigo === `ANIVERSARIO_2026_${usuario.id}` &&
      cupom.descontoPerc === 20 && cupom.usosMax === 1 &&
      cupom.transferivel === false && cupom.concedidoParaUsuarioId === usuario.id,
      "Cupom interno e exclusivo, nao transferivel e limitado a um uso");
    const repetido = await obterCupomAniversario(usuario.id, "20PARABENS", aniversario);
    ok(repetido?.id === cupom.id, "Repeticao nao cria segundo cupom");

    await prisma.cupom.update({ where: { id: cupom.id }, data: { descontoPerc: 50 } });
    await esperarErro(() => obterCupomAniversario(usuario.id, "20PARABENS", aniversario),
      "BIRTHDAY_COUPON_INVALID_CONFIGURATION");
    ok(true, "Cupom adulterado e recusado");
    ok(!(await consultarBeneficioAniversario(usuario.id, aniversario)).disponivel,
      "Consulta nao anuncia cupom adulterado como disponivel");
    await prisma.cupom.update({ where: { id: cupom.id }, data: { descontoPerc: 20 } });

    await prisma.cupomResgate.create({ data: { cupomId: cupom.id, usuarioId: usuario.id } });
    await prisma.cupom.update({ where: { id: cupom.id }, data: { usosAtuais: 1 } });
    await esperarErro(() => obterCupomAniversario(usuario.id, "20PARABENS", aniversario),
      "BIRTHDAY_COUPON_ALREADY_USED");
    ok(true, "Resgate consumido bloqueia novo uso no ano");
    ok(!(await consultarBeneficioAniversario(usuario.id, aniversario)).disponivel,
      "Beneficio indica indisponivel apos consumo");

    await prisma.usuario.update({ where: { id: usuario.id }, data: {
      dataNascimento: d("1990-12-10"), aniversarioElegivelApartirDe: d("2020-01-01")
    }});
    await esperarErro(() => obterCupomAniversario(
      usuario.id, "20PARABENS", br("2026-12-10T15:00:00-03:00")
    ), "BIRTHDAY_COUPON_ALREADY_USED");
    ok(true, "Correcao de nascimento nao permite segundo uso no mesmo ano");

    const novoAno = await obterCupomAniversario(
      usuario.id, "20PARABENS", br("2027-12-10T15:00:00-03:00")
    );
    ok(novoAno?.id !== cupom.id && novoAno?.codigo === `ANIVERSARIO_2027_${usuario.id}`,
      "Ano posterior usa outro cupom interno");

    const bissexto = await criarUsuario("bissexto", "2000-02-29");
    ok((await consultarBeneficioAniversario(bissexto.id,
      br("2027-02-28T15:00:00-03:00"))).elegivel,
      "29/02 comemora em 28/02 no ano nao bissexto");
    ok(!(await consultarBeneficioAniversario(bissexto.id,
      br("2027-03-01T15:00:00-03:00"))).elegivel,
      "29/02 nao recebe beneficio em 01/03");
    ok((await consultarBeneficioAniversario(bissexto.id,
      br("2028-02-29T15:00:00-03:00"))).elegivel,
      "29/02 comemora em 29/02 no ano bissexto");

    console.log(`\nRESULTADO: ${total}/${total} testes de aniversario aprovados.`);
  } finally {
    try {
      if (ids.length) {
        // Restrito aos usuarios gerados nesta execucao.
        const cupons = await prisma.cupom.findMany({
          where: { codigo: { startsWith: "ANIVERSARIO_" }, concedidoParaUsuarioId: { in: ids } },
          select: { id: true },
        });
        const cupomIds = cupons.map((c) => c.id);
        if (cupomIds.length) {
          await prisma.cupomResgate.deleteMany({ where: { cupomId: { in: cupomIds } } });
          await prisma.cupomReserva.deleteMany({ where: { cupomId: { in: cupomIds } } });
          await prisma.cupom.deleteMany({ where: { id: { in: cupomIds } } });
        }
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      }
      console.log("LIMPEZA_QA: somente registros deste teste removidos.");
    } finally {
      await prisma.$disconnect();
    }
  }
}
main().catch((erro) => {
  console.error("TESTE_ANIVERSARIO_QA_FALHOU:", erro);
  process.exitCode = 1;
});