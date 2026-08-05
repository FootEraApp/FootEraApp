import { toast } from "@/lib/toast";
import { useEffect, useState, useMemo } from "react";
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
  Search,
  ArrowUpDown,
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
  pais?: string | null;
  local?: string | null;
  endereco?: string | null;
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

type OrdenacaoEventos =
  | "data_proxima"
  | "data_antiga"
  | "nome_asc"
  | "nome_desc";

type ItemEventoUnificado =
  | {
      kind: "AULA_AO_VIVO";
      id: string;
      data: string;
      aula: AulaAoVivoResumo;
    }
  | {
      kind: "EVENTO";
      id: string;
      data: string;
      evento: EventoListItem;
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

function obterChaveDataBrasil(
  value?: string | Date | null
): string {
  if (!value) return "";

  const data =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(data.getTime())) {
    return "";
  }

  const partes = new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone: TIMEZONE_BR,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(data);

  const ano =
    partes.find(
      (parte) => parte.type === "year"
    )?.value ?? "";

  const mes =
    partes.find(
      (parte) => parte.type === "month"
    )?.value ?? "";

  const dia =
    partes.find(
      (parte) => parte.type === "day"
    )?.value ?? "";

  return `${ano}-${mes}-${dia}`;
}

function eventoEhHoje(
  value?: string | null
): boolean {
  if (!value) return false;

  return (
    obterChaveDataBrasil(value) ===
    obterChaveDataBrasil(new Date())
  );
}

function obterTimestampEvento(
  item: ItemEventoUnificado
): number {
  const timestamp = new Date(
    item.data
  ).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.MAX_SAFE_INTEGER;
}

