import { useEffect, useState, useMemo } from "react";
import { toast } from "@/lib/toast";
import axios from "axios";
import { Link } from "wouter";
import Storage from "../../utils/storage.js";
import { API } from "../../config.js";
import { EventoTipo, labelEventoTipo } from "@/utils/eventos.js";
import {
  CalendarClock,
  Radio,
  Users,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import CoverImage from "../../components/shared/CoverImage.js";

type EventoListItem = {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  tipoLabel?: string;
  descricao?: string | null;
  dataEvento: string;
  cidade?: string | null;
  estado?: string | null;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
  linkInscricao?: string | null;
};

type UsuarioResumoAula = {
  id: string;
  nome?: string | null;
  nomeDeUsuario?: string | null;
  email?: string | null;
  foto?: string | null;
  tipo?: string | null;
};

type ConvidadoAula = {
  id?: string;
  usuarioId?: string | null;
  nome?: string | null;
  descricao?: string | null;
  usuario?: UsuarioResumoAula | null;
};

type AulaAoVivoResumo = {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: "AGENDADA" | "AO_VIVO" | "FINALIZADA" | "CANCELADA";
  dataInicio: string;
  dataFim?: string | null;
  chatAtivo?: boolean;
  gravacaoAtiva?: boolean;
  replayDisponivel?: boolean;
  totalParticipantes?: number | null;
  totalMensagens?: number | null;
  thumbUrl?: string | null;
  convidadoUsuarioId?: string | null;
  convidadoNome?: string | null;
  convidadoDescricao?: string | null;
  convidadoUsuario?: UsuarioResumoAula | null;
  convidados?: ConvidadoAula[];
  metodologiaId?: string | null;
  metodologiaAvulsaId?: string | null;
  estruturaId?: string | null;
  estruturaAvulsaId?: string | null;
  itemId?: string | null;
  itemAvulsaId?: string | null;
  criadorUsuarioId?: string | null;
  metodologia?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
  } | null;
  metodologiaAvulsa?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
  } | null;
};

const FRONTEND_BASE_URL =
  import.meta.env.VITE_FRONTEND_BASE_URL ||
  import.meta.env.VITE_APP_URL ||
  window.location.origin;

