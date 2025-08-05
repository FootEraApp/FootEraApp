import { Router } from "express";
import { getPerfilUsuario, getTreinosResumo, getProgressoTreinos, getPontuacaoDetalhada, atualizarPerfil, getAtividadesRecentes, getBadges, getPontuacao  } from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";
import { PrismaClient } from "@prisma/client";
import multer from "multer";

const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

const router = Router();

router.get("/me", authenticateToken, getPerfilUsuario);
router.put("/:id", authenticateToken, upload.single("foto"), async (req, res) => {
  const { nome, ...outrosCampos } = req.body;
  const file = req.file;

  try {
    const dadosAtualizados: any = {
      nome,
      ...outrosCampos,
    };

    if (file) {
      dadosAtualizados.foto = `/uploads/${file.filename}`;
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: dadosAtualizados,
    });

    return res.json(usuario);
  } catch (error) {
    console.error("Erro ao editar perfil:", error);
    return res.status(500).json({ error: "Erro ao editar perfil" });
  }
});

router.get("/:id/atividades", authenticateToken, getAtividadesRecentes);
router.get("/:id/badges", authenticateToken, getBadges);
router.get("/:id/pontuacao", authenticateToken, getPontuacao);
router.get("/:id/pontuacao/detalhada", authenticateToken, getPontuacaoDetalhada);
router.get("/:id/treinos", authenticateToken, getTreinosResumo);
router.get("/:id/progresso", authenticateToken, getProgressoTreinos);
router.get("/:id", authenticateToken, getPerfilUsuario);

export default router;