function obterTituloEvento(
  item: ItemEventoUnificado
): string {
  return item.kind === "AULA_AO_VIVO"
    ? item.aula.titulo
    : item.evento.titulo;
}

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
  const [busca, setBusca] = useState("");

  const [ordenacao, setOrdenacao] =
    useState<OrdenacaoEventos>(
      "data_proxima"
    );

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

  const listaUnificada =
    useMemo<ItemEventoUnificado[]>(
      () => [
        ...lives.map(
          (aula): ItemEventoUnificado => ({
            kind: "AULA_AO_VIVO",
            id: aula.id,
            data: aula.dataInicio,
            aula,
          })
        ),

        ...lista.map(
          (evento): ItemEventoUnificado => ({
            kind: "EVENTO",
            id: evento.id,
            data: evento.dataEvento,
            evento,
          })
        ),
      ],
      [lives, lista]
    );

  const itensFiltradosOrdenados =
    useMemo(() => {
      const termo =
        normalizarTexto(busca.trim());

      const filtrados =
        listaUnificada.filter((item) => {
          if (!termo) {
            return true;
          }

          if (
            item.kind ===
            "AULA_AO_VIVO"
          ) {
            const aula = item.aula;

            const statusInfo =
              getLiveStatusInfo(
                aula.status
              );

            const origemInfo =
              getOrigemAula(aula);

            const convidados =
              getConvidadosLabel(aula);

            const textoPesquisa = [
              aula.titulo,
              aula.descricao,
              aula.status,
              statusInfo.label,
              origemInfo.label,
              convidados,
              aula.metodologia?.titulo,
              aula.metodologiaAvulsa
                ?.titulo,
              formatarDataHoraLive(
                aula.dataInicio
              ),
            ]
              .filter(Boolean)
              .join(" ");

            return normalizarTexto(
              textoPesquisa
            ).includes(termo);
          }

          const evento =
            item.evento;

          const textoPesquisa = [
            evento.titulo,
            evento.descricao,
            evento.tipoLabel,
            labelEventoTipo(
              evento.tipo
            ),
            evento.status,
            evento.cidade,
            evento.estado,
            evento.pais,
            evento.local,
            evento.endereco,
            formatarDataHoraLive(
              evento.dataEvento
            ),
          ]
            .filter(Boolean)
            .join(" ");

          return normalizarTexto(
            textoPesquisa
          ).includes(termo);
        });

      const agora = Date.now();

      return [...filtrados].sort(
        (itemA, itemB) => {
          if (
            ordenacao === "nome_asc" ||
            ordenacao === "nome_desc"
          ) {
            const comparacao =
              obterTituloEvento(
                itemA
              ).localeCompare(
                obterTituloEvento(
                  itemB
                ),
                "pt-BR",
                {
                  sensitivity: "base",
                }
              );

            return ordenacao ===
              "nome_asc"
              ? comparacao
              : -comparacao;
          }

          const dataA =
            obterTimestampEvento(
              itemA
            );

          const dataB =
            obterTimestampEvento(
              itemB
            );

          if (
            ordenacao ===
            "data_antiga"
          ) {
            return dataA - dataB;
          }

          const futuroA =
            dataA >= agora;

          const futuroB =
            dataB >= agora;

          if (
            futuroA &&
            !futuroB
          ) {
            return -1;
          }

          if (
            !futuroA &&
            futuroB
          ) {
            return 1;
          }

          if (
            futuroA &&
            futuroB
          ) {
            return dataA - dataB;
          }

          return dataB - dataA;
        }
      );
    }, [
      listaUnificada,
      busca,
      ordenacao,
    ]);

  const eventosDeHoje =
    useMemo(
      () =>
        itensFiltradosOrdenados.filter(
          (item) =>
            eventoEhHoje(item.data)
        ),
      [itensFiltradosOrdenados]
    );

  const outrosEventos =
    useMemo(
      () =>
        itensFiltradosOrdenados.filter(
          (item) =>
            !eventoEhHoje(item.data)
        ),
      [itensFiltradosOrdenados]
    );

  const renderizarEvento = (
    item: ItemEventoUnificado
  ) => {
    if (item.kind === "AULA_AO_VIVO") {
      const aula = item.aula;

      const statusInfo =
        getLiveStatusInfo(aula.status);

      const origemInfo =
        getOrigemAula(aula);

      const convidadosLabel =
        getConvidadosLabel(aula);

      const capa =
        aula.thumbUrl ||
        aula.metodologia?.capaUrl ||
        aula.metodologiaAvulsa?.capaUrl ||
        AVATAR_FALLBACK;

      return (
        <li
          key={`live_${aula.id}`}
          className="
            rounded-2xl border
            bg-white p-4 shadow-sm
          "
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div
              className="
                h-20 w-20 shrink-0
                overflow-hidden rounded-2xl
                bg-emerald-50
              "
            >
              <CoverImage
                src={capa}
                alt={aula.titulo}
                pasta="metodologias"
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span
                      className={`
                        inline-flex items-center gap-1
                        rounded-full border
                        px-3 py-1
                        text-xs font-bold
                        ${statusInfo.className}
                      `}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>

                    {aula.gravacaoAtiva && (
                      <span
                        className="
                          inline-flex items-center gap-1
                          rounded-full
                          border border-emerald-200
                          bg-emerald-50
                          px-3 py-1
                          text-xs font-bold
                          text-emerald-700
                        "
                      >
                        <PlayCircle className="h-4 w-4" />
                        Gravação ativa
                      </span>
                    )}

                    <span
                      className={`
                        inline-flex items-center gap-1
                        rounded-full border
                        px-3 py-1
                        text-xs font-bold
                        ${origemInfo.className}
                      `}
                    >
                      {origemInfo.label}
                    </span>
                  </div>

                  <h3 className="font-extrabold leading-tight text-green-950">
                    {aula.titulo}
                  </h3>

                  {aula.descricao && (
                    <p className="mt-1 line-clamp-2 text-sm text-green-900/70">
                      {aula.descricao}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-green-900/70">
                    <span>
                      {formatarDataHoraLive(
                        aula.dataInicio
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4" />

                      {aula.totalParticipantes ?? 0}{" "}
                      participantes
                    </span>
                  </div>

                  {convidadosLabel && (
                    <div
                      className="
                        mt-2 rounded-xl
                        border border-emerald-100
                        bg-emerald-50
                        px-3 py-2
                        text-sm text-green-900
                      "
                    >
                      <b>Convidados:</b>{" "}
                      {convidadosLabel}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      editarLiveLearning(aula)
                    }
                    className="
                      flex h-9 w-9
                      items-center justify-center
                      rounded-full
                      border border-emerald-200
                      bg-white text-emerald-800
                      hover:bg-emerald-50
                    "
                    title="Editar aula ao vivo"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    disabled={
                      apagandoId ===
                      `live_${aula.id}`
                    }
                    onClick={() =>
                      apagarLiveLearning(aula)
                    }
                    className="
                      flex h-9 w-9
                      items-center justify-center
                      rounded-full
                      border border-red-200
                      bg-white text-red-600
                      hover:bg-red-50
                      disabled:opacity-50
                    "
                    title="Apagar aula ao vivo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  `/learning/live-studio?aulaId=${aula.id}`;
              }}
              className="
                h-11 rounded-xl
                bg-green-700
                font-bold text-white
                hover:bg-green-800
              "
            >
              {statusInfo.buttonLabel}
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  getEventoPublicoUrl(aula);
              }}
              className="
                h-11 rounded-xl
                border border-emerald-200
                bg-emerald-50
                font-bold text-emerald-800
                hover:bg-emerald-100
              "
            >
              Ver página do evento
            </button>

            {origemInfo.tipo ===
            "EVENTO_AVULSO" ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    `/creator/eventos/novo?aulaId=${aula.id}`;
                }}
                className="
                  h-11 rounded-xl
                  border border-slate-200
                  bg-white
                  font-bold text-slate-800
                  hover:bg-slate-50
                "
              >
                Editar evento
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    getMetodologiaUrl(aula);
                }}
                className="
                  h-11 rounded-xl
                  border border-slate-200
                  bg-white
                  font-bold text-slate-800
                  hover:bg-slate-50
                "
              >
                Ver metodologia
              </button>
            )}
          </div>
        </li>
      );
    }

    const evento = item.evento;

    return (
      <li
        key={`evento_${evento.id}`}
        className="
          rounded-2xl border
          bg-white p-4 shadow-sm
        "
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="min-w-0">
            <div className="font-bold text-green-950">
              {evento.titulo}
            </div>

            <div className="mt-1 text-sm text-green-900/70">
              {evento.tipoLabel ||
                labelEventoTipo(evento.tipo)}

              {" • "}

              {formatarDataHoraLive(
                evento.dataEvento
              )}

              {evento.cidade
                ? ` • ${evento.cidade}${
                    evento.estado
                      ? ` - ${evento.estado}`
                      : ""
                  }`
                : ""}
            </div>

            {(evento.local ||
              evento.endereco) && (
              <div className="mt-1 text-sm text-green-900/70">
                {evento.local ||
                  evento.endereco}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <span
              className="
                h-fit rounded
                bg-green-100
                px-2 py-1
                text-xs text-green-900
              "
            >
              {evento.status}
            </span>

            <button
              type="button"
              onClick={() =>
                editarEventoNormal(
                  evento.id
                )
              }
              className="
                flex h-9 w-9
                items-center justify-center
                rounded-full
                border border-emerald-200
                bg-white text-emerald-800
                hover:bg-emerald-50
              "
              title="Editar evento"
            >
              <Pencil className="h-4 w-4" />
            </button>

            <button
              type="button"
              disabled={
                apagandoId ===
                `evento_${evento.id}`
              }
              onClick={() =>
                apagarEventoNormal(
                  evento.id
                )
              }
              className="
                flex h-9 w-9
                items-center justify-center
                rounded-full
                border border-red-200
                bg-white text-red-600
                hover:bg-red-50
                disabled:opacity-50
              "
              title="Apagar evento"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {evento.descricao && (
          <p className="mt-2 line-clamp-3 text-sm text-green-900/80">
            {evento.descricao}
          </p>
        )}

        <div className="mt-3 flex gap-3">
          <Link
            href={`/eventos/${evento.id}`}
            className="text-sm text-green-800 underline"
          >
            Ver detalhes
          </Link>
        </div>
      </li>
    );
  };

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

        <div className="mb-4 rounded-2xl border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_250px]">
            <label className="relative block">
              <Search
                className="
                  pointer-events-none
                  absolute left-3 top-1/2
                  h-5 w-5
                  -translate-y-1/2
                  text-green-900/50
                "
              />

              <input
                type="search"
                value={busca}
                onChange={(event) =>
                  setBusca(
                    event.target.value
                  )
                }
                placeholder="Pesquisar por nome, data, tipo, status, local ou convidado..."
                className="
                  h-11 w-full rounded-xl
                  border border-green-200
                  bg-white pl-10 pr-4
                  text-sm text-green-950
                  outline-none
                  placeholder:text-green-900/50
                  focus:border-green-500
                  focus:ring-2
                  focus:ring-green-100
                "
              />
            </label>

            <label className="relative block">
              <ArrowUpDown
                className="
                  pointer-events-none
                  absolute left-3 top-1/2
                  h-5 w-5
                  -translate-y-1/2
                  text-green-900/50
                "
              />

              <select
                value={ordenacao}
                onChange={(event) =>
                  setOrdenacao(
                    event.target
                      .value as OrdenacaoEventos
                  )
                }
                className="
                  h-11 w-full appearance-none
                  rounded-xl
                  border border-green-200
                  bg-white pl-10 pr-4
                  text-sm text-green-950
                  outline-none
                  focus:border-green-500
                  focus:ring-2
                  focus:ring-green-100
                "
              >
                <option value="data_proxima">
                  Data mais próxima
                </option>

                <option value="data_antiga">
                  Data mais antiga
                </option>

                <option value="nome_asc">
                  Nome A–Z
                </option>

                <option value="nome_desc">
                  Nome Z–A
                </option>
              </select>
            </label>
          </div>

          {busca.trim() && (
            <div className="mt-3 text-xs text-green-900/60">
              {itensFiltradosOrdenados.length}{" "}
              resultado(s) encontrado(s)
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-8 text-center">
            Carregando eventos...
          </div>
        ) : itensFiltradosOrdenados.length ===
          0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-green-900/70">
            {busca.trim()
              ? "Nenhum evento encontrado para essa pesquisa."
              : "Nenhum evento criado ainda."}
          </div>
        ) : (
          <div className="grid gap-6">
            {eventosDeHoje.length > 0 && (
              <section
                className="
                  rounded-2xl
                  border border-emerald-300
                  bg-emerald-50/70
                  p-3 sm:p-4
                "
              >
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="
                      flex h-10 w-10
                      items-center justify-center
                      rounded-full
                      bg-emerald-600
                      text-white
                    "
                  >
                    <CalendarClock className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="font-extrabold text-emerald-950">
                      Eventos de hoje
                    </h2>

                    <p className="text-xs text-emerald-900/70">
                      {eventosDeHoje.length}{" "}
                      evento(s) programado(s)
                      para hoje
                    </p>
                  </div>
                </div>

                <ul className="grid gap-3">
                  {eventosDeHoje.map(
                    renderizarEvento
                  )}
                </ul>
              </section>
            )}

            {outrosEventos.length > 0 && (
              <section>
                <div className="mb-3">
                  <h2 className="font-bold text-green-950">
                    {eventosDeHoje.length > 0
                      ? "Outros eventos"
                      : "Todos os eventos"}
                  </h2>
                </div>

                <ul className="grid gap-3">
                  {outrosEventos.map(
                    renderizarEvento
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}