import { useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import Storage from "../../utils/storage.js";
import { API } from "../../config.js";
import { EVENTO_TIPOS, EventoTipo } from "@/utils/eventos.js";

type EventoForm = {
  titulo: string;
  tipo: EventoTipo;
  descricao: string;
  dataEvento: string;
  inscricaoInicio: string;
  inscricaoFim: string;
  local: string;
  cidade: string;
  estado: string;
  pais: string;
  endereco: string;
  vagas: string;
  valorInscricao: string;
  linkInscricao: string;
  requisitos: string;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
};

export default function CreatorNovoEventoPage() {
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<EventoForm>({
    titulo: "",
    tipo: "AULA_AO_VIVO",
    descricao: "",
    dataEvento: "",
    inscricaoInicio: "",
    inscricaoFim: "",
    local: "",
    cidade: "",
    estado: "",
    pais: "Brasil",
    endereco: "",
    vagas: "",
    valorInscricao: "",
    linkInscricao: "",
    requisitos: "",
    status: "ABERTO",
  });

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const tipoSelecionado = form.tipo;

  const isOnline = useMemo(() => {
    return ["AULA_AO_VIVO", "WEBINAR", "LIVE"].includes(tipoSelecionado);
  }, [tipoSelecionado]);

  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }

  function toLocalInput(dt: Date) {
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  }

  const minDateTime = toLocalInput(new Date());
  const maxDateTime = "2050-12-31T23:59";

  function set<K extends keyof EventoForm>(k: K, v: EventoForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setErro("");

    if (!form.titulo || !form.dataEvento) {
      setErro("Título e data são obrigatórios.");
      return;
    }

    try {
      setSalvando(true);

      const body = {
        ...form,
        inscricaoInicio: form.inscricaoInicio || null,
        inscricaoFim: form.inscricaoFim || null,
        vagas: form.vagas ? Number(form.vagas) : null,
        valorInscricao: form.valorInscricao ? Number(form.valorInscricao) : null,
        requisitos: form.requisitos
          ? form.requisitos.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };

      const token =
        Storage?.token ||
        (typeof window !== "undefined" ? localStorage.getItem("token") : null);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.post(`${API.BASE_URL}/api/eventos/creator`, body, {
        headers,
      });

      window.alert("Evento criado com sucesso!");
      setLocation("/creator/eventos");
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Erro ao criar evento.";
      setErro(msg);
      window.alert(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream text-green-900 pb-20">
      <div className="bg-green-900 text-white p-5">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 rounded-full border border-white/30 px-3 py-1 text-sm"
        >
          Voltar
        </button>

        <h1 className="text-2xl font-extrabold">Criar evento Creator</h1>
        <p className="text-white/80 text-sm mt-1">
          Crie aulas ao vivo, webinars, lives, palestras, eventos presenciais ou peneiras.
        </p>
      </div>

      <div className="p-4 max-w-xl mx-auto">
        <div className="grid gap-4 bg-white rounded-2xl border p-4 shadow-sm">
          <div>
            <label className="block text-sm font-semibold">Título*</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ex.: Aula ao vivo — Fundamentos da tática"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold">Tipo</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.tipo}
                onChange={(e) => set("tipo", e.target.value as EventoTipo)}
              >
                {EVENTO_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold">Status</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.status}
                onChange={(e) => set("status", e.target.value as EventoForm["status"])}
              >
                <option value="ABERTO">Aberto</option>
                <option value="ENCERRADO">Encerrado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>

          {isOnline && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-green-900">
              Este tipo é online. Por enquanto, coloque o link da transmissão em
              <b> Link de inscrição/transmissão</b>. Depois ele pode ser conectado ao Amazon IVS.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold">Início inscrições</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={form.inscricaoInicio}
                min={minDateTime}
                max={maxDateTime}
                onChange={(e) => set("inscricaoInicio", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Fim inscrições</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={form.inscricaoFim}
                min={minDateTime}
                max={maxDateTime}
                onChange={(e) => set("inscricaoFim", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold">Data e hora do evento*</label>
            <input
              type="datetime-local"
              className="w-full border rounded px-3 py-2"
              value={form.dataEvento}
              min={minDateTime}
              max={maxDateTime}
              onChange={(e) => set("dataEvento", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">Descrição (opcional)</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={4}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </div>

          {!isOnline && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold">Cidade</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.cidade}
                  onChange={(e) => set("cidade", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold">Estado</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.estado}
                  onChange={(e) => set("estado", e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold">
              {isOnline ? "Link de inscrição/transmissão" : "Link de inscrição"}
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.linkInscricao}
              onChange={(e) => set("linkInscricao", e.target.value)}
              placeholder={isOnline ? "https://..." : ""}
            />
          </div>

          {!isOnline && (
            <div>
              <label className="block text-sm font-semibold">Endereço/Local</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.endereco}
                onChange={(e) => set("endereco", e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold">Vagas</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={form.vagas}
                onChange={(e) => set("vagas", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Valor (R$)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={form.valorInscricao}
                onChange={(e) => set("valorInscricao", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold">Requisitos</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.requisitos}
              onChange={(e) => set("requisitos", e.target.value)}
              placeholder="Separe por vírgulas"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={() => history.back()} className="px-4 py-2 rounded border">
              Cancelar
            </button>

            <button
              onClick={submit}
              disabled={salvando}
              className="px-4 py-2 rounded bg-green-700 text-white"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}