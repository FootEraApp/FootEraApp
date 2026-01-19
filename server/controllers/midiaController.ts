import { Request, Response } from "express";
import { TipoMidia, StorageClass } from "@prisma/client";
import { uploadFile } from "server/utils/s3.js";
import { prisma } from "../prisma.js";


export const getMidias = async (req: Request, res: Response) => {
  const { atletaId } = req.params;

  try {
    const midias = await prisma.midia.findMany({
      where: { atletaId },
    });

    res.json(midias);
  } catch (error) {
    console.error("Erro ao buscar mídias:", error);
    res.status(500).json({ message: "Erro ao buscar mídias." });
  }
};

export const uploadMidia = async (req: Request, res: Response) => {
  const { atletaId } = req.params;
  const { titulo, tipo } = req.body as { titulo?: string; tipo?: string };
  const file = (req as any).file as Express.Multer.File | undefined;

  if (!file) return res.status(400).json({ message: "Arquivo não enviado." });

  const tamanhoMB = file.size / (1024 * 1024);
  const tamanhoMax = tipo === "Imagem" ? 1 : 10;

  if (tamanhoMB > tamanhoMax) {
    return res
      .status(400)
      .json({ message: `Arquivo excede o limite de ${tamanhoMax}MB.` });
  }

  try {
    const url = await uploadFile(file, "midias");

    const tipoMidia: TipoMidia =
      tipo === "Video"
        ? TipoMidia.Video
        : tipo === "Documento"
        ? TipoMidia.Documento
        : TipoMidia.Imagem;

    const midia = await prisma.midia.create({
      data: {
        atletaId,
        titulo: titulo ?? "",
        tipo: tipoMidia,
        url,
        dataEnvio: new Date(),
        descricao: (req.body as any).descricao || "",
        storageClass: StorageClass.HOT,
      },
    });

    res.status(201).json(midia);
  } catch (error) {
    console.error("Erro ao enviar mídia:", error);
    res.status(500).json({ message: "Erro ao enviar mídia." });
  }
};

export const deleteMidia = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const midia = await prisma.midia.findUnique({ where: { id } });
    if (!midia)
      return res.status(404).json({ message: "Mídia não encontrada." });

    await prisma.midia.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error("Erro ao deletar mídia:", error);
    res.status(500).json({ message: "Erro ao deletar mídia." });
  }
};
