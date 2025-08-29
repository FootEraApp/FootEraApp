import express from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import { prisma } from "server/lib/prisma.js";
import multer from "multer";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import { Prisma, StatusDesafioGrupo, TipoMensagem } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "../../public/uploads")),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    return cb(new Error("Apenas vídeos são permitidos"));
  },
});

router.get("/", authenticateToken, async (req, res) => {
  const atletaId =
    typeof req.query.atletaId === "string"
      ? (req.query.atletaId as string)
      : typeof req.query.tipoUsuarioId === "string"
      ? (req.query.tipoUsuarioId as string)
      : undefined;

  try {
    const where = atletaId
      ? { submissoes: { none: { atletaId } } }
      : undefined;

    const desafios = await prisma.desafioOficial.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.json(desafios);
  } catch (err) {
    console.error("Erro ao buscar desafios:", err);
    return res.status(500).json({ error: "Erro interno ao buscar desafios" });
  }
});

router.get("/submissoes", authenticateToken, async (req, res) => {
  try {
    const viewerId = (req as any).userId as string;

    const submissoes = await prisma.submissaoDesafio.findMany({
      include: {
        desafio: true,
        midias: true,
        atleta: { include: { usuario: true } },
        curtidas: { select: { usuarioId: true } },
        _count: { select: { curtidas: true, comentarios: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const payload = submissoes.map((s) => ({
      ...s,
      curtidasCount: s._count.curtidas,
      comentariosCount: s._count.comentarios,
      viewerLiked: s.curtidas.some((c) => c.usuarioId === viewerId),
    }));

    return res.json(payload);
  } catch (err) {
    console.error("Erro ao buscar submissões:", err);
    return res.status(500).json({ error: "Erro interno ao buscar submissões" });
  }
});

router.post("/em-grupo", authenticateToken, async (req, res) => {
  const { grupoId, desafioOficialId } = req.body;
  const userId = (req as any).userId;

  if (!grupoId || !desafioOficialId) {
    return res.status(400).json({ error: "grupoId e desafioOficialId são obrigatórios" });
  }

  try {
    const membrosDoGrupo = await prisma.membroGrupo.findMany({
      where: { grupoId },
      select: { usuarioId: true },
    });

    const usuariosParaConectar = membrosDoGrupo.map((m) => ({ id: m.usuarioId }));

    const desafio = await prisma.desafioOficial.findUnique({
      where: { id: desafioOficialId },
      select: { titulo: true, pontuacao: true, prazoSubmissao: true },
    });

    const expiraEm = desafio?.prazoSubmissao ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const desafioEmGrupo = await prisma.desafioEmGrupo.create({
      data: {
        grupo: { connect: { id: grupoId } },
        desafioOficial: { connect: { id: desafioOficialId } },
        criadoPor: { connect: { id: userId } },

        status: StatusDesafioGrupo.ativo,
        dataExpiracao: expiraEm,

        membros: { connect: usuariosParaConectar },
        pontosSnapshot: desafio?.pontuacao ?? null,
        bonus: (desafio?.pontuacao ?? 0) * 2,
      },
      include: {
        membros: true,
        desafioOficial: true,
      },
    });

     const payload: Prisma.JsonObject = {
      desafioEmGrupoId: desafioEmGrupo.id,
      desafioOficialId,
      titulo: desafioEmGrupo.desafioOficial.titulo,
      prazo: expiraEm.toISOString(),
      pontuacao:
        desafioEmGrupo.pontosSnapshot ??
        desafioEmGrupo.desafioOficial.pontuacao ??
        0,
      linkSubmissao: `/desafios/grupo/${grupoId}/${desafioOficialId}/submeter`,
    };

    await prisma.mensagemGrupo.create({
      data: {
        grupo: { connect: { id: grupoId } },
        usuario: { connect: { id: userId } },
        desafioEmGrupo: { connect: { id: desafioEmGrupo.id } },

        tipo: TipoMensagem.GRUPO_DESAFIO,
        conteudo: `Desafio "${desafioEmGrupo.desafioOficial.titulo}" confirmado! Prazo: ${new Date(expiraEm).toLocaleDateString()}. Pontuação: ${
          desafioEmGrupo.pontosSnapshot ??
          desafioEmGrupo.desafioOficial.pontuacao ??
          0
        }`,
        conteudoJson: payload,
      },
    });

    return res.status(201).json(desafioEmGrupo);
  } catch (err) {
    console.error("Erro ao criar desafio em grupo:", err);
    return res.status(500).json({ error: "Erro interno ao criar desafio em grupo" });
  }
});

router.post("/submissoes-grupo", authenticateToken, async (req, res) => {
  const { desafioId, videoUrl, observacao, desafioEmGrupoId } = req.body;

  const userId = (req as any).userId;
  const tipoUsuarioId = (req as any).tipoUsuarioId;

  if (!desafioId || !videoUrl || !desafioEmGrupoId) {
    return res.status(400).json({
      error: "Campos obrigatórios: desafioId, videoUrl, desafioEmGrupoId",
    });
  }

  try {
    const submissao = await prisma.submissaoDesafio.create({
      data: {
        atletaId: tipoUsuarioId,  
        usuarioId: userId,        
        desafioId,
        videoUrl,
        observacao,
        aprovado: false,
      },
    });

    const submissaoEmGrupo = await prisma.submissaoDesafioEmGrupo.create({
      data: {
        submissaoDesafioId: submissao.id,
        desafioEmGrupoId,
        usuarioId: userId,
      },
    });

    return res.status(201).json({
      message: "Submissão em grupo criada com sucesso",
      submissao,
      submissaoEmGrupo,
    });
  } catch (err) {
    console.error("Erro ao criar submissão em grupo:", err);
    return res.status(500).json({ error: "Erro interno ao criar submissão em grupo" });
  }
});

router.post("/upload/file", authenticateToken, (req, res) => {
  upload.single("arquivo")(req, res, (err: any) => {
    if (err && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Arquivo excede 200MB." });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "Falha no upload." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    return res.status(201).json({
      message: "Upload realizado com sucesso",
      url: fileUrl,
    });
  });
});

router.get("/em-grupo/:grupoId/ativo", authenticateToken, async (req, res) => {
  const { grupoId } = req.params;

  try {
    const desafioEmGrupo = await prisma.desafioEmGrupo.findFirst({
      where: {
        grupoId,
        status: "ativo",
        dataExpiracao: { gte: new Date() },
      },
      include: {
        desafioOficial: true,
        membros: {
          select: { id: true, nome: true, foto: true },
        },
        submissaoEmGrupo: {
          include: {
            usuario: {
              select: { id: true, nome: true, foto: true },
            },
          },
        },
      },
    });

    if (!desafioEmGrupo) {
      return res.status(404).json({
        error: "Nenhum desafio em grupo ativo encontrado para este grupo",
      });
    }

    const totalMembros = desafioEmGrupo.membros.length;
    const participantesComSubmissao = new Set(
      desafioEmGrupo.submissaoEmGrupo.map((s) => s.usuarioId)
    ).size;

    const progresso =
      totalMembros > 0
        ? Math.round((participantesComSubmissao / totalMembros) * 100)
        : 0;

    return res.json({
      ...desafioEmGrupo,
      meta: {
        totalMembros,
        participantesComSubmissao,
        progresso,
      },
    });
  } catch (err) {
    console.error("Erro ao buscar desafio em grupo ativo:", err);
    return res
      .status(500)
      .json({ error: "Erro interno ao buscar desafio em grupo ativo" });
  }
});

router.get("/oficiais", authenticateToken, async (_req, res) => {
  try {
    const desafios = await prisma.desafioOficial.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(desafios);
  } catch (e) {
    console.error("Erro ao listar desafios oficiais:", e);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const desafio = await prisma.desafioOficial.findUnique({
      where: { id },
    });

    if (!desafio) {
      return res.status(404).json({ error: "Desafio não encontrado" });
    }

    return res.json(desafio);
  } catch (err) {
    console.error("Erro ao buscar desafio por id:", err);
    return res.status(500).json({ error: "Erro interno ao buscar desafio" });
  }
});
{/* Pagina de desafios funções para curtir comentar e compartilhar */}

// --- CURTIR/REMOVER CURTIDA numa submissão ---
router.post("/submissoes/:id/like", authenticateToken, async (req, res) => {
  try {
    const usuarioId = (req as any).userId as string;
    const submissaoId = req.params.id;

    if (!usuarioId) return res.status(401).json({ error: "Não autenticado" });

    const existente = await prisma.curtida.findFirst({
      where: { usuarioId, submissaoId },
    });

    if (existente) {
      await prisma.curtida.delete({ where: { id: existente.id } });
    } else {
      await prisma.curtida.create({ data: { usuarioId, submissaoId } });
    }

    const count = await prisma.curtida.count({ where: { submissaoId } });
    return res.json({ liked: !existente, count });
  } catch (e) {
    console.error("Erro ao curtir submissão:", e);
    return res.status(500).json({ error: "Erro ao curtir submissão" });
  }
});

// --- COMENTAR numa submissão ---
router.post("/submissoes/:id/comentarios", authenticateToken, async (req, res) => {
  try {
    const usuarioId = (req as any).userId as string;
    const submissaoId = req.params.id;
    const { conteudo } = req.body as { conteudo?: string };

    if (!usuarioId) return res.status(401).json({ error: "Não autenticado" });
    if (!conteudo || !conteudo.trim()) {
      return res.status(400).json({ error: "conteudo é obrigatório" });
    }

    const comentario = await prisma.comentario.create({
      data: { usuarioId, submissaoId, conteudo: conteudo.trim() },
      include: { usuario: { select: { id: true, nome: true, foto: true } } },
    });

    const count = await prisma.comentario.count({ where: { submissaoId } });

    return res.status(201).json({ comentario, count });
  } catch (e) {
    console.error("Erro ao comentar submissão:", e);
    return res.status(500).json({ error: "Erro ao comentar submissão" });
  }
});

// LISTAR comentários de uma submissão (usado pelo modal)
router.get("/submissoes/:id/comentarios", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // opcional: validar existência
    const exists = await prisma.submissaoDesafio.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: "Submissão não encontrada" });

    const comentarios = await prisma.comentario.findMany({
      where: { submissaoId: id }, // <- requer schema com submissaoId
      include: { usuario: { select: { id: true, nome: true, foto: true } } },
      orderBy: { dataCriacao: "asc" },
    });

    return res.json(comentarios);
  } catch (e) {
    console.error("Erro ao buscar comentários da submissão:", e);
    return res.status(500).json({ error: "Erro interno ao buscar comentários" });
  }
});


export default router;