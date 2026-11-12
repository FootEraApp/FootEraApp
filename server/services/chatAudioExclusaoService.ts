// server/services/chatAudioExclusaoService.ts
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { removerChatAudio } from "./chatAudioStorage.js";

export async function recuperarExclusoesChatAudio(
  limite = 20,
  somenteAudioKeyQa?: string
): Promise<{
  processados: number; removidos: number; falhas: number; vinculados: number;
}> {
  if (somenteAudioKeyQa) {
    const banco = new URL(process.env.DATABASE_URL || "");

    const ambienteQaCorreto =
      process.env.NODE_ENV === "test" &&
      banco.hostname === "127.0.0.1" &&
      banco.port === "5433" &&
      banco.pathname === "/footera_billing_qa" &&
      process.env.ENABLE_CHAT_AUDIO === "true" &&
      process.env.ENABLE_CHAT_AUDIO_LOCAL === "true" &&
      process.env.ENABLE_CHAT_AUDIO_WORKER === "false" &&
      !process.env.AWS_S3_CHAT_AUDIO_BUCKET?.trim();

    if (!ambienteQaCorreto) {
      throw new Error("CHAT_AUDIO_QA_ENV_INVALID");
    }

    if (
      !/^mensagens-audio\/(?:privadas|grupos)\/[0-9a-f-]{36}\.(?:webm|m4a|ogg)$/i.test(
        somenteAudioKeyQa
      )
    ) {
      throw new Error("CHAT_AUDIO_QA_KEY_INVALID");
    }
  }
  const n = Number.isFinite(limite) ? Math.max(1, Math.min(20, Math.trunc(limite))) : 1;
  const agora = new Date();
  const candidatos = await prisma.exclusaoAudioMensagemPendente.findMany({
    where: {
    ...(somenteAudioKeyQa
      ? { audioKey: somenteAudioKeyQa }
      : {}),
    proximaTentativaEm: { lte: agora },
    OR: [
      { reservadoAte: null }, { reservadoAte: { lt: agora } },
    ] },
    orderBy: { criadoEm: "asc" }, take: n, select: { id: true, audioKey: true },
  });
  let processados = 0, removidos = 0, falhas = 0, vinculados = 0;
  for (const candidato of candidatos) {
    const idWorker = randomUUID();
    const adquirido = await prisma.exclusaoAudioMensagemPendente.updateMany({
      where: {
        id: candidato.id,
        ...(somenteAudioKeyQa
          ? { audioKey: somenteAudioKeyQa }
          : {}),
        proximaTentativaEm: { lte: new Date() },
        OR: [
        { reservadoAte: null }, { reservadoAte: { lt: new Date() } },
      ] },
      data: { reservadoPor: idWorker, reservadoAte: new Date(Date.now() + 10 * 60_000) },
    });
    if (adquirido.count !== 1) continue;
    processados++;
    try {
      const [privado, grupo] = await Promise.all([
        prisma.mensagem.findFirst({ where: { audioKey: candidato.audioKey }, select: { id: true } }),
        prisma.mensagemGrupo.findFirst({ where: { audioKey: candidato.audioKey }, select: { id: true } }),
      ]);
      if (privado || grupo) {
        vinculados++;
        await prisma.exclusaoAudioMensagemPendente.deleteMany({ where: { id: candidato.id, reservadoPor: idWorker, reservadoAte: {
          gt: new Date(),
        }, } });
        continue;
      }
      await removerChatAudio(candidato.audioKey);
      const finalizado = await prisma.exclusaoAudioMensagemPendente.deleteMany({ where: { id: candidato.id, reservadoPor: idWorker, reservadoAte: {
        gt: new Date(),
      }, } });
      if (finalizado.count === 1) removidos++;
    } catch (erro) {
      falhas++;
      await prisma.exclusaoAudioMensagemPendente.updateMany({
        where: { id: candidato.id, reservadoPor: idWorker, reservadoAte: {
          gt: new Date(),
        }, },
        data: {
          tentativas: { increment: 1 },
          ultimoErro: erro instanceof Error ? erro.message.slice(0, 300) : "ERRO_DESCONHECIDO",
          proximaTentativaEm: new Date(Date.now() + 5 * 60_000),
          reservadoPor: null, reservadoAte: null,
        },
      });
      console.error("[chat-audio] pendência de exclusão", { id: candidato.id, erro });
    }
  }
  return { processados, removidos, falhas, vinculados };
}