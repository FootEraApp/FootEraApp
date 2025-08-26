import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const usuarioId = (req.userId);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const favs = await prisma.favoritoUsuario.findMany({
      where: { usuarioId },
      select: { favoritoUsuarioId: true },
    });
    res.json(favs.map(f => f.favoritoUsuarioId));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao buscar favoritos" });
  }
});

router.get("/status/:alvoId", authenticateToken, async (req, res) => {
  try {
    const usuarioId = (req.userId);
    const { alvoId } = req.params;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });
    if (!alvoId)   return res.status(400).json({ message: "alvoId é obrigatório" });

    const existe = await prisma.favoritoUsuario.findUnique({
      where: {
        usuarioId_favoritoUsuarioId: { usuarioId, favoritoUsuarioId: alvoId },
      },
    });
    res.json({ favorito: !!existe });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao verificar status do favorito" });
  }
});

router.post("/:alvoId", authenticateToken, async (req, res) => {
  try {
    const usuarioId = (req.userId);
    const { alvoId } = req.params;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });
    if (!alvoId)    return res.status(400).json({ message: "alvoId é obrigatório" });
    if (alvoId === usuarioId)
      return res.status(400).json({ message: "Não é possível favoritar a si mesmo" });

    const existente = await prisma.favoritoUsuario.findUnique({
      where: {
        usuarioId_favoritoUsuarioId: { usuarioId, favoritoUsuarioId: alvoId },
      },
    });

    if (existente) {
      await prisma.favoritoUsuario.delete({ where: { id: existente.id } });
      return res.json({ favorito: false });
    }

    await prisma.favoritoUsuario.create({
      data: { usuarioId, favoritoUsuarioId: alvoId },
    });
    res.json({ favorito: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao alternar favorito" });
  }
});

router.delete("/:alvoId", authenticateToken, async (req, res) => {
  try {
    const usuarioId =(req.userId);
    const { alvoId } = req.params;
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    await prisma.favoritoUsuario.deleteMany({
      where: { usuarioId, favoritoUsuarioId: alvoId },
    });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erro ao desfavoritar" });
  }
});

export default router;
