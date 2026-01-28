import { Router } from "express";
import { PrismaClient, IndicacaoStatus } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

function getOlheiroIdFromReq(req: any): string | null {
  return (
    req?.user?.tipoUsuarioId ||
    req?.userCtx?.tipoUsuarioId ||
    req?.userCtx?.tipoUsuarioIdRaw ||
    (req.headers["x-tipo-usuario-id"] as string) ||
    null
  );
}

function getTipoUsuarioFromReq(req: any): string | null {
  return (
    req?.user?.tipoUsuario ||
    req?.userCtx?.tipoUsuario ||
    (req.headers["x-tipo-usuario"] as string) ||
    null
  );
}

router.post("/", async (req, res) => {
  try {
    const olheiroId = getOlheiroIdFromReq(req);
    if (!olheiroId) {
      return res.status(401).json({ error: "Não autenticado como olheiro." });
    }

    // ✅ AQUI é onde entra o seu trecho do "tipo"
    const tipo = getTipoUsuarioFromReq(req);
    if (tipo && tipo.toLowerCase() !== "olheiro") {
      return res.status(403).json({ error: "Apenas olheiro pode criar indicação." });
    }

    const { atletaId, clubeId, escolinhaId } = req.body || {};

    if (!atletaId) {
      return res.status(400).json({ error: "Informe atletaId." });
    }

    // exatamente 1 destino
    const hasClube = Boolean(clubeId);
    const hasEscolinha = Boolean(escolinhaId);

    if ((hasClube && hasEscolinha) || (!hasClube && !hasEscolinha)) {
      return res
        .status(400)
        .json({ error: "Informe clubeId OU escolinhaId (apenas um)." });
    }

    const [olheiro, atleta] = await Promise.all([
      prisma.olheiro.findUnique({ where: { id: olheiroId } }),
      prisma.atleta.findUnique({ where: { id: String(atletaId) } }),
    ]);

    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado." });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado." });

    // ✅ Clube
    if (hasClube) {
      const clube = await prisma.clube.findUnique({
        where: { id: String(clubeId) },
      });
      if (!clube) return res.status(404).json({ error: "Clube não encontrado." });

      const created = await prisma.indicacao.create({
        data: {
          olheiroId,
          atletaId: String(atletaId),
          clubeId: String(clubeId),
          status: IndicacaoStatus.PENDENTE,
        },
        select: { id: true, status: true, criadoEm: true },
      });

      await prisma.olheiro.update({
        where: { id: olheiroId },
        data: { totalIndicacoes: { increment: 1 } },
      });

      return res.status(201).json(created);
    }

    // ✅ Escolinha
    const escolinha = await prisma.escolinha.findUnique({
      where: { id: String(escolinhaId) },
    });
    if (!escolinha) {
      return res.status(404).json({ error: "Escolinha não encontrada." });
    }

    const created = await prisma.indicacao.create({
      data: {
        olheiroId,
        atletaId: String(atletaId),
        escolinhaId: String(escolinhaId),
        status: IndicacaoStatus.PENDENTE,
      },
      select: { id: true, status: true, criadoEm: true },
    });

    await prisma.olheiro.update({
      where: { id: olheiroId },
      data: { totalIndicacoes: { increment: 1 } },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error("POST /api/indicacoes", e);
    return res.status(500).json({ error: "Falha ao criar indicação." });
  }
});

router.get("/olheiros/:id/indicacoes", async (req, res) => {
  try {
    const { id } = req.params;

    const list = await prisma.indicacao.findMany({
      where: { olheiroId: String(id) },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        status: true,
        criadoEm: true,
        atleta: { select: { id: true, nome: true, foto: true } },
        clube: { select: { id: true, nome: true, logo: true } },
        escolinha: { select: { id: true, nome: true, logo: true } },
      },
    });

    const payload = list.map((i) => ({
      id: i.id,
      criadoEm: i.criadoEm,
      status: i.status as "PENDENTE" | "APROVADA" | "REJEITADA",
      atleta: {
        id: i.atleta.id,
        nome: i.atleta.nome || "Atleta",
        foto: i.atleta.foto,
      },
      destino: i.clube
        ? { tipo: "Clube" as const, id: i.clube.id, nome: i.clube.nome, logo: i.clube.logo }
        : i.escolinha
        ? { tipo: "Escolinha" as const, id: i.escolinha.id, nome: i.escolinha.nome, logo: i.escolinha.logo }
        : null,
    }));

    return res.json(payload);
  } catch (e: any) {
    console.error("GET /api/indicacoes/olheiros/:id/indicacoes", e);
    return res.status(500).json({ error: "Falha ao listar indicações." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!["PENDENTE", "APROVADA", "REJEITADA"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const updated = await prisma.indicacao.update({
      where: { id: String(id) },
      data: { status },
      select: { id: true, status: true, atualizadoEm: true, olheiroId: true },
    });

    if (status === "APROVADA") {
      await prisma.olheiro.update({
        where: { id: updated.olheiroId },
        data: { reputacaoScore: { increment: 10 } },
      });
    }

    return res.json(updated);
  } catch (e: any) {
    console.error("PATCH /api/indicacoes/:id/status", e);
    return res.status(500).json({ error: "Falha ao atualizar status." });
  }
});

export default router;