// server/routes/submissoes.ts
import { Router } from "express";
import multer from "multer";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth.js";
import { PrismaClient, TipoMidia } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({ storage });

/** Resolve o usuarioId para AtividadeRecente:
 *  - prioriza req.userId
 *  - senão, pega via Atleta.usuarioId
 */
async function resolveUsuarioIdForActivity(reqUserId: string | undefined, atletaId: string) {
  if (typeof reqUserId === "string" && reqUserId.length > 0) return reqUserId;
  const atleta = await prisma.atleta.findUnique({
    where: { id: atletaId },
    select: { usuarioId: true },
  });
  return atleta?.usuarioId || null;
}

/** SUBMISSÃO DE TREINO */
router.post(
  "/treino",
  authenticateToken,
  upload.single("arquivo"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { observacao, treinoAgendadoId, atletaId } = req.body as {
        observacao?: string;
        treinoAgendadoId: string;
        atletaId: string;
      };
      const file = req.file;

      if (!treinoAgendadoId || !atletaId || !file) {
        return res.status(400).json({ error: "Dados obrigatórios ausentes." });
      }

      const assetUrl = `/uploads/${file.filename}`;
      const isVideo = file.mimetype.startsWith("video");

      const midia = {
        url: assetUrl,
        tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem, // <-- enum correto
        dataEnvio: new Date(),
        descricao: "",
        titulo: "",
      };

      const usuarioIdForActivity = await resolveUsuarioIdForActivity(req.userId, atletaId);

      // Transação: cria submissão + cria atividade
      const [submissao] = await prisma.$transaction([
        prisma.submissaoTreino.create({
          data: {
            treinoAgendadoId,
            atletaId,
            observacao,
            usuarioId: req.userId ?? undefined,
            midias: { create: [midia] },
          },
          // Removido createdAt (não existe no seu model)
          select: {
            id: true,
            treinoAgendadoId: true,
            atletaId: true,
            usuarioId: true,
            observacao: true,
          },
        }),
        ...(usuarioIdForActivity
          ? [
              prisma.atividadeRecente.create({
                data: {
                  usuarioId: usuarioIdForActivity,
                  tipo: "treino",
                  imagemUrl: assetUrl, // filename já é único
                },
              }),
            ]
          : []),
      ]);

      return res.status(201).json(submissao);
    } catch (error) {
      console.error("Erro ao salvar submissão de treino:", error);
      return res.status(500).json({ error: "Erro ao salvar submissão de treino" });
    }
  }
);

/** SUBMISSÃO DE DESAFIO */
router.post(
  "/desafio",
  authenticateToken,
  upload.single("arquivo"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { observacao, desafioId, atletaId } = req.body as {
        observacao?: string;
        desafioId: string;
        atletaId: string;
      };
      const file = req.file;

      if (!desafioId || !atletaId || !file) {
        return res.status(400).json({ error: "Dados obrigatórios ausentes." });
      }

      const assetUrl = `/uploads/${file.filename}`;
      const isVideo = file.mimetype.startsWith("video");

      const midia = {
        url: assetUrl,
        tipo: isVideo ? TipoMidia.Video : TipoMidia.Imagem, // <-- enum correto
        dataEnvio: new Date(),
        descricao: "",
        titulo: "",
      };

      const data: any = {
        desafioId,
        atletaId,
        observacao,
        midias: { create: [midia] },
      };
      if (isVideo) data.videoUrl = assetUrl;
      if (typeof req.userId === "string") data.usuarioId = req.userId;

      const usuarioIdForActivity = await resolveUsuarioIdForActivity(req.userId, atletaId);

      // Transação: cria submissão + cria atividade
      const [submissao] = await prisma.$transaction([
        prisma.submissaoDesafio.create({
          data,
          // Evita tocar em colunas que não existem (ex.: conteudo/createdAt)
          select: {
            id: true,
            desafioId: true,
            atletaId: true,
            usuarioId: true,
            observacao: true,
            videoUrl: true,
            aprovado: true,
          },
        }),
        ...(usuarioIdForActivity
          ? [
              prisma.atividadeRecente.create({
                data: {
                  usuarioId: usuarioIdForActivity,
                  tipo: "desafio",
                  imagemUrl: assetUrl,
                },
              }),
            ]
          : []),
      ]);

      return res.status(201).json(submissao);
    } catch (error) {
      console.error("Erro ao salvar submissão de desafio:", error);
      return res.status(500).json({ error: "Erro ao salvar submissão de desafio" });
    }
  }
);

export default router;
