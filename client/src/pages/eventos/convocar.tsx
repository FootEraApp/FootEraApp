import { toast } from "@/lib/toast";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import PaginaElenco from "../elenco.js";
import { EventoTipo, labelEventoTipo } from "@/utils/eventos.js";

type Evento = {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  dataEvento: string; 
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
};

function getEventoIdFromQuery() {
  if (typeof window === "undefined") return "";
  const qs = new URLSearchParams(window.location.search);
  return qs.get("eventoId") || "";
}

function getReturnToFromQuery() {
  if (typeof window === "undefined") return "";
  const qs = new URLSearchParams(window.location.search);
  return qs.get("returnTo") || "";
}

export default function PaginaConvocarEvento() {
  const eventoId = useMemo(() => getEventoIdFromQuery(), []);
  const returnToQuery = useMemo(() => getReturnToFromQuery(), []);
  const headers = Storage.token
    ? { Authorization: `Bearer ${Storage.token}` }
    : undefined;

  const [ev, setEv] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);

  const backHref = useMemo(() => {
    if (returnToQuery) return returnToQuery;

    const saved =
      typeof window !== "undefined"
        ? sessionStorage.getItem("convocar:returnTo")
        : null;
    if (saved) return saved;

    return Storage.tipoUsuarioId
      ? `/eventos/clubes/${Storage.tipoUsuarioId}`
      : "/treinos";
  }, [returnToQuery]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("convocar:returnTo", backHref);
    }
  }, [backHref]);

  useEffect(() => {
    if (!eventoId) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API.BASE_URL}/api/eventos/${eventoId}`, { headers })
      .then(({ data }) => setEv(data))
      .catch(() => setEv(null))
      .finally(() => setLoading(false));
  }, [eventoId]);

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!eventoId) return <div className="p-6 text-red-600">eventoId não informado.</div>;
  if (!ev) return <div className="p-6 text-red-600">Evento não encontrado.</div>;

  const when = new Date(ev.dataEvento).toLocaleString();
  const where = [ev.endereco, ev.cidade, ev.estado].filter(Boolean).join(" • ");

  return (
    <PaginaElenco
      modo="convocacao"
      eventoId={eventoId}
      backHref={backHref}
      titulo={`Convocar • ${ev.titulo}`}
      permitirReservas
      onSalvar={async ({ turmaId, nome, formacao, escala, reservasIds }) => {
        const token = Storage.token;
        const tipoUsuarioId = Storage.tipoUsuarioId;
        const tipoUsuario = String(Storage.tipoSalvo || "").toLowerCase();

        if (!token) throw new Error("Sem token.");
        if (!tipoUsuarioId || !tipoUsuario) throw new Error("Sem tipoUsuarioId/tipoUsuario.");

        await axios.put(
          `${API.BASE_URL}/api/eventos/${eventoId}/convocacao`,
          {
            turmaId,
            nome: nome || `Convocação - ${ev.titulo}`,
            formacao,
            escala,
            reservasIds,
            tipoUsuario,
            tipoUsuarioId,
            metaEvento: {
              titulo: ev.titulo,
              tipo: ev.tipo,
              dataEvento: ev.dataEvento,
              local: where,
            },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success(
          `Convocação enviada!\n\n` +
            `${ev.titulo} (${labelEventoTipo(ev.tipo)})\n` +
            `${when}${where ? `\n${where}` : ""}`
        );

        window.location.href = backHref;
      }}
    />
  );
}