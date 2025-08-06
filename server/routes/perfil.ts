import { Router } from "express";
import { getPerfilUsuario, getTreinosResumo, getProgressoTreinos, getPontuacaoDetalhada, atualizarPerfil, getAtividadesRecentes, getBadges, getPontuacao  } from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";
import { PrismaClient, TipoUsuario } from "@prisma/client";
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
  const { nome, email, tipoUsuario, cref, areaFormacao, escola, qualificacoes, certificacoes } = req.body;
  const { id } = req.params;
  const file = req.file;

  try {
    const dadosUsuario: any = {};

    const usuarioExistente = await prisma.usuario.findUnique({ where: { id } });
    if (!usuarioExistente) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    if (nome) dadosUsuario.nome = nome;
    if (email) dadosUsuario.email = email;
    if (tipoUsuario) dadosUsuario.tipo = tipoUsuario as TipoUsuario;

    if (file) {
      dadosUsuario.foto = `/uploads/${file.filename}`;
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: dadosUsuario,
    });

    const dadosProfessor: any = {
      cref,
      areaFormacao,
      escola: escola || null,
      qualificacoes: Array.isArray(qualificacoes) ? qualificacoes : JSON.parse(qualificacoes),
      certificacoes: Array.isArray(certificacoes) ? certificacoes : JSON.parse(certificacoes),

    };

    if (file) {
      dadosProfessor.fotoUrl = file.filename;
    }

    await prisma.professor.update({
      where: { usuarioId: id },
      data: dadosProfessor,
    });

    return res.json({ message: "Perfil atualizado com sucesso.", usuario });
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