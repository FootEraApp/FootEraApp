import { Request, Response } from "express";
import { s3Service } from "../services/s3Service";

export const uploadController = {
  async uploadFile(req: Request, res: Response) {
    const file = req.file;
    const folder = req.body.folder;

    if (!file || !folder) {
      return res.status(400).json({ message: "Arquivo ou pasta não fornecidos" });
    }

    try {
      const url = await s3Service.uploadFileAsync(file, folder);
      return res.json({ url });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao fazer upload do arquivo", error });
    }
  },
};
