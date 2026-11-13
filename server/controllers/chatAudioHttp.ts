// server/controllers/chatAudioHttp.ts
import type { Request, Response } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { CHAT_AUDIO_MAX_BYTES, chatAudioDisponivel, lerChatAudio } from "../services/chatAudioStorage.js";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: CHAT_AUDIO_MAX_BYTES,
    files: 1,

    // paraId, audioDuracaoMs, clientMsgId e tipo.
    fields: 8,
    fieldSize: 16 * 1024,
  },
});


export function receberChatAudio(
  req: Request,
  res: Response,
  next: (err?: unknown) => void
): void {
  if (!chatAudioDisponivel()) {
    res.status(503).json({
      code: "CHAT_AUDIO_UNAVAILABLE",
      error:
        "O armazenamento de áudios não está configurado.",
    });
    return;
  }

  upload.single("audio")(req, res, (erro: unknown) => {
    if (erro) {
      const excedeuTamanho =
        erro instanceof multer.MulterError &&
        erro.code === "LIMIT_FILE_SIZE";

      console.error(
        "[chat-audio] Falha ao receber upload:",
        erro
      );

      res.status(excedeuTamanho ? 413 : 400).json({
        code: excedeuTamanho
          ? "CHAT_AUDIO_TOO_LARGE"
          : "CHAT_AUDIO_INVALID_UPLOAD",
      });
      return;
    }

    if (!req.file || req.file.size === 0) {
      res.status(400).json({
        code: "CHAT_AUDIO_FILE_REQUIRED",
      });
      return;
    }

    next();
  });
}

export function prepararAudioPrivado(req: Request, _res: Response, next: () => void): void {
  req.body.tipo = "AUDIO"; // Tipo definido pelo servidor, não pelo cliente.
  next();
}

export function prepararAudioGrupo(_req: Request, _res: Response, next: () => void): void {
  next();
}

export async function baixarChatAudioPrivado(req: Request, res: Response): Promise<void> {
  const uid = String(req.userId ?? "");
  if (!uid) { res.sendStatus(401); return; }
  try {
    const msg = await prisma.mensagem.findUnique({
      where: { id: String(req.params.id) },
      select: { deId: true, paraId: true, tipo: true, audioKey: true, audioMime: true },
    });
  if (!msg || msg.tipo !== "AUDIO" || !msg.audioKey || (msg.deId !== uid && msg.paraId !== uid)) {
    res.sendStatus(404); return;
  }
    const bytes = await lerChatAudio(msg.audioKey);
    res.set({ "Content-Type": msg.audioMime || "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Length": String(bytes.length) });
    res.end(bytes);
  } catch (e) {
    console.error("[chat-audio] download privado", e);
    res.status(503).json({ code: "CHAT_AUDIO_READ_FAILED" });
  }
}

export async function baixarChatAudioGrupo(req: Request, res: Response): Promise<void> {
  const uid = String(req.userId ?? "");
  if (!uid) { res.sendStatus(401); return; }
  const grupoId = String(req.params.grupoId);
  try {
  const msg = await prisma.mensagemGrupo.findFirst({
    where: { id: String(req.params.id), grupoId, excluida: false },
    select: { tipo: true, audioKey: true, audioMime: true },
  });
  if (!msg || msg.tipo !== "AUDIO" || !msg.audioKey) { res.sendStatus(404); return; }
  const membro = await prisma.membroGrupo.findUnique({
    where: { grupoId_usuarioId: { grupoId, usuarioId: uid } },
    select: { usuarioId: true },
  });
  if (!membro) { res.sendStatus(404); return; }
    const bytes = await lerChatAudio(msg.audioKey);
    res.set({ "Content-Type": msg.audioMime || "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Length": String(bytes.length) });
    res.end(bytes);
  } catch (e) {
    console.error("[chat-audio] download grupo", e);
    res.status(503).json({ code: "CHAT_AUDIO_READ_FAILED" });
  }
}
