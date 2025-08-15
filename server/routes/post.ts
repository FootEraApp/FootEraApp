import { Router } from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { PrismaClient } from "@prisma/client";
import {
  editarPostagemGet,
  editarPostagemPost,
  deletarPostagem,
  postarConteudo,
  adicionarComentario,
  buscarPostagemPorId,
  registrarCompartilhamento
} from "../controllers/postController.js";
import { authenticateToken } from "../middlewares/auth.js";
import { curtirPostagem } from "server/controllers/feedController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();
const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../public/uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

router.post("/postar", authenticateToken, upload.single("arquivo"), postarConteudo);
router.get("/:id", authenticateToken, buscarPostagemPorId);
router.post("/:postId/comentario", authenticateToken, adicionarComentario);
router.post("/:postId/like", authenticateToken, curtirPostagem);
router.get("/visualizar/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const post = await prisma.postagem.findUnique({
      where: { id },
      include: {
        usuario: true,
        curtidas: true,
        comentarios: {
          include: {
            usuario: true,
          },
        },
      },
    });

    if (!post) return res.status(404).json({ message: "Post não encontrado" });

    res.json(post);
  } catch (error) {
    console.error("Erro ao buscar postagem:", error);
    res.status(500).json({ message: "Erro ao buscar postagem" });
  }
});

router.get("/:id", authenticateToken, editarPostagemGet);
router.post("/:id", authenticateToken, editarPostagemPost);
router.delete("/:postagemId", authenticateToken, deletarPostagem);
router.post("/:postId/compartlhar", authenticateToken, registrarCompartilhamento);
export default router;