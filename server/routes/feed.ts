import express, { Router} from "express";
import { authenticateToken } from "../middlewares/auth";
import { adminAuth } from "../middlewares/admin-auth";
import { PrismaClient } from "@prisma/client";

import {
  getFeed,
  seguirUsuario,
  deletarPostagem,
  getPerfil,
  deletarUsuario,
} from "../controllers/feedController";

import multer from "multer";
const upload = multer({ dest: "public/uploads/posts" });

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/feed", authenticateToken, getFeed);
router.get("/perfil/:id", authenticateToken, getPerfil);
router.delete("/usuario/:id", adminAuth, deletarUsuario);
router.post("/seguir", seguirUsuario);
router.delete("/posts/:id", adminAuth, deletarPostagem);
router.get("/", authenticateToken, async (req, res) => {
  try {
    const posts = await prisma.postagem.findMany({
      orderBy: { dataCriacao: "desc" },
      include: { usuario: true }, 
    });

    res.json(posts);
  } catch (err) {
    console.error("Erro ao carregar feed:", err);
    res.status(500).json({ message: "Erro ao carregar o feed" });
  }
});

export default router;
