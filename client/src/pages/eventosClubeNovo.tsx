import { useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

type Props = { clubeId: string };

type EventoForm = {
  titulo: string;
  tipo: "PENEIRA" | "EVENTO";
  descricao: string;
  inicio: string;           // datetime-local -> string
  fim: string;              // datetime-local -> string
  local: string;
  cidade: string;
  estado: string;
  pais: string;
  endereco: string;
  vagas: string;            // input number retorna string
  valorInscricao: string;   // idem
  linkInscricao: string;
  requisitos: string;       // separado por vírgula no UI
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
};

export default function PaginaNovoEventoClube({ clubeId }: Props) {
  const [, setLocation] = useLocation();

  const [form, setForm] = useState<EventoForm>({
    titulo: "",
    tipo: "PENEIRA",
    descricao: "",
    inicio: "",
    fim: "",
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
  const [salvando, setSalvando] = useState<boolean>(false);
  const [erro, setErro] = useState<string>("");

  function set<K extends keyof EventoForm>(k: K, v: EventoForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setErro("");
    if (!form.titulo || !form.inicio) {
      setErro("Título e início são obrigatórios.");
      return;
    }

    try {
      setSalvando(true);

      const body = {
        ...form,
        // transforma campos antes de enviar
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

      await axios.post(`${API.BASE_URL}/api/eventos/clubes/${clubeId}`, body, {
        headers,
      });

      window.alert("Evento criado com sucesso!");
      setLocation(`/eventos/clubes/${clubeId}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Erro ao criar evento.";
      setErro(msg);
      window.alert(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream text-green-900">
      <div className="bg-green-900 p-4 text-white text-center text-xl font-bold">
        Novo Evento / Peneira
      </div>

      <div className="p-4 max-w-xl mx-auto">
        <div className="grid gap-3 bg-white rounded-lg border p-4">
          <div>
            <label className="block text-sm">Título*</label>
            <input className="w-full border rounded px-3 py-2" value={form.titulo} onChange={(e)=>set("titulo", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Tipo</label>
              <select className="w-full border rounded px-3 py-2" value={form.tipo} onChange={(e)=>set("tipo", e.target.value as EventoForm["tipo"])}>
                <option value="PENEIRA">Peneira</option>
                <option value="EVENTO">Evento</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Status</label>
              <select className="w-full border rounded px-3 py-2" value={form.status} onChange={(e)=>set("status", e.target.value as EventoForm["status"])}>
                <option value="ABERTO">Aberto</option>
                <option value="ENCERRADO">Encerrado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm">Início*</label>
            <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.inicio} onChange={(e)=>set("inicio", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm">Fim</label>
            <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.fim} onChange={(e)=>set("fim", e.target.value)} />
          </div>

          <div>
            <label className="block text-sm">Descrição</label>
            <textarea className="w-full border rounded px-3 py-2" rows={4} value={form.descricao} onChange={(e)=>set("descricao", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Cidade</label>
              <input className="w-full border rounded px-3 py-2" value={form.cidade} onChange={(e)=>set("cidade", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">Estado</label>
              <input className="w-full border rounded px-3 py-2" value={form.estado} onChange={(e)=>set("estado", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm">Endereço/Local</label>
            <input className="w-full border rounded px-3 py-2" value={form.endereco} onChange={(e)=>set("endereco", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm">Vagas</label>
              <input type="number" className="w-full border rounded px-3 py-2" value={form.vagas} onChange={(e)=>set("vagas", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">Valor inscrição (R$)</label>
              <input type="number" className="w-full border rounded px-3 py-2" value={form.valorInscricao} onChange={(e)=>set("valorInscricao", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm">Link de inscrição</label>
              <input className="w-full border rounded px-3 py-2" value={form.linkInscricao} onChange={(e)=>set("linkInscricao", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm">Requisitos (separe por vírgulas)</label>
            <input className="w-full border rounded px-3 py-2" value={form.requisitos} onChange={(e)=>set("requisitos", e.target.value)} />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={()=>history.back()} className="px-4 py-2 rounded border">Cancelar</button>
            <button onClick={submit} disabled={salvando} className="px-4 py-2 rounded bg-green-700 text-white">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}