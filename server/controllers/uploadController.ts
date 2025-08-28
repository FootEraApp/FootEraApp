// server/controllers/uploadController
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

export const upload = multer({ storage });

export const uploadFotoPerfil = [
  upload.single("foto"),
  async (req: Request, res: Response) => {
    const { usuarioId, tipo } = req.body;

    if (!req.file) return res.status(400).json({ erro: "Arquivo não enviado" });

    // CAMINHO PÚBLICO CORRETO (bate com app.use('/uploads', ...))
    const caminhoPublico = `/uploads/${req.file.filename}`;

    try {
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { foto: caminhoPublico },
      });

      if (tipo === "professor") {
        await prisma.professor.updateMany({
          where: { usuarioId },
          data: { fotoUrl: caminhoPublico },
        });
      }

      const base = process.env.APP_URL || "http://localhost:3001";
      const urlAbsoluta = `${base}${caminhoPublico}`;

      res.json({ sucesso: true, caminho: caminhoPublico, url: urlAbsoluta });
    } catch (err) {
      console.error("Erro ao salvar foto:", err);
      res.status(500).json({ erro: "Erro ao salvar foto" });
    }
  },
];