const AVATAR_FALLBACK = `${FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function normalizarTexto(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getEventoPublicoUrl(aula: AulaAoVivoResumo) {
  const texto = normalizarTexto(
    [
      aula?.titulo,
      aula?.descricao,
      aula?.metodologia?.titulo,
      aula?.metodologiaAvulsa?.titulo,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const deveUsarSalaCopa =
    texto.includes("sala copa") ||
    texto.includes("copa") ||
    texto.includes("copa do mundo") ||
    texto.includes("mundial");

  const origemInfo = getOrigemAula(aula);

  const origem =
    origemInfo.tipo === "AVULSA"
      ? "avulsa"
      : origemInfo.tipo === "LEARNING"
        ? "learning"
        : "evento";

  const metodologiaId =
    origemInfo.tipo === "EVENTO_AVULSO" ? "" : origemInfo.metodologiaId;

  if (!deveUsarSalaCopa) {
    return `/learning/evento/${aula.id}`;
  }
  
  return `/learning/evento/sala-copa?aulaId=${aula.id}&origem=${origem}&metodologiaId=${metodologiaId}`;
}

function getMetodologiaUrl(aula: AulaAoVivoResumo) {
  const origemInfo = getOrigemAula(aula);

  if (origemInfo.tipo === "AVULSA") {
    return `/learning/${origemInfo.metodologiaId}?origem=avulsa`;
  }

  if (origemInfo.tipo === "LEARNING") {
    return `/learning/${origemInfo.metodologiaId}?origem=learning`;
  }

  return `/creator/eventos/novo?aulaId=${aula.id}`;
}

const TIMEZONE_BR = "America/Sao_Paulo";

function formatarDataHoraLive(value?: string | null) {
  if (!value) return "Sem data definida";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleString("pt-BR", {
    timeZone: TIMEZONE_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getNomeUsuarioAula(usuario?: UsuarioResumoAula | null) {
  if (!usuario) return "";

  return (
    usuario.nome ||
    usuario.nomeDeUsuario ||
    usuario.email ||
    ""
  );
}

function getConvidadosLabel(aula?: AulaAoVivoResumo | null) {
  if (!aula) return "";

  const convidadosArray = Array.isArray(aula.convidados)
    ? aula.convidados
        .map((c) => {
          const nome =
            c.nome ||
            getNomeUsuarioAula(c.usuario) ||
            "";

          const descricao = c.descricao || "";

          if (!nome) return "";

          return descricao ? `${nome} — ${descricao}` : nome;
        })
        .filter(Boolean)
    : [];

  if (convidadosArray.length > 0) {
    return convidadosArray.join(" • ");
  }

  const convidadoUnico =
    aula.convidadoNome ||
    getNomeUsuarioAula(aula.convidadoUsuario);

  if (convidadoUnico) {
    return aula.convidadoDescricao
      ? `${convidadoUnico} — ${aula.convidadoDescricao}`
      : convidadoUnico;
  }

  return "";
}

function getLiveStatusInfo(status?: string) {
  const s = String(status || "").toUpperCase();

  if (s === "AO_VIVO") {
    return {
      label: "Ao vivo agora",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <Radio className="w-4 h-4" />,
      buttonLabel: "Voltar para live",
    };
  }

  if (s === "FINALIZADA") {
    return {
      label: "Finalizada",
      className: "bg-slate-100 text-slate-700 border-slate-200",
      icon: <CheckCircle2 className="w-4 h-4" />,
      buttonLabel: "Ver detalhes",
    };
  }

  if (s === "CANCELADA") {
    return {
      label: "Cancelada",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle className="w-4 h-4" />,
      buttonLabel: "Ver detalhes",
    };
  }

  return {
    label: "Agendada",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <CalendarClock className="w-4 h-4" />,
    buttonLabel: "Preparar transmissão",
  };
}

function getOrigemAula(aula: AulaAoVivoResumo) {
  const metodologiaAvulsaId =
    aula.metodologiaAvulsa?.id || aula.metodologiaAvulsaId || "";

  const metodologiaId =
    aula.metodologia?.id || aula.metodologiaId || "";

  const estruturaAvulsaId = aula.estruturaAvulsaId || "";
  const itemAvulsaId = aula.itemAvulsaId || "";

  const estruturaId = aula.estruturaId || "";
  const itemId = aula.itemId || "";

  const pertenceAvulsa =
    !!metodologiaAvulsaId && !!estruturaAvulsaId && !!itemAvulsaId;

  const pertenceLearning =
    !!metodologiaId && !!estruturaId && !!itemId;

  if (pertenceAvulsa) {
    return {
      tipo: "AVULSA" as const,
      label: "Premium",
      className: "border-purple-200 bg-purple-50 text-purple-700",
      metodologiaId: metodologiaAvulsaId,
      estruturaId: estruturaAvulsaId,
      itemId: itemAvulsaId,
      origemParam: "avulsa",
    };
  }

  if (pertenceLearning) {
    return {
      tipo: "LEARNING" as const,
      label: "Metodologia",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      metodologiaId,
      estruturaId,
      itemId,
      origemParam: "learning",
    };
  }

  return {
    tipo: "EVENTO_AVULSO" as const,
    label: "Evento avulso",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    metodologiaId: "",
    estruturaId: "",
    itemId: "",
    origemParam: "evento",
  };
}

export default function CreatorEventosPage() {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [lista, setLista] = useState<EventoListItem[]>([]);
  const [lives, setLives] = useState<AulaAoVivoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [apagandoId, setApagandoId] = useState<string | null>(null);

  async function carregarTudo() {
    try {
      setLoading(true);

      const [eventosRes, livesRes] = await Promise.allSettled([
        axios.get(`${API.BASE_URL}/api/eventos/creator/me`, { headers }),
        axios.get(`${API.BASE_URL}/api/aulas-ao-vivo/minhas`, { headers }),
      ]);

      if (eventosRes.status === "fulfilled") {
        const data = eventosRes.value.data;
        setLista(Array.isArray(data) ? data : []);
      } else {
        setLista([]);
      }

      if (livesRes.status === "fulfilled") {
        const data = livesRes.value.data;
        setLives(Array.isArray(data?.items) ? data.items : []);
      } else {
        setLives([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function editarEventoNormal(id: string) {
    window.location.href = `/creator/eventos/novo?id=${encodeURIComponent(id)}`;
  }

  async function apagarEventoNormal(id: string) {
    const ok = window.confirm("Tem certeza que deseja apagar este evento?");
    if (!ok) return;

    try {
      setApagandoId(`evento_${id}`);

      await axios.delete(`${API.BASE_URL}/api/eventos/creator/${id}`, {
        headers,
      });

      await carregarTudo();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Erro ao apagar evento."
      );
    } finally {
      setApagandoId(null);
    }
  }

  function editarLiveLearning(aula: AulaAoVivoResumo) {
    window.location.href = `/creator/eventos/novo?aulaId=${encodeURIComponent(aula.id)}`;
  }

  async function apagarLiveLearning(aula: AulaAoVivoResumo) {
    const origem = getOrigemAula(aula);

    if (aula.status === "AO_VIVO") {
      toast.error("Finalize a transmissão antes de apagar este evento.");
      return;
    }

    const ok = window.confirm(
      origem.tipo === "EVENTO_AVULSO"
        ? "Tem certeza que deseja apagar esta aula ao vivo?"
        : "Tem certeza que deseja remover esta aula ao vivo da metodologia? O restante da metodologia continuará existindo."
    );

    if (!ok) return;

    try {
      setApagandoId(`live_${aula.id}`);

      if (origem.tipo === "EVENTO_AVULSO") {
        await axios.delete(`${API.BASE_URL}/api/aulas-ao-vivo/${aula.id}`, {
          headers,
        });

        await carregarTudo();
        return;
      }

      if (!origem.metodologiaId || !origem.estruturaId || !origem.itemId) {
        toast.error(
          "Não foi possível encontrar a estrutura/item desta aula para apagar somente ela."
        );
        return;
      }

      if (origem.tipo === "AVULSA") {
        await axios.delete(
          `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${origem.metodologiaId}/estruturas/${origem.estruturaId}/itens`,
          {
            headers,
            data: { itemIds: [origem.itemId] },
          }
        );
      } else {
        await axios.delete(
          `${API.BASE_URL}/api/metodologias/${origem.metodologiaId}/estruturas/${origem.estruturaId}/itens`,
          {
            headers,
            data: { itemIds: [origem.itemId] },
          }
        );
      }

      await carregarTudo();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Erro ao apagar aula ao vivo."
      );
    } finally {
      setApagandoId(null);
    }
  }

  const listaUnificada = useMemo(() => {
    return [
      ...lives.map((aula) => ({
        kind: "AULA_AO_VIVO" as const,
        id: aula.id,
        data: aula.dataInicio,
        aula,
      })),
      ...lista.map((evento) => ({
        kind: "EVENTO" as const,
        id: evento.id,
        data: evento.dataEvento,
        evento,
      })),
    ].sort((a, b) => {
      const da = new Date(a.data || 0).getTime();
      const db = new Date(b.data || 0).getTime();
      return da - db;
    });
  }, [lives, lista]);

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

        <h1 className="text-2xl font-extrabold">Eventos do Creator</h1>
        <p className="text-white/80 text-sm mt-1">
          Crie e gerencie aulas ao vivo, webinars, lives, palestras, peneiras e eventos.
        </p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl border p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg">Seus eventos</h2>
              <p className="text-sm text-green-900/70">
                Eventos criados aparecem no seu perfil Creator e podem ser usados para lives, webinars ou inscrições.
              </p>
            </div>

            <Link
              href="/creator/eventos/novo"
              className="shrink-0 rounded-xl bg-green-700 px-4 py-2 text-white font-bold text-sm"
            >
              + Criar
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando eventos...</div>
        ) : listaUnificada.length === 0 ? (
          <div className="bg-white rounded-2xl border p-6 text-center text-green-900/70">
            Nenhum evento criado ainda.
          </div>
        ) : (
          <ul className="grid gap-3">
            {listaUnificada.map((item) => {
              if (item.kind === "AULA_AO_VIVO") {
                const aula = item.aula;
                const statusInfo = getLiveStatusInfo(aula.status);
                const origemInfo = getOrigemAula(aula);
                const convidadosLabel = getConvidadosLabel(aula);

                const capa =
                  aula.thumbUrl ||
                  aula.metodologia?.capaUrl ||
                  aula.metodologiaAvulsa?.capaUrl ||
                  AVATAR_FALLBACK;

                return (
                  <li key={`live_${aula.id}`} className="bg-white rounded-2xl border p-4 shadow-sm">
                    <div className="flex gap-3">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-emerald-50 shrink-0">
                        <CoverImage
                          src={capa}
                          alt={aula.titulo}
                          pasta="metodologias"
                          className="w-full h-full"
                        />
                      </div>
                          
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${statusInfo.className}`}
                              >
                                {statusInfo.icon}
                                {statusInfo.label}
                              </span>

                              {aula.gravacaoAtiva ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                  <PlayCircle className="w-4 h-4" />
                                  Gravação ativa
                                </span>
                              ) : null}

                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${origemInfo.className}`}
                              >
                                {origemInfo.label}
                              </span>

                            </div>

                            <h3 className="font-extrabold text-green-950 leading-tight">
                              {aula.titulo}
                            </h3>

                            {aula.descricao ? (
                              <p className="text-sm text-green-900/70 mt-1 line-clamp-2">
                                {aula.descricao}
                              </p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap gap-3 text-sm text-green-900/70">
                              <span>{formatarDataHoraLive(aula.dataInicio)}</span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {aula.totalParticipantes ?? 0} participantes
                              </span>
                            </div>

                            {convidadosLabel ? (
                              <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-green-900">
                                <b>Convidados:</b> {convidadosLabel}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => editarLiveLearning(aula)}
                              className="h-9 w-9 rounded-full border border-emerald-200 bg-white text-emerald-800 flex items-center justify-center hover:bg-emerald-50"
                              title="Editar aula ao vivo"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={apagandoId === `live_${aula.id}`}
                              onClick={() => apagarLiveLearning(aula)}
                              className="h-9 w-9 rounded-full border border-red-200 bg-white text-red-600 flex items-center justify-center hover:bg-red-50 disabled:opacity-50"
                              title="Apagar aula ao vivo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/learning/live-studio?aulaId=${aula.id}`;
                        }}
                        className="h-11 rounded-xl bg-green-700 text-white font-bold"
                      >
                        {statusInfo.buttonLabel}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = getEventoPublicoUrl(aula);
                        }}
                        className="h-11 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold"
                      >
                        Ver página do evento
                      </button>

                      {origemInfo.tipo === "EVENTO_AVULSO" ? (
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/creator/eventos/novo?aulaId=${aula.id}`;
                          }}
                          className="h-11 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold"
                        >
                          Editar evento
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = getMetodologiaUrl(aula);
                          }}
                          className="h-11 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold"
                        >
                          Ver metodologia
                        </button>
                      )}
                    </div>
                  </li>
                );
              }

              const e = item.evento;

              return (
                <li key={`evento_${e.id}`} className="bg-white rounded-2xl border p-4 shadow-sm">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-bold">{e.titulo}</div>
                      <div className="text-sm text-green-900/70">
                        {e.tipoLabel || labelEventoTipo(e.tipo)} •{" "}
                        {new Date(e.dataEvento).toLocaleString()}
                        {e.cidade ? ` • ${e.cidade}${e.estado ? " - " + e.estado : ""}` : ""}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="h-fit text-xs px-2 py-1 rounded bg-green-100 text-green-900">
                        {e.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => editarEventoNormal(e.id)}
                        className="h-9 w-9 rounded-full border border-emerald-200 bg-white text-emerald-800 flex items-center justify-center hover:bg-emerald-50"
                        title="Editar evento"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={apagandoId === `evento_${e.id}`}
                        onClick={() => apagarEventoNormal(e.id)}
                        className="h-9 w-9 rounded-full border border-red-200 bg-white text-red-600 flex items-center justify-center hover:bg-red-50 disabled:opacity-50"
                        title="Apagar evento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {e.descricao && (
                    <p className="text-sm text-green-900/80 mt-2 line-clamp-3">
                      {e.descricao}
                    </p>
                  )}

                  <div className="mt-3 flex gap-3">
                    <Link href={`/eventos/${e.id}`} className="text-sm underline text-green-800">
                      Ver detalhes
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}