import Storage from "../../../server/utils/storage.js";

export function buildPerfilUrls(userId?: string | null) {
  const meId = (Storage as any)?.usuarioId;
  const isMe = !userId || String(userId) === String(meId);

  return {
    perfil:  isMe ? `/api/perfil/${encodeURIComponent(meId)}` : `/api/perfil/${encodeURIComponent(userId!)}`,
    posicaoAtual: isMe ? `/api/perfil/me/posicao-atual` : `/api/perfil/${encodeURIComponent(userId!)}/posicao-atual`,
    pontuacao:    isMe ? `/api/perfil/me/pontuacao`     : `/api/perfil/${encodeURIComponent(userId!)}/pontuacao`,
  };
}
