import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken } from "server/middlewares/auth.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/perfil/olheiro/:id", async (req, res) => {
  try {
    let { id } = req.params;

    if (id === "me" && req.user?.tipoUsuarioId) id = req.user.tipoUsuarioId;

    const olheiro = await prisma.olheiro.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nome: true, email: true, foto: true, nomeDeUsuario: true } },
        colaboracaoClube: { select: { id: true, nome: true, logo: true } },
      },
    });
    if (!olheiro) return res.status(404).json({ error: "Olheiro não encontrado." });

    const [indicacoesTot, indicacoesAprov, atletasAssinados] = await Promise.all([
      prisma.indicacao.count({ where: { olheiroId: id } }),
      prisma.indicacao.count({ where: { olheiroId: id, status: "APROVADA" } }),
      prisma.indicacao.count({ where: { olheiroId: id, status: "APROVADA" } }),
    ]);
    const taxaAprov = indicacoesTot > 0 ? indicacoesAprov / indicacoesTot : 0;

    const atletasUnicos = await prisma.indicacao.findMany({
      where: { olheiroId: id },
      select: { atletaId: true },
      distinct: ["atletaId"],
    });

    const reputacaoPersistida = olheiro.reputacaoScore ?? 0;

    const payload = {
      tipo: "Olheiro" as const,
      usuario: {
        id: olheiro.usuario.id,
        nome: olheiro.usuario.nome,
        email: olheiro.usuario.email,
        foto: olheiro.usuario.foto,
        nomeDeUsuario: olheiro.usuario.nomeDeUsuario || null,
      },
      olheiro: {
        id: olheiro.id,
        usuarioId: olheiro.usuarioId,
        fotoUrl: olheiro.fotoUrl,
        headline: olheiro.headline,
        descricao: olheiro.descricao,
        areaAtuacao: olheiro.areaAtuacao,
        anosExperiencia: olheiro.anosExperiencia,
        emailPublico: olheiro.emailPublico,
        telefonePublico: olheiro.telefonePublico,
        siteOuLinkedin: olheiro.siteOuLinkedin,
        colaboracaoClube: olheiro.colaboracaoClube
          ? { id: olheiro.colaboracaoClube.id, nome: olheiro.colaboracaoClube.nome, logo: olheiro.colaboracaoClube.logo }
          : null,
        reputacaoScore: reputacaoPersistida,
        totalIndicacoes: olheiro.totalIndicacoes,
      },
      metrics: {
        atletasAcompanhados: atletasUnicos.length,
        indicacoesEnviadas: indicacoesTot,
        reputacaoScore: reputacaoPersistida,
        indicacoesAprovadas: indicacoesAprov,
        taxaAprovacao: taxaAprov,
        atletasAssinados: atletasAssinados,
      },
    };

    return res.json(payload);
  } catch (e: any) {
    console.error("GET /api/perfil/olheiro/:id", e);
    return res.status(500).json({ error: "Falha ao carregar perfil do olheiro." });
  }
});

router.patch("/olheiros/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { colaboracaoClubeId } = req.body || {};

    if (colaboracaoClubeId != null) {
      const club = await prisma.clube.findUnique({ where: { id: colaboracaoClubeId } });
      if (!club) return res.status(404).json({ error: "Clube não encontrado." });
    }

    const updated = await prisma.olheiro.update({
      where: { id },
      data: { colaboracaoClubeId: colaboracaoClubeId ?? null },
      include: { colaboracaoClube: { select: { id: true, nome: true, logo: true } } },
    });

    return res.json({
      id: updated.id,
      colaboracaoClube: updated.colaboracaoClube
        ? { id: updated.colaboracaoClube.id, nome: updated.colaboracaoClube.nome, logo: updated.colaboracaoClube.logo }
        : null,
    });
  } catch (e: any) {
    console.error("PATCH /api/olheiros/:id", e);
    return res.status(500).json({ error: "Falha ao atualizar olheiro." });
  }
});


router.get("/olheiros/:id/observados", authenticateToken, async (req, res) => {
  try {
    let { id } = req.params;
    if (id === "me" && (req.user as any)?.tipoUsuarioId) {
      id = (req.user as any).tipoUsuarioId;
    }

    // ⚠️ para Olheiro você marcou professor/clube/escolinha = null
    type Row = Prisma.AtletaObservadoGetPayload<{
      include: {
        atleta: {
          include: {
            usuario: { select: { id: true; nome: true; foto: true } };
          };
        };
      };
    }>;

    const rows: Row[] = await prisma.atletaObservado.findMany({
      where: { professorId: null, clubeId: null, escolinhaId: null },
      include: {
        atleta: {
          include: {
            usuario: { select: { id: true, nome: true, foto: true } },
          },
        },
      },
      // ✅ nome correto do campo no schema
      orderBy: { criadoEm: "desc" },
    });

    const data = rows.map((r) => ({
      id: r.atleta?.usuario?.id ?? r.atletaId,
      nome: r.atleta?.usuario?.nome ?? "Atleta",
      foto: r.atleta?.usuario?.foto ?? null,
      // Como usamos include, os escalares de Atleta vêm tipados
      posicao: r.atleta?.posicao ?? null,
      idade: r.atleta?.idade ?? null,
    }));

    res.json(data);
  } catch (e) {
    console.error("GET /olheiros/:id/observados", e);
    res.status(500).json({ error: "Falha ao listar observados." });
  }
});

export default router;