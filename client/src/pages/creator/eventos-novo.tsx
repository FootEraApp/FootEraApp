import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import Storage from "../../utils/storage.js";
import { API } from "../../config.js";
import { EVENTO_TIPOS, EventoTipo } from "@/utils/eventos.js";
import { dataTagErrorSymbol } from "@tanstack/react-query";

type EventoForm = {
  titulo: string;
  tipo: EventoTipo;
  descricao: string;
  dataEvento: string;
  dataFimEvento: string;
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
  convidadoUsuarioId: string;
  convidadoNome: string;
  convidadoDescricao: string;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
    convidados: Array<{
    localId: string;
    usuarioId: string | null;
    nome: string;
    descricao: string;
  }>;
};

const TIMEZONE_BR = "America/Sao_Paulo";
const SAO_PAULO_OFFSET = "-03:00";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getSaoPauloParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function toDatetimeLocalValue(value?: string | Date | null) {
  if (!value) return "";

  const p = getSaoPauloParts(value);
  if (!p) return "";

  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function toSaoPauloIso(value?: string | null) {
  if (!value) return null;

  const clean = String(value).trim();
  if (!clean) return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(clean)) {
    return `${clean}:00${SAO_PAULO_OFFSET}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(clean)) {
    return `${clean}${SAO_PAULO_OFFSET}`;
  }

  return clean;
}

function parseSaoPauloDateTimeLocal(value?: string | null) {
  const iso = toSaoPauloIso(value);
  if (!iso) return null;

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function CreatorNovoEventoPage() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const eventoId = params.get("id") || "";
  const aulaId = params.get("aulaId") || "";
  const isEditandoAulaAvulsa = !!aulaId;
  const isEditandoEventoNormal = !!eventoId;

  const [form, setForm] = useState<EventoForm>({
    titulo: "",
    tipo: "AULA_AO_VIVO",
    descricao: "",
    dataEvento: "",
    dataFimEvento: "",
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
    convidadoUsuarioId: "",
    convidadoNome: "",
    convidadoDescricao: "",
    convidados: [],
  });

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [buscaConvidado, setBuscaConvidado] = useState("");
  const [resultadosConvidado, setResultadosConvidado] = useState<any[]>([]);
  const [buscandoConvidado, setBuscandoConvidado] = useState(false);

  const tipoSelecionado = form.tipo;

  useEffect(() => {
    async function carregarEventoParaEdicao() {
      if (!eventoId) return;

      try {
        const token =
          Storage?.token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const { data } = await axios.get(
          `${API.BASE_URL}/api/eventos/creator/${eventoId}`,
          { headers }
        );

        setForm((f) => ({
          ...f,
          titulo: data.titulo || "",
          tipo: data.tipo || "EVENTO",
          descricao: data.descricao || "",
          dataEvento: toDatetimeLocalValue(data.dataEvento),
          dataFimEvento: "",
          inscricaoInicio: toDatetimeLocalValue(data.inscricaoInicio),
          inscricaoFim: toDatetimeLocalValue(data.inscricaoFim),
          local: data.local || "",
          cidade: data.cidade || "",
          estado: data.estado || "",
          pais: data.pais || "Brasil",
          endereco: data.endereco || "",
          vagas: data.vagas != null ? String(data.vagas) : "",
          valorInscricao:
            data.valorInscricao != null ? String(data.valorInscricao) : "",
          linkInscricao: data.linkInscricao || "",
          requisitos: Array.isArray(data.requisitos)
            ? data.requisitos.join(", ")
            : data.requisitos || "",
          status: data.status || "ABERTO",
        }));
      } catch (e: any) {
        window.alert(
          e?.response?.data?.error ||
            e?.response?.data?.message ||
            "Erro ao carregar evento."
        );
      }
    }

    carregarEventoParaEdicao();
  }, [eventoId]);

  useEffect(() => {
    async function carregarAulaParaEdicao() {
      if (!aulaId) return;

      try {
        const token =
          Storage?.token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const { data } = await axios.get(
          `${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}`,
          { headers }
        );

        const aula = data?.item || data;
        const metodologiaId =
          aula?.metodologiaId ||
          aula?.metodologia?.id ||
          "";

        const metodologiaAvulsaId =
          aula?.metodologiaAvulsaId ||
          aula?.metodologiaAvulsa?.id ||
          "";

        if (metodologiaAvulsaId) {
          setLocation(
            `/learning/create?id=${encodeURIComponent(metodologiaAvulsaId)}&origem=avulsa`
          );
          return;
        }

        if (metodologiaId) {
          setLocation(
            `/learning/create?id=${encodeURIComponent(metodologiaId)}`
          );
          return;
        }

        setForm((f) => ({
          ...f,
          titulo: aula.titulo || "",
          tipo: "AULA_AO_VIVO",
          descricao: aula.descricao || "",
          dataEvento: toDatetimeLocalValue(aula.dataInicio),
          dataFimEvento: toDatetimeLocalValue(aula.dataFim),
          inscricaoInicio: toDatetimeLocalValue(aula.inscricaoInicio),
          inscricaoFim: toDatetimeLocalValue(aula.inscricaoFim),
          local: "",
          cidade: "",
          estado: "",
          pais: "Brasil",
          endereco: "",
          vagas: "",
          valorInscricao: aula.precoAcesso != null ? String(aula.precoAcesso) : "",
          linkInscricao: "",
          requisitos: "",
          status:
            aula.status === "CANCELADA"
              ? "CANCELADO"
              : aula.status === "FINALIZADA"
                ? "ENCERRADO"
                : "ABERTO",
          convidados: Array.isArray(aula.convidados)
            ? aula.convidados.map((c: any) => ({
                localId: c.id || uid("convidado"),
                usuarioId: c.usuarioId || "",
                nome: c.nome || c.usuario?.nome || "",
                descricao: c.descricao || "",
              }))
            : aula.convidadoNome
              ? [
                  {
                    localId: uid("convidado"),
                    usuarioId: aula.convidadoUsuarioId || "",
                    nome: aula.convidadoNome || "",
                    descricao: aula.convidadoDescricao || "",
                  },
                ]
              : [],
        }));
      } catch (e: any) {
        window.alert(
          e?.response?.data?.message ||
            e?.response?.data?.error ||
            "Erro ao carregar aula ao vivo."
        );
      }
    }

    carregarAulaParaEdicao();
  }, [aulaId]);

  const isOnline = useMemo(() => {
    return ["AULA_AO_VIVO", "WEBINAR", "LIVE"].includes(tipoSelecionado);
  }, [tipoSelecionado]);


  const minDateTime = toDatetimeLocalValue(new Date());
  const maxDateTime = "2050-12-31T23:59";

  function set<K extends keyof EventoForm>(k: K, v: EventoForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }

  function getToken() {
    return (
      Storage?.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      ""
    );
  }

  async function buscarUsuariosFootera(q: string) {
    const busca = q.trim();

    setBuscaConvidado(q);

    if (busca.length < 2) {
      setResultadosConvidado([]);
      return;
    }

    try {
      setBuscandoConvidado(true);

      const token = getToken();

      const res = await fetch(
        `${API.BASE_URL}/api/usuarios/buscar?q=${encodeURIComponent(busca)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResultadosConvidado([]);
        return;
      }

      if (Array.isArray(json)) {
        setResultadosConvidado(json);
        return;
      }

      if (Array.isArray(json.items)) {
        setResultadosConvidado(json.items);
        return;
      }

      if (Array.isArray(json.usuarios)) {
        setResultadosConvidado(json.usuarios);
        return;
      }

      setResultadosConvidado([]);
    } finally {
      setBuscandoConvidado(false);
    }
  }

  function addConvidado() {
    setForm((f) => ({
      ...f,
      convidados: [
        ...f.convidados,
        {
          localId: uid("convidado"),
          usuarioId: "",
          nome: "",
          descricao: "",
        },
      ],
    }));
  }

  function updateConvidado(
    localId: string,
    patch: Partial<{ usuarioId: string; nome: string; descricao: string }>
  ) {
    setForm((f) => ({
      ...f,
      convidados: f.convidados.map((c) =>
        c.localId === localId ? { ...c, ...patch } : c
      ),
    }));
  }

  function removerConvidado(localId: string) {
    setForm((f) => ({
      ...f,
      convidados: f.convidados.filter((c) => c.localId !== localId),
    }));
  }

  function selecionarUsuarioComoConvidado(usuario: any) {
    setForm((f) => ({
      ...f,
      convidados: [
        ...f.convidados,
        {
          localId: uid("convidado"),
          usuarioId: String(usuario.id),
          nome: String(usuario.nome || usuario.nomeDeUsuario || ""),
          descricao: String(usuario.tipo || "Convidado FootEra"),
        },
      ],
    }));

    setBuscaConvidado("");
    setResultadosConvidado([]);
  }

  function parseDateTimeLocalObrigatorio(value: string, label: string) {
    if (!value) {
      return {
        ok: false as const,
        message: `${label} é obrigatório.`,
        date: null,
      };
    }

    const date = parseSaoPauloDateTimeLocal(value);

    if (!date) {
      return {
        ok: false as const,
        message: `${label} inválido.`,
        date: null,
      };
    }

    return {
      ok: true as const,
      message: "",
      date,
    };
  }

  function parseDateTimeLocalOpcional(value: string, label: string) {
    if (!value) {
      return {
        ok: true as const,
        message: "",
        date: null,
      };
    }

    const date = parseSaoPauloDateTimeLocal(value);

    if (!date) {
      return {
        ok: false as const,
        message: `${label} inválido.`,
        date: null,
      };
    }

    return {
      ok: true as const,
      message: "",
      date,
    };
  }

  function validarDatasEventoForm() {
    const agora = new Date();

    const eventoParsed = parseDateTimeLocalObrigatorio(
      form.dataEvento,
      "Data e hora do evento"
    );

    if (!eventoParsed.ok) return eventoParsed.message;

    const dataEvento = eventoParsed.date;

    if (dataEvento.getTime() <= agora.getTime()) {
      return "A data e hora do evento não pode estar no passado.";
    }

    const fimEventoParsed = parseDateTimeLocalOpcional(
      form.dataFimEvento,
      "Data e hora de término da live"
    );

    if (!fimEventoParsed.ok) return fimEventoParsed.message;

    const dataFimEvento = fimEventoParsed.date;

    if (isOnline && dataFimEvento && dataFimEvento.getTime() <= dataEvento.getTime()) {
      return "A data de término da live precisa ser depois da data de início.";
    }

    const inicioParsed = parseDateTimeLocalOpcional(
      form.inscricaoInicio,
      "Início das inscrições"
    );

    if (!inicioParsed.ok) return inicioParsed.message;

    const fimParsed = parseDateTimeLocalOpcional(
      form.inscricaoFim,
      "Fim das inscrições"
    );

    if (!fimParsed.ok) return fimParsed.message;

    const inicio = inicioParsed.date;
    const fim = fimParsed.date;

    if (inicio && inicio.getTime() <= agora.getTime()) {
      return "O início das inscrições não pode estar no passado.";
    }

    if (fim && fim.getTime() <= agora.getTime()) {
      return "O fim das inscrições não pode estar no passado.";
    }

    if (inicio && fim && fim.getTime() <= inicio.getTime()) {
      return "O fim das inscrições precisa ser depois do início das inscrições.";
    }

    if (fim && dataEvento.getTime() <= fim.getTime()) {
      return "A data do evento precisa ser depois do fim das inscrições.";
    }

    if (inicio && !fim) {
      return "Informe também o fim das inscrições.";
    }

    if (!inicio && fim) {
      return "Informe também o início das inscrições.";
    }

    return "";
  }

  async function submit() {
    setErro("");

    if (!form.titulo.trim()) {
      setErro("Título é obrigatório.");
      window.alert("Título é obrigatório.");
      return;
    }

    const erroDatas = validarDatasEventoForm();

    if (erroDatas) {
      setErro(erroDatas);
      window.alert(erroDatas);
      return;
    }

    try {
      setSalvando(true);

      const body = {
        ...form,
        dataEvento: toSaoPauloIso(form.dataEvento),
        dataFimEvento: toSaoPauloIso(form.dataFimEvento),
        inscricaoInicio: toSaoPauloIso(form.inscricaoInicio),
        inscricaoFim: toSaoPauloIso(form.inscricaoFim),
        vagas: form.vagas ? Number(form.vagas) : null,
        valorInscricao: form.valorInscricao ? Number(form.valorInscricao) : null,
        requisitos: form.requisitos
          ? form.requisitos
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };

      const token =
        Storage?.token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (isEditandoEventoNormal) {
        await axios.put(`${API.BASE_URL}/api/eventos/creator/${eventoId}`, body, {
          headers,
        });

        window.alert("Evento atualizado com sucesso!");
        setLocation("/creator/eventos");
        return;
      }

      if (isEditandoAulaAvulsa) {
        await axios.put(
          `${API.BASE_URL}/api/aulas-ao-vivo/${aulaId}`,
          {
            titulo: form.titulo.trim(),
            descricao: form.descricao.trim() || null,
            dataInicio: toSaoPauloIso(form.dataEvento),
            dataFim: toSaoPauloIso(form.dataFimEvento) || null,
            inscricaoInicio: toSaoPauloIso(form.inscricaoInicio) || null,
            inscricaoFim: toSaoPauloIso(form.inscricaoFim) || null,
            acessoPago: Number(form.valorInscricao || 0) > 0,
            precoAcesso: form.valorInscricao ? Number(form.valorInscricao) : null,
            chatAtivo: true,
            gravacaoAtiva: true,
            replayDisponivel: false,
            convidados: form.convidados
              .map((c, index) => ({
                usuarioId: c.usuarioId || null,
                nome: c.nome.trim() || null,
                descricao: c.descricao.trim() || null,
                ordem: index + 1,
              }))
              .filter((c) => c.usuarioId || c.nome),
          },
          { headers }
        );

        window.alert("Aula ao vivo atualizada com sucesso!");
        setLocation("/creator/eventos");
        return;
      }

      if (isOnline) {
        await axios.post(
          `${API.BASE_URL}/api/aulas-ao-vivo`,
          {
            titulo: form.titulo.trim(),
            descricao: form.descricao.trim() || null,
            dataInicio: toSaoPauloIso(form.dataEvento),
            dataFim: toSaoPauloIso(form.dataFimEvento) || null,
            inscricaoInicio: toSaoPauloIso(form.inscricaoInicio) || null,
            inscricaoFim: toSaoPauloIso(form.inscricaoFim) || null,
            acessoPago: Number(form.valorInscricao || 0) > 0,
            precoAcesso: form.valorInscricao ? Number(form.valorInscricao) : null,
            chatAtivo: true,
            gravacaoAtiva: true,
            replayDisponivel: false,
            convidados: form.convidados
              .map((c, index) => ({
                usuarioId: c.usuarioId || null,
                nome: c.nome.trim() || null,
                descricao: c.descricao.trim() || null,
                ordem: index + 1,
              }))
              .filter((c) => c.usuarioId || c.nome),
          },
          { headers }
        );

        window.alert("Aula ao vivo criada como evento avulso!");
        setLocation("/creator/eventos");
        return;
      }

      await axios.post(`${API.BASE_URL}/api/eventos/creator`, body, {
        headers,
      });

      window.alert("Evento criado com sucesso!");
      setLocation("/creator/eventos");
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Erro ao salvar evento.";

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

        <h1 className="text-2xl font-extrabold">
          {isEditandoAulaAvulsa
            ? "Editar aula ao vivo"
            : isEditandoEventoNormal
              ? "Editar evento Creator"
              : "Criar evento Creator"}
        </h1>
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

          {isOnline ? (
            <div className="grid gap-3 rounded-2xl border border-green-100 bg-green-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="block text-sm font-bold">Convidados da live</label>
                  <p className="text-xs text-green-900/70">
                    Opcional. Você pode pesquisar pessoas da FootEra ou adicionar convidados externos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addConvidado}
                  className="rounded-lg bg-green-800 px-3 py-2 text-sm font-bold text-white"
                >
                  + Convidado externo
                </button>
              </div>

              <div className="rounded-xl bg-white border p-3">
                <label className="block text-sm font-semibold text-green-950 mb-1">
                  Buscar pessoa da FootEra
                </label>

                <input
                  className="w-full border rounded px-3 py-2"
                  value={buscaConvidado}
                  onChange={(e) => buscarUsuariosFootera(e.target.value)}
                  placeholder="Digite nome, @usuário ou e-mail"
                />

                {buscandoConvidado ? (
                  <div className="mt-2 text-xs text-green-900/60">Buscando...</div>
                ) : null}

                {resultadosConvidado.length > 0 ? (
                  <div className="mt-2 max-h-48 overflow-auto rounded-xl border bg-white">
                    {resultadosConvidado.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selecionarUsuarioComoConvidado(u)}
                        className="w-full text-left px-3 py-2 hover:bg-emerald-50"
                      >
                        <div className="font-semibold text-sm text-slate-800">
                          {u.nome || u.nomeDeUsuario || "Usuário"}
                        </div>

                        <div className="text-xs text-slate-500">
                          {u.email ? `${u.email} • ` : ""}
                          {u.tipo || "FootEra"}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {form.convidados.length === 0 ? (
                <div className="rounded-lg bg-white border p-3 text-sm text-green-900/70">
                  Nenhum convidado adicionado. Se não adicionar ninguém, o evento vai mostrar o Creator como responsável.
                </div>
              ) : (
                form.convidados.map((c, index) => (
                  <div key={c.localId} className="rounded-xl bg-white border p-3 grid gap-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm">Convidado {index + 1}</strong>

                      <button
                        type="button"
                        onClick={() => removerConvidado(c.localId)}
                        className="text-xs font-bold text-red-600"
                      >
                        Remover
                      </button>
                    </div>

                    <input
                      className="w-full border rounded px-3 py-2"
                      value={c.nome}
                      onChange={(e) =>
                        updateConvidado(c.localId, {
                          usuarioId: "",
                          nome: e.target.value,
                        })
                      }
                      placeholder="Nome do convidado"
                    />

                    <input
                      className="w-full border rounded px-3 py-2"
                      value={c.descricao}
                      onChange={(e) =>
                        updateConvidado(c.localId, {
                          descricao: e.target.value,
                        })
                      }
                      placeholder="Descrição. Ex.: Ex-atleta, treinador..."
                    />
                  </div>
                ))
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold">Início inscrições (opcional)</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={form.inscricaoInicio}
                min={minDateTime}
                max={maxDateTime}
                onChange={(e) => {
                  set("inscricaoInicio", e.target.value);
                  setErro("");
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Fim inscrições (opcional)</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={form.inscricaoFim}
                min={minDateTime}
                max={maxDateTime}
                onChange={(e) => {
                  set("inscricaoFim", e.target.value);
                  setErro("");
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-semibold">
                Data e hora de início do evento*
              </label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={form.dataEvento}
                min={form.inscricaoFim || minDateTime}
                max={maxDateTime}
                onChange={(e) => {
                  set("dataEvento", e.target.value);
                  setErro("");
                }}
              />
            </div>

            {isOnline ? (
              <div>
                <label className="block text-sm font-semibold">
                  Data e hora de término da live (opcional)
                </label>
                <input
                  type="datetime-local"
                  className="w-full border rounded px-3 py-2"
                  value={form.dataFimEvento}
                  min={form.dataEvento || minDateTime}
                  max={maxDateTime}
                  onChange={(e) => {
                    set("dataFimEvento", e.target.value);
                    setErro("");
                  }}
                />
              </div>
            ) : null}
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
              {isOnline ? "Link de inscrição/transmissão (opcional)" : "Link de inscrição (opcional)"}
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
              <label className="block text-sm font-semibold">Vagas (opcional)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={form.vagas}
                onChange={(e) => set("vagas", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold">Valor (R$) (opcional)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={form.valorInscricao}
                onChange={(e) => set("valorInscricao", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold">Requisitos (opcional)</label>
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
              {salvando
                ? "Salvando..."
                : isEditandoAulaAvulsa || isEditandoEventoNormal
                  ? "Salvar alterações"
                  : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}