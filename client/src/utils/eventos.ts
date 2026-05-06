export const EVENTO_TIPOS = [
  { value: "PENEIRA", label: "Peneira" },
  { value: "EVENTO", label: "Evento" },
  { value: "TORNEIO", label: "Torneio" },
  { value: "COPA", label: "Copa" },
  { value: "LIGA", label: "Liga" },
  { value: "AMISTOSO", label: "Amistoso" },
  { value: "TREINO_ABERTO", label: "Treino aberto" },
  { value: "CAMP", label: "Camp" },
  { value: "CLINICA", label: "Clínica" },
  { value: "SHOWCASE", label: "Showcase" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "PALESTRA", label: "Palestra" },
  { value: "AULA_AO_VIVO", label: "Aula ao vivo" },
  { value: "WEBINAR", label: "Webinar" },
  { value: "LIVE", label: "Live" },
] as const;

export type EventoTipo = (typeof EVENTO_TIPOS)[number]["value"];

export function labelEventoTipo(tipo?: string | null) {
  const found = EVENTO_TIPOS.find((t) => t.value === tipo);
  return found?.label ?? (tipo || "—");
}
