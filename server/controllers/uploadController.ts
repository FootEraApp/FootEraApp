import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folder || "uploads";
    const dir = `uploads/${folder}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${unique}${ext}`);
  }
});

const upload = multer({ storage });

export const uploadFile = [
  upload.single("file"),
  (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const fileUrl = `http://localhost:3001/${req.file.path.replace(/\\/g, "/")}`;
    res.json({ url: fileUrl });
  }
];
