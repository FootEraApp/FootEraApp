import { Router } from "express";
import { prisma } from "../lib/prisma";
import multer from "multer";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth";

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
          usuarioId: req.userId,
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
      console.error("Erro ao salvar submissão:", error);
      return res.status(500).json({ error: "Erro ao salvar submissão" });
    }
  }
);

export default router;