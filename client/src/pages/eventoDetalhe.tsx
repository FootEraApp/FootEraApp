import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import { Link } from "wouter";
import { EventoTipo, labelEventoTipo } from "@/utils/eventos.js";

type Evento = {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  descricao?: string | null;
  inicio: string;
  fim?: string | null;
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
  vagas?: number | null;
  valorInscricao?: number | string | null;
  requisitos?: string[] | null;
  status?: "ABERTO" | "ENCERRADO" | "CANCELADO";
  linkInscricao?: string | null;
};

export default function PaginaEventoDetalhe({ eventoId }: { eventoId: string }) {
  const headers = Storage.token ? { Authorization: `Bearer ${Storage.token}` } : undefined;

  const [ev, setEv] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventoId) return;
    axios
      .get(`${API.BASE_URL}/api/eventos/${eventoId}`, { headers })
      .then(({ data }) => setEv(data))
      .catch(() => setEv(null))
      .finally(() => setLoading(false));
  }, [eventoId, headers]);

  if (loading) return <div className="p-6">Carregando evento...</div>;
  if (!ev) return <div className="p-6 text-red-600">Evento não encontrado.</div>;

  const fmtDataHora = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : null;

  const valorNum =
    typeof ev.valorInscricao === "string"
      ? parseFloat(ev.valorInscricao)
      : ev.valorInscricao ?? null;

  const valorFmt =
    valorNum != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
          Number.isFinite(valorNum) ? valorNum : 0
        )
      : "—";

  const temRequisitos = Array.isArray(ev.requisitos) && ev.requisitos.length > 0;

  return (
    <div className="p-6 max-w-2xl mx-auto bg-cream text-green-900">
      <h1 className="text-3xl font-extrabold">{ev.titulo}</h1>

      <p className="mt-1 text-sm opacity-80">
        {fmtDataHora(ev.inicio)} • {labelEventoTipo(ev.tipo)}
      </p>

    <div className="mt-6 grid gap-3 bg-white rounded-lg border p-4">

    <div className="flex items-center justify-between">
      <h2 className="font-semibold text-lg font-green">Informações</h2>

      {String(Storage.tipoSalvo || "").toLowerCase() !== "atleta" && (
        <Link
          href={`/eventos/convocar?eventoId=${ev.id}`}
          className="px-3 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800"
        >
          Convocar atletas
        </Link>
      )}
    </div>

      {ev.status && (
        <p className="text-sm">
          <b>Status: </b>
           {ev.status ? `${ev.status}` : ""}
        </p>
      )}
 
      {ev.descricao && (
        <p className="text-sm">
          <b>Descrição: </b>
          {ev.descricao}
        </p>
      )}

      {(ev.cidade || ev.estado ) && (
        <p className="text-sm">
          <b>Cidade:</b>{" "}
          {[ev.cidade, ev.estado].filter(Boolean).join(" - ")}
        </p>
      )}
    
        {(ev.endereco) && (
          <div className="text-sm">
            <b>Endereço/Local:</b>{" "}
            {[ev.endereco].filter(Boolean).join(" • ")}
          </div>
        )}

        {ev.fim && (
          <div className="text-sm">
            <b>Término:</b> {fmtDataHora(ev.fim)}
          </div>
        )}

        <div className="text-sm">
          <b>Valor da inscrição:</b>{" "}
          {valorNum === 0 ? "Gratuito" : valorFmt}
        </div>

        <div className="text-sm">
          <b>Vagas:</b> {ev.vagas != null ? ev.vagas : "—"}
        </div>

        {temRequisitos && (
          <div className="text-sm">
            <b>Requisitos:</b>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              {ev.requisitos!.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {ev.linkInscricao && (
          <div className="pt-2">
            <a
              className="inline-block px-4 py-2 rounded bg-green-800 text-white"
              href={ev.linkInscricao}
              target="_blank"
              rel="noreferrer"
            >
              Inscrever-se
            </a>
          </div>
        )}
      </div>
    </div>
  );
}