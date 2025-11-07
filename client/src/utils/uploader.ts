// client/src/utils/uploader.ts
import { API } from "@/config.js";
import Storage from "../../../server/utils/storage.js";

export async function uploadFile(file: File | Blob): Promise<string> {
  const token =
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    "";
  const fd = new FormData();
  fd.append("file", file as any);

  const r = await fetch(`${API.BASE_URL}/api/upload/video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Falha no upload (${r.status}): ${txt}`);
  }
  const { url } = await r.json();
  return url;
}

export async function uploadBlob(blob: Blob) {
  return uploadFile(blob);
}

// Use esta se quiser fechar o fluxo “upload + finalizar treino” num só lugar:
export async function finalizarComMidia({
  treinoAgendadoId,
  file,
  observacao,
}: {
  treinoAgendadoId: string;
  file?: File | Blob;
  observacao?: string;
}) {
  const token =
    (Storage as any).token ??
    localStorage.getItem("token") ??
    sessionStorage.getItem("token") ??
    "";

  let midiaUrl: string | undefined;
  if (file) midiaUrl = await uploadFile(file);

  const r = await fetch(
    `${API.BASE_URL}/api/treinos/agendados/${encodeURIComponent(
      treinoAgendadoId
    )}/finalizar`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        observacao: observacao ?? null,
        midiaUrl,
        midiaTipo: midiaUrl ? "VIDEO" : undefined,
      }),
    }
  );
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Falha ao finalizar treino (${r.status}): ${txt}`);
  }
  return r.json();
}