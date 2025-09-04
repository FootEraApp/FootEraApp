import { API } from "@/config";

type Pasta =
  | "usuarios"
  | "desafios"
  | "escolas"
  | "clubes"
  | "treinos"
  | "misc";

export function formatarUrlFoto(
  raw?: string | null,
  pastaPadrao: Pasta = "usuarios"
): string {
  if (!raw) {
    // fallback genérico
    return `${API.BASE_URL}/assets/default-user.png`;
  }

  // já é URL absoluta
  if (/^https?:\/\//i.test(raw)) return raw;

  // já veio com /assets/… (caminho completo do servidor)
  if (raw.startsWith("/assets/")) return `${API.BASE_URL}${raw}`;

  // veio “pasta/arquivo.ext” (ex.: "desafios/controle-aereo.png")
  if (/^(usuarios|desafios|escolas|clubes|treinos)\//i.test(raw)) {
    return `${API.BASE_URL}/assets/${raw}`;
  }

  // veio só o nome do arquivo ⇒ usa a pasta padrão informada
  return `${API.BASE_URL}/assets/${pastaPadrao}/${raw}`;
}
