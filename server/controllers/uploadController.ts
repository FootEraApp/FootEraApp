import { Request, Response } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (_, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({ storage });

export const uploadFotoPerfil = [
  upload.single("foto"),
  async (req: Request, res: Response) => {
    const { usuarioId, tipo } = req.body;

    if (!req.file) return res.status(400).json({ erro: "Arquivo não enviado" });

    const caminho = `/assets/usuarios/${req.file.filename}`;

    try {
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          foto: caminho,
        },
      });

      if (tipo === "professor") {
        await prisma.professor.updateMany({
          where: { usuarioId },
          data: { fotoUrl: caminho },
        });
      }

      res.json({ sucesso: true, caminho });
    } catch (err) {
      console.error("Erro ao salvar foto:", err);
      res.status(500).json({ erro: "Erro ao salvar foto" });
    }
  },
];
