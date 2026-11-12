import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new Error("QA_ABORTADO: DATABASE_URL inválida"); }
  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) throw new Error("QA_ABORTADO: somente banco local footera_billing_qa");

  const { prisma } = await import("./server/prisma.js");
  const criados: { cupomId: string; codigo: string }[] = [];
  const pagamentosCriados = new Set<string>();
  let aprovados = 0, falhas = 0;

  async function verificar(nome: string, fn: () => Promise<void>) {
    try { await fn(); aprovados++; console.log("✔", nome); }
    catch (e) { falhas++; console.error("✖", nome, e); }
  }

  try {
    const db = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome, "footera_billing_qa");

    const candidatos = await prisma.atleta.findMany({
      select: { usuarioId: true }, take: 250,
    });
    const usuarios: string[] = [];
    for (const c of candidatos) {
      if (usuarios.includes(c.usuarioId)) continue;
      const trial = await prisma.assinatura.count({
        where: {
          usuarioId: c.usuarioId, status: "TRIAL", ativo: true,
          trialEndsAt: { gt: new Date(Date.now() + 7 * 86400000) },
        },
      });
      if (!trial) usuarios.push(c.usuarioId);
      if (usuarios.length === 2) break;
    }
    assert.equal(usuarios.length, 2, "QA_SEM_DOIS_ATLETAS: requer dois usuários Atleta sem trial longo");
    console.log("[QA] Compradores:", usuarios);

    const { startCheckout } = await import("./server/controllers/billingController.js");
    const pagador = { nome: "Comprador QA", email: "comprador-qa@example.com" };
    const contexto = {
      kind: "PERSONAL", tipoUsuario: "Atleta", role: "Atleta",
      profileId: null, tipoUsuarioId: null,
    };

    async function checkout(usuarioId: string, codigo: string) {
      let status = 200; let corpo: any = null;
      const req: any = {
        userId: usuarioId,
        authUser: { id: usuarioId, activeContext: contexto },
        body: {
          planoId: "ATLETA_PRO", periodicidade: "Mensal", metodo: "PIX",
          pagador, cupom: codigo, valor: 0.01,
        },
      };
      const res: any = {
        status(n: number) { status = n; return this; },
        json(v: unknown) { corpo = v; return this; },
        send(v: unknown) { corpo = v; return this; },
      };
      try {
        await startCheckout(req, res);
      } catch (erro) {
        // Algumas falhas transacionais podem chegar como exceção;
        // ainda assim vamos auditar o resultado persistido.
        return { status: 500, corpo: { erro: String(erro) }, usuarioId };
      }
      if (typeof corpo?.pagamento?.id === "string")
        pagamentosCriados.add(corpo.pagamento.id);
      return { status, corpo, usuarioId };
    }

    async function criarCupom(usosMax: number) {
      const codigo = `QA-RACE-${randomUUID()}`;
      const c = await prisma.cupom.create({
        data: {
          codigo, tipo: "PERCENTUAL", descontoPerc: 10, ativo: true, usosMax,
        },
      });
      criados.push({ cupomId: c.id, codigo });
      return c;
    }

    async function conferirEstado(
      cupomId: string, expected: number, vencedores: string[]
    ) {
      const reservas = await prisma.cupomReserva.findMany({
        where: { cupomId },
        include: { pagamento: true },
      });
      assert.equal(reservas.length, expected, "Quantidade de reservas incorreta");
      assert.equal(
        new Set(reservas.map((r) => r.usuarioId)).size,
        expected,
        "Mesmo comprador não pode ganhar duas reservas"
      );
      for (const r of reservas) {
        assert.equal(r.status, "RESERVADA");
        assert.ok(vencedores.includes(r.usuarioId));
        assert.equal(r.pagamento.status, "PENDENTE");
        assert.equal(r.pagamento.provider, "INTERNAL_FAKE");
        assert.equal(r.pagamento.valor.mul(100).toNumber(), 1791);
        assert.equal((r.pagamento.meta as any)?.financeiroV1?.totalCentavos, 1791);
        pagamentosCriados.add(r.pagamentoId);
      }
      const cupom = await prisma.cupom.findUniqueOrThrow({ where: { id: cupomId } });
      assert.equal(cupom.usosAtuais, 0, "Reservar não deve consumir usosAtuais");
      const pagamentos = await prisma.pagamento.count({ where: { cupomId } });
      assert.equal(pagamentos, expected, "Pagamentos órfãos encontrados");
    }

    const umUso = await criarCupom(1);
    const tentativasDiferentes = await Promise.all(
      usuarios.map((u) => checkout(u, umUso.codigo))
    );
    console.log("[QA] Limite 1, resultados:", tentativasDiferentes.map(
      x => ({ usuarioId: x.usuarioId, http: x.status, code: x.corpo?.code })
    ));

    await verificar("Dois usuarios, ultimo uso: somente um checkout aceito", async () => {
      const vencedores = tentativasDiferentes.filter((r) => r.status === 200);
      assert.equal(vencedores.length, 1, JSON.stringify(tentativasDiferentes));
      assert.notEqual(tentativasDiferentes.find((r) => r.status !== 200)?.status, undefined);
    });
    await verificar("Ultimo uso: somente uma reserva e pagamento pendente", async () => {
      const vencedores = tentativasDiferentes.filter((r) => r.status === 200);
      await conferirEstado(umUso.id, 1, vencedores.map((r) => r.usuarioId));
    });

    const mesmoUsuario = await criarCupom(2);
    const tentativasMesmo = await Promise.all([
      checkout(usuarios[0], mesmoUsuario.codigo),
      checkout(usuarios[0], mesmoUsuario.codigo),
    ]);
    console.log("[QA] Mesmo usuario, resultados:", tentativasMesmo.map(
      r => ({ http: r.status, code: r.corpo?.code })
    ));

    await verificar("Mesmo usuario em paralelo: apenas um checkout aceito", async () => {
      assert.equal(tentativasMesmo.filter(r => r.status === 200).length, 1,
        JSON.stringify(tentativasMesmo));
    });
    await verificar("Mesmo usuario: nenhuma reserva ou pagamento duplicado", async () => {
      await conferirEstado(mesmoUsuario.id, 1, [usuarios[0]]);
    });

    const doisUsos = await criarCupom(2);
    const tentativasPermitidas = await Promise.all(
      usuarios.map(u => checkout(u, doisUsos.codigo))
    );
    await verificar("Dois usuarios e dois usos: ambos aceitos", async () => {
      assert.equal(tentativasPermitidas.filter(r => r.status === 200).length, 2,
        JSON.stringify(tentativasPermitidas));
    });
    await verificar("Dois usos: duas reservas, sem consumo antecipado", async () => {
      await conferirEstado(doisUsos.id, 2, usuarios);
    });
  } finally {
    try {
      if (falhas > 0) {
        console.warn("[QA] Falha detectada: fixtures preservadas para auditoria.", criados);
      } else {
        await prisma.$transaction(async (tx) => {
          for (const { cupomId, codigo } of criados) {
            const c = await tx.cupom.findUniqueOrThrow({ where: { id: cupomId } });
            if (c.codigo !== codigo || !codigo.startsWith("QA-RACE-") ||
                c.usosAtuais !== 0) throw new Error("QA_CLEANUP_CUPOM_INESPERADO");

            const pagamentos = await tx.pagamento.findMany({
              where: { cupomId }, include: { beneficios: true },
            });
            const reservas = await tx.cupomReserva.findMany({ where: { cupomId } });
            if (pagamentos.length !== reservas.length)
              throw new Error("QA_CLEANUP_PAGAMENTO_SEM_RESERVA");
            for (const pg of pagamentos) {
              const reserva = reservas.find(r => r.pagamentoId === pg.id);
              if (!reserva || reserva.status !== "RESERVADA" ||
                  pg.status !== "PENDENTE" || pg.provider !== "INTERNAL_FAKE" ||
                  pg.beneficios.length ||
                  await tx.cupomResgate.count({ where: { pagamentoId: pg.id } }) ||
                  await tx.creatorVenda.count({ where: { pagamentoId: pg.id } }))
                throw new Error("QA_CLEANUP_ESTADO_INESPERADO");
            }
            await tx.cupomReserva.deleteMany({ where: { cupomId } });
            for (const pg of pagamentos) await tx.pagamento.delete({ where: { id: pg.id } });
            if (await tx.cupomResgate.count({ where: { cupomId } }))
              throw new Error("QA_CLEANUP_RESGATE_INESPERADO");
            await tx.cupom.delete({ where: { id: cupomId } });
          }
        });
        console.log("[QA] Reservas, pagamentos e cupons temporarios removidos.");
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\nRESULTADO: ${aprovados}/${aprovados + falhas}`);
  if (falhas) process.exitCode = 1;
}

main().catch(e => { console.error("TESTE INTERROMPIDO:", e); process.exitCode = 1; });