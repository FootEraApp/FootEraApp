// server/routes/feed
import express, { Router} from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { adminAuth } from "../middlewares/admin-auth.js";
import { PrismaClient } from "@prisma/client";

import {
  getFeedPosts,
  seguirUsuario,
  postar,
  deletarPostagem,
  getPerfil,
  deletarUsuario
} from "../controllers/feedController.js";

import multer from "multer";
const upload = multer({ dest: "public/uploads/posts" });

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", authenticateToken, getFeedPosts);
router.get("/perfil/:id", authenticateToken, getPerfil);
router.delete("/usuario/:id", adminAuth, deletarUsuario);
router.post("/seguir", seguirUsuario);
router.post("/postar", upload.single("arquivo"), postar);

router.delete("/posts/:id", authenticateToken, deletarPostagem);

/*
router.get("/", authenticateToken, async (req, res) => {
  try {
    const posts = await prisma.postagem.findMany({
      orderBy: { dataCriacao: "desc" },
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

    res.json(posts);
  } catch (err) {
    console.error("Erro ao carregar feed:", err);
    res.status(500).json({ message: "Erro ao carregar o feed" });
  }
});
*/

export default router;