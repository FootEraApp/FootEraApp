import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.post("/consentimentos", authenticateToken, async (req, res) => {
  try {
    const userId =
      (req as any).user?.id ||
      (req as any).userId ||
      (req as any).user?.userId;

    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const { doc, versao, hashes, metodo } = req.body || {};
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers["user-agent"] || "";

    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) return res.status(404).json({ error: "usuario_not_found" });

    const birth = usuario.dataNascimento ? new Date(usuario.dataNascimento) : null;
    const hoje = new Date();
    const idade = birth ? (hoje.getFullYear() - birth.getFullYear() - ((hoje.getMonth() < birth.getMonth() || (hoje.getMonth() === birth.getMonth() && hoje.getDate() < birth.getDate())) ? 1 : 0)) : null;

    let tipo = "adulto";
    if (idade !== null && idade < 12) tipo = "menor-12";
    else if (idade !== null && idade < 18) tipo = "12-17";

    const saved = await prisma.consentimento.create({
      data: {
        usuarioId: userId,
        tipo,
        doc: doc || "Termos e Privacidade",
        versaoTermos: versao?.termos || "2025-10-06",
        versaoPriv: versao?.privacidade || "2025-10-06",
        hashTermos: hashes?.termosHash ?? null,
        hashPriv: hashes?.privHash ?? null,
        metodo: metodo || "click-wrap",
        ip: String(ip),
        userAgent: String(userAgent),
      }
    });

    res.json({ ok: true, id: saved.id });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;