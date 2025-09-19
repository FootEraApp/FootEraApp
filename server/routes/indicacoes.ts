import { Router } from "express";
import { PrismaClient, IndicacaoStatus } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

function getOlheiroIdFromReq(req: any): string | null {
  return (
    req?.user?.tipoUsuarioId ||
    (req.headers["x-tipo-usuario-id"] as string) ||
    null
  );
}

router.post("/", async (req, res) => {
  try {
    const olheiroId = getOlheiroIdFromReq(req);
    if (!olheiroId) return res.status(401).json({ error: "Não autenticado como olheiro." });

    const { atletaId, clubeId } = req.body || {};
    if (!atletaId || !clubeId) return res.status(400).json({ error: "Informe atletaId e clubeId." });

    const [olheiro, atleta, clube] = await Promise.all([
      prisma.olheiro.findUnique({ where: { id: olheiroId } }),
      prisma.atleta.findUnique({ where: { id: atletaId } }),
      prisma.clube.findUnique({ where: { id: clubeId } }),
    ]);
    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado." });
    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado." });
    if (!clube) return res.status(404).json({ error: "Clube não encontrado." });

    const created = await prisma.indicacao.create({
      data: { olheiroId, atletaId, clubeId, status: IndicacaoStatus.PENDENTE },
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
      where: { olheiroId: id },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        status: true,
        criadoEm: true,
        atleta: { select: { id: true, nome: true, foto: true } },
        clube: { select: { id: true, nome: true, logo: true } },
      },
    });

    const payload = list.map((i) => ({
      id: i.id,
      criadoEm: i.criadoEm,
      status: i.status as "PENDENTE" | "APROVADA" | "REJEITADA",
      atleta: { id: i.atleta.id, nome: i.atleta.nome || "Atleta", foto: i.atleta.foto },
      clube: { id: i.clube.id, nome: i.clube.nome, logo: i.clube.logo },
    }));

    return res.json(payload);
  } catch (e: any) {
    console.error("GET /api/olheiros/:id/indicacoes", e);
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
      where: { id },
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