// server/routes/submissoes
import { Router } from "express";
import multer from "multer";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;
const router = Router();

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (_, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  }
});

const upload = multer({ storage });

router.post(
  "/treino",
  authenticateToken,
  upload.single("arquivo"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { observacao, treinoAgendadoId, atletaId } = req.body;
      const file = req.file;

      if (!treinoAgendadoId || !atletaId || !file) {
        return res.status(400).json({ error: "Dados obrigatórios ausentes." });
      }

      const submissao = await prisma.submissaoTreino.create({
        data: {
          treinoAgendadoId,
          atletaId,
          observacao,
          usuarioId: req.userId ?? undefined,
          midias: {
            create: [
              {
                url: `/uploads/${file.filename}`,
                tipo: file.mimetype.startsWith("video") ? "Video" : "Imagem",
                dataEnvio: new Date(),
                descricao: "",
                titulo: ""
              }
            ],
          },
        },
      });

      return res.status(201).json(submissao);
    } catch (error) {
      console.error("Erro ao salvar submissão de treino:", error);
      return res.status(500).json({ error: "Erro ao salvar submissão de treino" });
    }
  }
);

router.post(
  "/desafio",
  authenticateToken,
  upload.single("arquivo"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { observacao, desafioId, atletaId } = req.body;
      const file = req.file;

      if (!desafioId || !atletaId || !file) {
        return res.status(400).json({ error: "Dados obrigatórios ausentes." });
      }

      const assetUrl = `/uploads/${file.filename}`;
      const isVideo = file.mimetype.startsWith("video");

      const midia = {
        url: assetUrl,
        tipo: isVideo ? "Video" : "Imagem",
        dataEnvio: new Date(),
        descricao: "",
        titulo: ""
      };

      const data: any = {
        desafioId,
        atletaId,
        observacao,
        midias: {
          create: [midia],
        },
      };

      if (isVideo) data.videoUrl = assetUrl;

      if (typeof req.userId === "string") {
        data.usuarioId = req.userId;
      }

      const submissao = await prisma.submissaoDesafio.create({ data });

      return res.status(201).json(submissao);
    } catch (error) {
      console.error("Erro ao salvar submissão de desafio:", error);
      return res.status(500).json({ error: "Erro ao salvar submissão de desafio" });
    }
  }
);

export default router;