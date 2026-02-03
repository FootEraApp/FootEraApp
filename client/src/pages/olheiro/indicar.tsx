import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import { X, Send, Search } from "lucide-react";

type Destino = {
  id: string;
  nome: string;
  tipo: "Clube" | "Escolinha";
  username?: string;
  logo?: string | null;
};

function debounce<T extends (...a: any[]) => void>(fn: T, ms = 400) {
  let t: any;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export default function IndicarParaClube() {
  const [, nav] = useLocation();

  const token = (Storage as any).token;
  const tipoUsuario =
    (Storage as any).tipoUsuario ||
    localStorage.getItem("tipoUsuario") ||
    sessionStorage.getItem("tipoUsuario") ||
    "";
  const tipoUsuarioId =
    (Storage as any).tipoUsuarioId ||
    localStorage.getItem("tipoUsuarioId") ||
    sessionStorage.getItem("tipoUsuarioId") ||
    "";

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tipoUsuarioId ? { "x-tipo-usuario-id": tipoUsuarioId } : {}),
    ...(tipoUsuario ? { "x-tipo-usuario": tipoUsuario } : {}),
  };

  const params = new URLSearchParams(location.search);
  const [atletaId, setAtletaId] = useState(params.get("atletaId") || "");

  const [tipoDestino, setTipoDestino] = useState<"Clube" | "Escolinha">("Clube");
  const [q, setQ] = useState("");
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [selDestino, setSelDestino] = useState<Destino | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const buscarDestinos = useMemo(
    () =>
      debounce(async (query: string) => {
        if (!query || query.trim().length < 2) return setDestinos([]);
        try {
          const r = await axios.get(`${API.BASE_URL}/api/cadastro/buscar`, {
            params: { query, tipo: tipoDestino },
            headers,
          });

          const arr: Destino[] = (Array.isArray(r.data) ? r.data : [])
            .filter((x: any) => x?.tipo === tipoDestino)
            .map((x: any) => ({
              id: String(x.id),
              nome: String(x.nome),
              tipo: tipoDestino,
              username: x.username,
              logo: (x.fotoUrl ?? x.logo ?? null) as string | null,
            }));

          setDestinos(arr);
        } catch {
          setDestinos([]);
        }
      }, 350),
    [tipoDestino]
  );

  useEffect(() => {
    buscarDestinos(q);
  }, [q, buscarDestinos]);

  async function enviar() {
    setMsg(null);

    if (!atletaId) return setMsg("Informe o ID do atleta.");
    if (!selDestino)
      return setMsg(`Selecione ${tipoDestino === "Clube" ? "um clube" : "uma escolinha"}.`);

    try {
      setEnviando(true);

      const body =
        selDestino.tipo === "Clube"
          ? { atletaId, clubeId: selDestino.id }
          : { atletaId, escolinhaId: selDestino.id };

      await axios.post(`${API.BASE_URL}/api/indicacoes`, body, {
        headers: { "Content-Type": "application/json", ...headers },
      });

      setMsg("Indicação enviada! ✅");
      setTimeout(() => nav("/perfil"), 1200);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Não foi possível enviar a indicação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">
          Indicar para {tipoDestino === "Clube" ? "clube" : "escolinha"}
        </h1>
        <button onClick={() => history.back()} className="p-2 rounded hover:bg-gray-100">
          <X />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => {
            setTipoDestino("Clube");
            setSelDestino(null);
            setDestinos([]);
            setQ("");
            setMsg(null);
          }}
          className={`flex-1 rounded py-2 border ${
            tipoDestino === "Clube" ? "bg-green-50 border-green-300" : "bg-white"
          }`}
        >
          Clube
        </button>

        <button
          type="button"
          onClick={() => {
            setTipoDestino("Escolinha");
            setSelDestino(null);
            setDestinos([]);
            setQ("");
            setMsg(null);
          }}
          className={`flex-1 rounded py-2 border ${
            tipoDestino === "Escolinha" ? "bg-green-50 border-green-300" : "bg-white"
          }`}
        >
          Escolinha
        </button>
      </div>

      <label className="block text-sm mb-1">ID do Atleta</label>
      <input
        className="w-full border rounded px-3 py-2 mb-3"
        placeholder="ex.: uuid…"
        value={atletaId}
        onChange={(e) => setAtletaId(e.target.value)}
      />

      <label className="block text-sm mb-1">
        Buscar {tipoDestino === "Clube" ? "clube" : "escolinha"}
      </label>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-500" />
        <input
          className="w-full border rounded pl-8 pr-3 py-2"
          placeholder="Digite 2+ letras"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {q && (
        <div className="border rounded mt-2 max-h-56 overflow-auto">
          {destinos.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelDestino(d)}
              className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 ${
                selDestino?.id === d.id ? "bg-green-50" : ""
              }`}
            >
              <div className="font-medium">{d.nome}</div>
              {d.username && <div className="text-xs text-gray-500">@{d.username}</div>}
            </button>
          ))}

          {destinos.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nenhum {tipoDestino === "Clube" ? "clube" : "escolinha"} encontrado
            </div>
          )}
        </div>
      )}

      {selDestino && (
        <p className="mt-2 text-sm">
          Selecionado: <b>{selDestino.nome}</b>
        </p>
      )}

      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <button
        disabled={enviando}
        onClick={enviar}
        className="mt-4 w-full bg-green-700 text-white rounded py-2 flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        {enviando ? "Enviando…" : "Enviar indicação"}
      </button>
    </div>
  );
}