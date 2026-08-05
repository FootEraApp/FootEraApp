import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import {
  User,
  Search,
  Filter,
  X,
  Trophy,
  School,
  Building2,
  MapPin,
  Goal,
  Shield,
  Heart,
  CalendarClock,
  Star,
  Users,
  Ticket,
  CheckCircle2,
} from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import BottomNav from "@/components/layout/BottomNav.js";
import Avatar from "../components/shared/Avatar.js";

const ENABLE_EVENTOS_TAB = false; 

type UsuarioBasic = {
  id: string;
  nome: string;
  nomeDeUsuario?:
    | string
    | null;
  email?:
    | string
    | null;
  verified?:
    | boolean
    | null;
  destaque?:
    | boolean
    | null;
  foto?:
    | string
    | null;
  cidade?:
    | string
    | null;
  estado?:
    | string
    | null;
  dataCriacao?:
    | string
    | null;
  assinatura?: {
    status?:
      | string
      | null;
    plano?:
      | string
      | null;
  } | null;
};

type AtletaItem = {
  id: string;
  usuario: UsuarioBasic;
  usuarioId?: string;
  foto?: string | null;
  tipoTreino?: string | null;
  posicao?: string | null;
  cidade?: string | null;
  estado?: string | null;
  independente?: boolean | null;
  pontuacao?: number | null;
  pontuacaoTotal?: number | null;
  categoriaBase?: string | null;
  idade?: number | null;
  categoria?: string[];
  perfilVerificado?: boolean;
  isPro?: boolean;
};

type ProfessorItem = {
  id: string;
  usuario: UsuarioBasic;
  foto?: string | null;
  perfilVerificado?: boolean;
  isPro?: boolean;
  clubeId?: string | null;
  escolinhaId?: string | null;
};

type ClubeItem = {
  id: string;
  usuarioId?: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
  usuario?: UsuarioBasic;
  perfilVerificado?: boolean;
  isPro?: boolean;
};

type EscolaItem = {
  id: string;
  usuarioId?: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
  siteOficial?: string | null;
  usuario?: UsuarioBasic;
  perfilVerificado?: boolean;
  isPro?: boolean;
};

type OlheiroItem = {
  id: string;
  usuario: UsuarioBasic;
  foto?: string | null;
  perfilVerificado?: boolean;
  isPro?: boolean;
  clubeId?: string | null;
  escolinhaId?: string | null;
};

type OutroItem = {
  id: string;
  usuarioId?: string;
  nome?: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
  foto?: string | null;
  descricao?: string | null;
  siteOficial?: string | null;
  usuario?: UsuarioBasic;
  perfilVerificado?: boolean;
  isPro?: boolean;
  tipoOutro: "Learning" | "Marca" | "Federacao";
};

type DadosExplorar = {
  atletas: AtletaItem[];
  professores: ProfessorItem[];
  olheiros: OlheiroItem[];
  clubes: ClubeItem[];
  escolas: EscolaItem[];
  eventos: EventoItem[];
  federacoes: OutroItem[];
  marcas: OutroItem[];
  learning: OutroItem[];
};

type Filtros = {
  categoria?: string;
  posicoes?: string[];
  estado?: string;
  cidade?: string;
  independente?: boolean | null;
  pontuacaoMin?: number | null;
  pontuacaoMax?: number | null;
};

type FiltrosProfissionais = {
  papel?: "Professor" | "Olheiro" | "Ambos";
  vinculo?: "Qualquer" | "Independente" | "Vinculado";
  estado?: string;
  cidade?: string;
};

type FiltrosOrgs = {
  estado?: string;
  cidade?: string;
  temSite?: boolean | null;
};

type FiltrosOutros = {
  tipo?: "Todos" | "Learning" | "Marca" | "Federacao";
  estado?: string;
  cidade?: string;
};

type RankItem = {
  atletaId: string;
  total: number;
  usuario: { id: string; nome: string; foto?: string | null };
};

type AbaExplorar = "atletas" | "escolas" | "clubes" | "profissionais" | "outros" | "eventos";

type AbaOrdenavel =
  Exclude<
    AbaExplorar,
    "eventos"
  >;

type OrdenacaoExplorar =
  | "nome_asc"
  | "nome_desc"
  | "recentes"
  | "antigos"
  | "pontuacao_desc"
  | "pontuacao_asc";

type OrdenacaoPorAba =
  Record<
    AbaOrdenavel,
    OrdenacaoExplorar
  >;

const ORDENACAO_INICIAL: OrdenacaoPorAba =
  {
    atletas:
      "nome_asc",

    escolas:
      "nome_asc",

    clubes:
      "nome_asc",

    profissionais:
      "nome_asc",

    outros:
      "nome_asc",
  };

type EventoItem = {
  id: string;
  titulo: string;
  tipo: "PENEIRA" | "EVENTO";
  descricao?: string | null;
  inicio: string;
  fim?: string | null;
  local?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  endereco?: string | null;
  vagas?: number | null;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
  valorInscricao?: string | null;
  linkInscricao?: string | null;
  requisitos?: string[] | null;

  clube?: {
    id: string;
    nome: string;
    logo?: string | null;
  } | null;

  inscrito?: boolean;
  totalInscritos?: number;
  convidado?: boolean;
};

const CAT_LABEL: Record<string, string> = {
  Sub3: "Sub-3",
  Sub5: "Sub-5",
  Sub7: "Sub-7",
  Sub9: "Sub-9",
  Sub11: "Sub-11",
  Sub13: "Sub-13",
  Sub15: "Sub-15",
  Sub16: "Sub-16",
  Livre: "Livre",
};
const CATEGORIAS = ["Sub3", "Sub5", "Sub7", "Sub9", "Sub11", "Sub13", "Sub15", "Sub16", "Livre"];

const mapIdadeParaCategoria = (idade?: number | null): string | null => {
  if (idade == null) return null;
  if (idade <= 3) return "Sub3";
  if (idade <= 5) return "Sub5";
  if (idade <= 7) return "Sub7";
  if (idade <= 9) return "Sub9";
  if (idade <= 11) return "Sub11";
  if (idade <= 13) return "Sub13";
  if (idade <= 15) return "Sub15";
  if (idade <= 16) return "Sub16";
  return "Livre";
};

const POSICOES = [
  "GOL",
  "LD",
  "LE",
  "ZD",
  "ZC",
  "ZE",
  "ALA_D",
  "ALA_E",
  "VOL1",
  "VOL2",
  "MC1",
  "MC2",
  "MEI",
  "MEI_D",
  "MEI_E",
  "MD",
  "ME",
  "PD",
  "PE",
  "SA",
  "CA",
];

function formatDateRange(inicioIso: string, fimIso?: string | null) {
  if (!inicioIso) return "";
  const inicio = new Date(inicioIso);
  const fim = fimIso ? new Date(fimIso) : null;

  const dia = inicio.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const horaInicio = inicio.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!fim) return `${dia} • ${horaInicio}h`;

  const mesmaData = inicio.toDateString() === fim.toDateString();
  const horaFim = fim.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (mesmaData) {
    return `${dia} • ${horaInicio} – ${horaFim}h`;
  }

  const diaFim = fim.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `${dia} ${horaInicio}h → ${diaFim} ${horaFim}h`;
}

function getProfMeta(p: any) {
  const role = p.role as "Professor" | "Olheiro";
  const cidade = p.usuario?.cidade ?? "";
  const estado = p.usuario?.estado ?? "";
  const vinculado = !!(p.clubeId || p.escolinhaId);
  return { role, cidade, estado, vinculado };
}

function Pill({
  children,
  tone = "emerald",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "emerald" | "amber" | "sky" | "gray" | "rose";
  className?: string;
}) {
  const map = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${map} ${className}`}>
      {children}
    </span>
  );
}

const stripDiacritics = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normText = (s?: string | null) =>
  stripDiacritics(String(s ?? "").trim().toLowerCase());

function isItemPro(x: any): boolean {
  if (x?.isPro === true) return true;

  const status = String(x?.usuario?.assinatura?.status ?? "").toUpperCase();
  const plano = String(x?.usuario?.assinatura?.plano ?? "").toUpperCase();

  if (status === "ATIVA" || status === "TRIAL") return true;
  if (plano.includes("PRO")) return true;

  return false;
}

function isItemDestaque(x: any): boolean {
  return Boolean(
    x?.destaque === true ||
      x?.perfilDestaque === true ||
      x?.usuario?.destaque === true ||
      x?.usuario?.perfilDestaque === true
  );
}

function shouldShowVerified(x: any): boolean {
  return Boolean(x?.perfilVerificado);
}

function shouldShowProBadgeOnAvatar(x: any): boolean {
  return isItemPro(x);
}

function ProfileStatusBadges({
  item,
  align = "center",
}: {
  item: any;
  align?:
    | "center"
    | "start";
}) {
  const verificado =
    shouldShowVerified(item);

  const destaque =
    isItemDestaque(item);

  if (
    !verificado &&
    !destaque
  ) {
    return null;
  }

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1 ${
        align === "start"
          ? "justify-start"
          : "justify-center"
      }`}
    >
      {verificado && (
        <Pill tone="emerald">
          <CheckCircle2 className="h-3.5 w-3.5" />

          Verificado
        </Pill>
      )}

      {destaque && (
        <Pill tone="amber">
          <Star
            className="h-3.5 w-3.5"
            fill="currentColor"
          />

          Destaque
        </Pill>
      )}
    </div>
  );
}

function prioridadePerfil(
  item: any
) {
  if (
    isItemDestaque(item)
  ) {
    return 0;
  }
  if (
    isItemPro(item)
  ) {
    return 1;
  }

  return 2;
}

function compararNomeExplorar(
  nomeA: string,
  nomeB: string
) {
  return String(
    nomeA || ""
  ).localeCompare(
    String(
      nomeB || ""
    ),
    "pt-BR",
    {
      sensitivity:
        "base",

      numeric:
        true,
    }
  );
}

function obterTimestampCriacao(
  item: any
) {
  const valor =
    item?.usuario
      ?.dataCriacao ??
    item?.dataCriacao ??
    item?.criadoEm ??
    item?.createdAt ??
    null;

  if (!valor) {
    return null;
  }

  const timestamp =
    new Date(
      valor
    ).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}

function ordenarExplorar<T>(
  itens: T[],
  ordenacao:
    OrdenacaoExplorar,
  getNome:
    (item: T) => string,
  getPontuacao?:
    (
      item: T
    ) =>
      number
      | null
      | undefined
) {
  return [...itens].sort(
    (itemA, itemB) => {

      const prioridadeA =
        prioridadePerfil(
          itemA
        );

      const prioridadeB =
        prioridadePerfil(
          itemB
        );

      if (
        prioridadeA !==
        prioridadeB
      ) {
        return (
          prioridadeA -
          prioridadeB
        );
      }

      const nomeA =
        getNome(
          itemA
        );

      const nomeB =
        getNome(
          itemB
        );

      const comparacaoNome =
        compararNomeExplorar(
          nomeA,
          nomeB
        );

      if (
        ordenacao ===
        "nome_asc"
      ) {
        return comparacaoNome;
      }

      if (
        ordenacao ===
        "nome_desc"
      ) {
        return -comparacaoNome;
      }

      if (
        ordenacao ===
          "recentes" ||
        ordenacao ===
          "antigos"
      ) {
        const dataA =
          obterTimestampCriacao(
            itemA
          );

        const dataB =
          obterTimestampCriacao(
            itemB
          );

        if (
          dataA === null &&
          dataB === null
        ) {
          return comparacaoNome;
        }

        if (
          dataA === null
        ) {
          return 1;
        }

        if (
          dataB === null
        ) {
          return -1;
        }

        const comparacaoData =
          ordenacao ===
          "recentes"
            ? dataB - dataA
            : dataA - dataB;

        return (
          comparacaoData ||
          comparacaoNome
        );
      }

      if (
        ordenacao ===
          "pontuacao_desc" ||
        ordenacao ===
          "pontuacao_asc"
      ) {
        const valorA =
          getPontuacao?.(
            itemA
          );

        const valorB =
          getPontuacao?.(
            itemB
          );

        const numeroA =
          valorA != null &&
          Number.isFinite(
            Number(valorA)
          )
            ? Number(
                valorA
              )
            : null;

        const numeroB =
          valorB != null &&
          Number.isFinite(
            Number(valorB)
          )
            ? Number(
                valorB
              )
            : null;

        if (
          numeroA === null &&
          numeroB === null
        ) {
          return comparacaoNome;
        }

        if (
          numeroA === null
        ) {
          return 1;
        }

        if (
          numeroB === null
        ) {
          return -1;
        }

        const comparacaoPontuacao =
          ordenacao ===
          "pontuacao_desc"
            ? numeroB -
              numeroA
            : numeroA -
              numeroB;

        return (
          comparacaoPontuacao ||
          comparacaoNome
        );
      }

      return comparacaoNome;
    }
  );
}

const normKey = (s?: string | null) =>
  normText(s).replace(/[^a-z0-9]/g, "");

const includesText = (base?: string | null, term?: string | null) => {
  const b = normText(base);
  const t = normText(term);
  if (!t) return true;
  return b.includes(t);
};

function Tab({
  active,
  onClick,
  children,
  icon,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-2 rounded-full text-sm transition
      ${active ? "bg-white text-green-900 font-semibold shadow" : "bg-green-100/70 text-green-800 hover:bg-green-100"} ${className}`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

function Explorar() {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<AbaExplorar>("atletas");
  const [
    ordenacaoPorAba,
    setOrdenacaoPorAba,
  ] = useState<OrdenacaoPorAba>(
    ORDENACAO_INICIAL
  );

  const abaOrdenavel:
    AbaOrdenavel | null =
    aba === "eventos"
      ? null
      : aba;

  const ordenacaoAtual =
    abaOrdenavel
      ? ordenacaoPorAba[
          abaOrdenavel
        ]
      : "nome_asc";

  function alterarOrdenacao(
    valor:
      OrdenacaoExplorar
  ) {
    if (!abaOrdenavel) {
      return;
    }

    setOrdenacaoPorAba(
      (anterior) => ({
        ...anterior,

        [abaOrdenavel]:
          valor,
      })
    );
  }
  const [dados, setDados] = useState<DadosExplorar>({
    atletas: [],
    professores: [],
    olheiros: [],
    clubes: [],
    escolas: [],
    eventos: [], 
    federacoes: [],
    learning: [],
    marcas: [],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });
  const [draft, setDraft] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });
  const [filtrosProf, setFiltrosProf] = useState<FiltrosProfissionais>({
    papel: "Ambos",
    vinculo: "Qualquer",
  });
  const [draftProf, setDraftProf] = useState<FiltrosProfissionais>({
    papel: "Ambos",
    vinculo: "Qualquer",
  });

  const [filtrosOrgs, setFiltrosOrgs] = useState<FiltrosOrgs>({ temSite: null });
  const [draftOrgs, setDraftOrgs] = useState<FiltrosOrgs>({ temSite: null });
  const [filtrosOutros, setFiltrosOutros] = useState<FiltrosOutros>({
    tipo: "Todos",
    cidade: "",
    estado: "",
  });

  const [draftOutros, setDraftOutros] = useState<FiltrosOutros>({
    tipo: "Todos",
    cidade: "",
    estado: "",
  });
  const updateDraft = (patch: Partial<Filtros>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const updateDraftOutros = (patch: Partial<FiltrosOutros>) => {
    setDraftOutros((prev) => ({ ...prev, ...patch }));
  };
  const [topGeral, setTopGeral] = useState<RankItem[]>([]);
  const [topPorCategoria, setTopPorCategoria] = useState<Record<string, RankItem[]>>({});
  const [carregandoDados, setCarregandoDados] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const BATCH = 20;
  const [showCountAtletas, setShowCountAtletas] = useState(BATCH);
  const [showCountEscolas, setShowCountEscolas] = useState(BATCH);
  const [showCountClubes, setShowCountClubes] = useState(BATCH);
  const [showCountProfs, setShowCountProfs] = useState(BATCH);
  const [showCountOutros, setShowCountOutros] = useState(BATCH);
  const [selectedEvento, setSelectedEvento] = useState<EventoItem | null>(null);
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [inscrevendoEvento, setInscrevendoEvento] = useState(false);
  const [erroEvento, setErroEvento] = useState<string | null>(null)
  const [pontosCache, setPontosCache] = useState<Record<string, number>>({});
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);
  const [favoritosPerfilIds, setFavoritosPerfilIds] = useState<string[]>([]);

  function getUserIdFromAtleta(a: AtletaItem): string {
    return String(a?.usuario?.id ?? a?.usuarioId ?? a?.id ?? "").trim();
  }

  function getUserIdFromProfessor(p: ProfessorItem): string {
    return String(p?.usuario?.id ?? "").trim();
  }

  function getUserIdFromOlheiro(o: OlheiroItem): string {
    return String(o?.usuario?.id ?? "").trim();
  }

  function getUserIdFromClube(c: ClubeItem): string {
    return String(c?.usuario?.id ?? c?.usuarioId ?? "").trim();
  }

  function getUserIdFromEscola(e: EscolaItem): string {
    return String(e?.usuario?.id ?? e?.usuarioId ?? "").trim();
  }

  function getUserIdFromOutro(o: OutroItem): string {
    return String(o?.usuario?.id ?? o?.usuarioId ?? "").trim();
  }

  function isPerfilFavorito(usuarioId?: string | null) {
    const id = String(usuarioId || "").trim();
    return !!id && favoritosPerfilIds.includes(id);
  }

  function calcTotalFromPontuacaoPayload(data: any): number {
    const performance = Number(data?.performance) || 0;
    const disciplina = Number(data?.disciplina) || 0;
    const responsabilidade = Number(data?.responsabilidade) || 0;
    return performance + disciplina + responsabilidade;
  }

  async function fetchPontuacaoTotalCorreta(usuarioId: string): Promise<number | null> {
    const id = String(usuarioId || "").trim();
    if (!id) return null;
    if (typeof pontosCache[id] === "number") return pontosCache[id];

    const token = Storage?.token || "";
    if (!token) return null;

    try {
      const r = await fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(id)}/pontuacao`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) return null;

      const data = await r.json();
      const total = calcTotalFromPontuacaoPayload(data);

      setPontosCache((prev) => ({ ...prev, [id]: total }));
      return total;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let alive = true;

    async function carregarFavoritosPerfil() {
      const token = Storage?.token || "";
      if (!token) return;

      try {
        const res = await fetch(`${API.BASE_URL}/api/favoritos`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => []);

        if (!res.ok) return;

        const ids = Array.isArray(data)
          ? data.map(String)
          : Array.isArray(data?.ids)
          ? data.ids.map(String)
          : Array.isArray(data?.items)
          ? data.items
              .map((item: any) => item?.favoritoUsuarioId || item?.usuarioId || item?.id)
              .filter(Boolean)
              .map(String)
          : [];

        if (alive) setFavoritosPerfilIds(Array.from(new Set(ids)));
      } catch (e) {
        console.warn("[explorar] erro ao carregar favoritos", e);
      }
    }

    carregarFavoritosPerfil();

    const onFocus = () => carregarFavoritosPerfil();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    setShowFilters(false);
  }, [aba]);

  useEffect(() => {
    if (!ENABLE_EVENTOS_TAB || aba !== "eventos") return;

    const token = Storage?.token || "";

    axios.get(`${API.BASE_URL}/api/eventos`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    .then(res => {
      setDados(prev => ({
        ...prev,
        eventos: res.data || [],
      }));
    })
    .catch(err => {
      console.error("❌ Erro ao buscar eventos", err);
      setDados(prev => ({ ...prev, eventos: [] }));
    });

  }, [aba]);

  const filtrosKey = JSON.stringify(filtros);
  const profissionais = useMemo(
    () =>
      [
        ...(dados.professores || []).map((p) => ({
          ...p,
          foto: p.foto ?? p.usuario?.foto,
          role: "Professor" as const,
        })),
        ...(dados.olheiros || []).map((o) => ({
          ...o,
          foto: o.foto ?? o.usuario?.foto,
          role: "Olheiro" as const,
        })),
      ].filter((x) => x?.usuario?.id),
    [dados.professores, dados.olheiros]
  );

  function getAtletaMeta(a: AtletaItem) {
    const nome = a?.usuario?.nome ?? "";
    const posicao =
      (a as any)?.posicao ??
      (a as any)?.posicaoCampo ??
      (a as any)?.posicaoPrincipal ??
      "";
    const cidade =
      (a as any)?.cidade ??
      (a as any)?.usuario?.cidade ??
      "";
    const estado =
      (a as any)?.estado ??
      (a as any)?.usuario?.estado ??
      "";
    const independenteRaw =
      (a as any)?.independente ??
      ((a as any)?.vinculado != null ? !(a as any).vinculado : null);
    const independente =
      typeof independenteRaw === "boolean" ? independenteRaw : null;
    const pontuacaoRaw =
      (a as any)?.pontuacaoTotal ??
      (typeof (a as any)?.pontuacao === "object"
        ? (a as any)?.pontuacao?.total
        : (a as any)?.pontuacao) ??
      (a as any)?.pontuacaoGeral ??
      (a as any)?.pontos ??
      (a as any)?.pontuacaoTotal ??
      (a as any)?.total ??
      (a as any)?.pontuacaoTotal ??
      null;
    const uidLocal = getUserIdFromAtleta(a);
    const pontuacaoFallback =
      typeof pontuacaoRaw === "number"
        ? pontuacaoRaw
        : pontuacaoRaw != null && !Number.isNaN(Number(pontuacaoRaw))
        ? Number(pontuacaoRaw)
        : null;
    const pontuacao =
      uidLocal && typeof pontosCache[uidLocal] === "number"
        ? pontosCache[uidLocal]
        : pontuacaoFallback;
    const categoria =
      (a as any)?.categoriaBase ||
      (Array.isArray((a as any)?.categoria) && (a as any).categoria[0]) ||
      mapIdadeParaCategoria((a as any)?.idade) ||
      "";

    return { nome, posicao, cidade, estado, independente, pontuacao, categoria };
  }

  const atletasFiltrados = useMemo(() => {
    const f = filtros;
    const q = normText(busca);

    const base = (dados.atletas || []).filter((a) => {
      if (mostrarFavoritos && !isPerfilFavorito(getUserIdFromAtleta(a))) {
        return false;
      }

      const m = getAtletaMeta(a);

      if (f.categoria) {
        if (normKey(m.categoria) !== normKey(f.categoria)) return false;
      }

      if (f.posicoes && f.posicoes.length > 0) {
        const posKey = normKey(m.posicao);
        if (!posKey) return false;

        const bate = f.posicoes.some((p) => posKey === normKey(p));
        if (!bate) return false;
      }

      if (f.estado && !includesText(m.estado, f.estado)) return false;
      if (f.cidade && !includesText(m.cidade, f.cidade)) return false;

      if (f.independente !== null && f.independente !== undefined) {
        if (m.independente == null || m.independente !== f.independente) return false;
      }

      if (typeof f.pontuacaoMin === "number") {
        if (typeof m.pontuacao !== "number" || m.pontuacao < f.pontuacaoMin) return false;
      }
      if (typeof f.pontuacaoMax === "number") {
        if (typeof m.pontuacao !== "number" || m.pontuacao > f.pontuacaoMax) return false;
      }

      if (q) {
        const bag = normText([m.nome, m.posicao, m.cidade, m.estado, m.categoria].join(" "));
        if (!bag.includes(q)) return false;
      }

      return true;
    });

    return ordenarExplorar(
      base,
      ordenacaoPorAba
        .atletas,

      (atleta) =>
        atleta.usuario
          ?.nome ??
        "",

      (atleta) =>
        getAtletaMeta(
          atleta
        ).pontuacao
    );
  }, [dados.atletas, filtrosKey, busca, pontosCache, mostrarFavoritos, favoritosPerfilIds, ordenacaoPorAba.atletas]);

  const eventosFiltrados = useMemo(() => {
    const q = (busca || "").toLowerCase();

    return (dados.eventos || []).filter((ev) => {
      if (!q) return true;

      const organizadorNome =
        ev.clube?.nome ||
        (ev as any).escolinha?.nome ||
        "";

      const campos = [
        ev.titulo,
        ev.descricao || "",
        ev.cidade || "",
        ev.estado || "",
        ev.local || "",
        organizadorNome,
      ]
        .join(" ")
        .toLowerCase();

      return campos.includes(q);
    });
  }, [dados.eventos, busca]);

  const escolasFiltradas = useMemo(() => {
    const q = normText(busca);
    const f = filtrosOrgs;

    const base = (dados.escolas || []).filter((e) => {
      if (mostrarFavoritos && !isPerfilFavorito(getUserIdFromEscola(e))) {
        return false;
      }

      if (f.estado && !includesText(e.estado, f.estado)) return false;
      if (f.cidade && !includesText(e.cidade, f.cidade)) return false;

      if (f.temSite !== null && f.temSite !== undefined) {
        const tem = !!(e.siteOficial && String(e.siteOficial).trim());
        if (tem !== f.temSite) return false;
      }

      if (q) {
        const bag = normText([e.nome, e.cidade, e.estado, e.siteOficial].join(" "));
        if (!bag.includes(q)) return false;
      }

      return true;
    });

    return ordenarExplorar(
      base,

      ordenacaoPorAba
        .escolas,

      (escola) =>
        escola.nome ??
        escola.usuario
          ?.nome ??
        ""
    );
  }, [dados.escolas, busca, JSON.stringify(filtrosOrgs), mostrarFavoritos, favoritosPerfilIds, ordenacaoPorAba.escolas]);

  const clubesFiltrados = useMemo(() => {
    const q = normText(busca);
    const f = filtrosOrgs;

    const base = (dados.clubes || []).filter((c) => {

      if (mostrarFavoritos && !isPerfilFavorito(getUserIdFromClube(c))) {
        return false;
      }

      if (f.estado && !includesText(c.estado, f.estado)) return false;
      if (f.cidade && !includesText(c.cidade, f.cidade)) return false;

      if (q) {
        const bag = normText([c.nome, c.cidade, c.estado].join(" "));
        if (!bag.includes(q)) return false;
      }

      return true; 
    });

    return ordenarExplorar(
      base,

      ordenacaoPorAba
        .clubes,

      (clube) =>
        clube.nome ??
        clube.usuario
          ?.nome ??
        ""
    );
  }, [dados.clubes, busca, JSON.stringify(filtrosOrgs), favoritosPerfilIds, mostrarFavoritos, ordenacaoPorAba.clubes]);

  const profissionaisFiltrados = useMemo(() => {
    const q = normText(busca);
    const f = filtrosProf;

    const base = (profissionais || []).filter((p: any) => {

      const uid = p.role === "Olheiro"
        ? getUserIdFromOlheiro(p)
        : getUserIdFromProfessor(p);

      if (mostrarFavoritos && !isPerfilFavorito(uid)) {
        return false;
      }

      const m = getProfMeta(p);

      if (f.papel && f.papel !== "Ambos") {
        if (m.role !== f.papel) return false;
      }

      if (f.vinculo === "Vinculado" && !m.vinculado) return false;
      if (f.vinculo === "Independente" && m.vinculado) return false;

      if (f.estado && !includesText(m.estado, f.estado)) return false;
      if (f.cidade && !includesText(m.cidade, f.cidade)) return false;

      if (q) {
        const bag = normText([p.usuario?.nome, m.role, m.cidade, m.estado].join(" "));
        if (!bag.includes(q)) return false;
      }

      return true;
    });

    return ordenarExplorar(
      base,

      ordenacaoPorAba
        .profissionais,

      (profissional) =>
        profissional.usuario
          ?.nome ??
        ""
    );
  }, [profissionais, busca, JSON.stringify(filtrosProf), mostrarFavoritos, favoritosPerfilIds, ordenacaoPorAba.profissionais]);

  const outrosFiltrados = useMemo(() => {
    const todos = [
      ...(dados.learning || []),
      ...(dados.marcas || []),
      ...(dados.federacoes || []),
    ];

    const f = filtrosOutros;
    const q = normText(busca);

    const filtrados = todos.filter((item) => {

      if (mostrarFavoritos && !isPerfilFavorito(getUserIdFromOutro(item))) {
        return false;
      }

      const nome =
        item.nome ??
        item.usuario?.nome ??
        item.usuario?.nomeDeUsuario ??
        "";

      const cidade = item.cidade ?? item.usuario?.cidade ?? "";
      const estado = item.estado ?? item.usuario?.estado ?? "";
      const tipo = item.tipoOutro;

      if (f.tipo && f.tipo !== "Todos" && tipo !== f.tipo) {
        return false;
      }

      if (f.estado && !includesText(estado, f.estado)) {
        return false;
      }

      if (f.cidade && !includesText(cidade, f.cidade)) {
        return false;
      }

      if (q) {
        const bag = normText([nome, cidade, estado, tipo].join(" "));
        if (!bag.includes(q)) return false;
      }

      return true;
    });

    return ordenarExplorar(
      filtrados,

      ordenacaoPorAba
        .outros,

      (item) =>
        item.nome ??
        item.usuario
          ?.nome ??
        item.usuario
          ?.nomeDeUsuario ??
        ""
    );
  }, [
    dados.learning,
    dados.marcas,
    dados.federacoes,
    busca,
    JSON.stringify(filtrosOutros),
    mostrarFavoritos,
    favoritosPerfilIds,
    ordenacaoPorAba.outros
  ]);

  useEffect(() => setShowCountAtletas(BATCH), [
    busca,
    filtrosKey,
    dados.atletas.length,
    mostrarFavoritos,
    favoritosPerfilIds.length,
  ]);

  useEffect(() => setShowCountEscolas(BATCH), [
    busca,
    escolasFiltradas.length,
    mostrarFavoritos,
    favoritosPerfilIds.length,
  ]);

  useEffect(() => setShowCountClubes(BATCH), [
    busca,
    clubesFiltrados.length,
    mostrarFavoritos,
    favoritosPerfilIds.length,
  ]);

  useEffect(() => setShowCountProfs(BATCH), [
    busca,
    profissionaisFiltrados.length,
    mostrarFavoritos,
    favoritosPerfilIds.length,
  ]);

  useEffect(() => setShowCountOutros(BATCH), [
    busca,
    outrosFiltrados.length,
    JSON.stringify(filtrosOutros),
    mostrarFavoritos,
    favoritosPerfilIds.length,
  ]);

  useEffect(() => {
    if (
      aba === "atletas"
    ) {
      setShowCountAtletas(
        BATCH
      );

      return;
    }

    if (
      aba === "escolas"
    ) {
      setShowCountEscolas(
        BATCH
      );

      return;
    }

    if (
      aba === "clubes"
    ) {
      setShowCountClubes(
        BATCH
      );

      return;
    }

    if (
      aba ===
      "profissionais"
    ) {
      setShowCountProfs(
        BATCH
      );

      return;
    }

    if (
      aba === "outros"
    ) {
      setShowCountOutros(
        BATCH
      );
    }
  }, [
    aba,
    ordenacaoAtual,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting) return;

        if (aba === "atletas") {
          setShowCountAtletas((c) => Math.min(c + BATCH, atletasFiltrados.length));
        } else if (aba === "escolas") {
          setShowCountEscolas((c) => Math.min(c + BATCH, escolasFiltradas.length));
        } else if (aba === "clubes") {
          setShowCountClubes((c) => Math.min(c + BATCH, clubesFiltrados.length));
        } else if (aba === "profissionais") {
          setShowCountProfs((c) => Math.min(c + BATCH, profissionaisFiltrados.length));
        } else if (aba === "outros") {
          setShowCountOutros((c) => Math.min(c + BATCH, outrosFiltrados.length));
        }
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [
    aba,
    atletasFiltrados.length,
    escolasFiltradas.length,
    clubesFiltrados.length,
    profissionaisFiltrados.length,
    outrosFiltrados.length,
    dados.escolas.length,
    dados.clubes.length,
    dados.professores.length,
    dados.olheiros.length,
    dados.atletas.length,
    atletasFiltrados.length,
    profissionais.length,
  ]);

  const loggedUserId = useMemo(
    () => (Storage?.usuarioId ?? (typeof window !== "undefined" ? Storage.usuarioId : "") ?? "") as string,
    []
  );

  const filtrarEu = useMemo(
    () =>
      <T extends { usuario?: { id?: string }; usuarioId?: string; id?: string }>(arr: T[]) =>
        arr.filter((x) => {
          const uid = (x.usuario?.id ?? x.usuarioId ?? x.id ?? "") as string;
          return uid !== loggedUserId;
        }),
    [loggedUserId]
  );

  useEffect(() => {
    const token = Storage?.token || "";
    axios
      .get(`${API.BASE_URL}/api/ranking/weekly`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then(({ data }) => {
        setTopGeral(Array.isArray(data?.geral) ? data.geral : []);
        setTopPorCategoria(typeof data?.porCategoria === "object" && data?.porCategoria ? data.porCategoria : {});
      })
      .catch(() => {
        setTopGeral([]);
        setTopPorCategoria({});
      });
  }, []);

  useEffect(() => {
    if (aba !== "atletas") return;

    const token = Storage?.token || "";
    if (!token) return;

    const visibles = atletasFiltrados
      .slice(0, showCountAtletas)
      .map((a) => getUserIdFromAtleta(a))
      .filter(Boolean);

    const missing = visibles.filter((id) => typeof pontosCache[id] !== "number");
    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
      const CHUNK = 8;
      for (let i = 0; i < missing.length; i += CHUNK) {
        if (cancelled) return;
        const slice = missing.slice(i, i + CHUNK);
        await Promise.allSettled(slice.map((id) => fetchPontuacaoTotalCorreta(id)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [aba, atletasFiltrados, showCountAtletas, pontosCache]);

  useEffect(() => {
    const token = Storage?.token ?? (typeof window !== "undefined" ? Storage.token : "");
    const params: any = { q: busca, excludeUsuarioId: loggedUserId };

    setCarregandoDados(true);
    axios
      .get(`${API.BASE_URL}/api/explorar`, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then(({ data }) => {
        setDados({
          atletas: filtrarEu<AtletaItem>(data.atletas || []),
          professores: filtrarEu<ProfessorItem>(data.professores || []),
          olheiros: filtrarEu<OlheiroItem>(data.olheiros || []),
          clubes: filtrarEu<ClubeItem>(
            (data.clubes || []).map((c: any) => ({
              ...c,
              nome: c.nome ?? c.usuario?.nome ?? "",
              usuarioId: c.usuarioId ?? c.usuario?.id,
              logo: c.logo ?? c.usuario?.foto ?? c.logo,
              cidade: c.cidade ?? c.usuario?.cidade ?? null,
              estado: c.estado ?? c.usuario?.estado ?? null,
              usuario: c.usuario ?? undefined,
            }))
          ),
          escolas: filtrarEu<EscolaItem>(
            (data.escolas || []).map((e: any) => ({
              ...e,
              nome: e.nome ?? e.usuario?.nome ?? "",
              usuarioId: e.usuarioId ?? e.usuario?.id,
              logo: e.logo ?? e.usuario?.foto ?? e.logo,
              cidade: e.cidade ?? e.usuario?.cidade ?? null,
              estado: e.estado ?? e.usuario?.estado ?? null,
              usuario: e.usuario ?? undefined,
            }))
          ),
          eventos: (data.eventos || []) as EventoItem[],
          federacoes: filtrarEu<OutroItem>(
            (data.federacoes || []).map((f: any) => ({
              ...f,
              tipoOutro: "Federacao",
              nome: f.nome ?? f.usuario?.nome ?? "",
              usuarioId: f.usuarioId ?? f.usuario?.id,
              logo: f.logo ?? f.usuario?.foto ?? null,
              cidade: f.cidade ?? f.usuario?.cidade ?? null,
              estado: f.estado ?? f.usuario?.estado ?? null,
              usuario: f.usuario ?? undefined,
            }))
          ),

          marcas: filtrarEu<OutroItem>(
            (data.marcas || []).map((m: any) => ({
              ...m,
              tipoOutro: "Marca",
              nome: m.nome ?? m.usuario?.nome ?? "",
              usuarioId: m.usuarioId ?? m.usuario?.id,
              logo: m.logo ?? m.usuario?.foto ?? null,
              cidade: m.cidade ?? m.usuario?.cidade ?? null,
              estado: m.estado ?? m.usuario?.estado ?? null,
              usuario: m.usuario ?? undefined,
            }))
          ),

          learning: filtrarEu<OutroItem>(
            (data.learning || []).map((l: any) => ({
              ...l,
              tipoOutro: "Learning",
              nome: l.usuario?.nome ?? l.usuario?.nomeDeUsuario ?? "Learning",
              usuarioId: l.usuarioId ?? l.usuario?.id,
              logo: l.usuario?.foto ?? null,
              cidade: l.usuario?.cidade ?? null,
              estado: l.usuario?.estado ?? null,
              usuario: l.usuario ?? undefined,
            }))
          ),
        });
      })
      .catch(() => {
        setDados({ atletas: [], professores: [], olheiros: [], clubes: [], escolas: [], eventos: [], federacoes: [], marcas: [], learning: [] });
      })
      .finally(() => setCarregandoDados(false));
  }, [busca, loggedUserId, filtrarEu]);

  const abrirFiltros = () => {
    if (aba === "atletas") setDraft(filtros);
    else if (aba === "profissionais") setDraftProf(filtrosProf);
    else if (aba === "escolas" || aba === "clubes") setDraftOrgs(filtrosOrgs);
    else if (aba === "outros") setDraftOutros(filtrosOutros);

    setShowFilters(true);
  };

  const aplicarFiltros = () => {
    if (aba === "atletas") setFiltros(draft);
    else if (aba === "profissionais") setFiltrosProf(draftProf);
    else if (aba === "escolas" || aba === "clubes") setFiltrosOrgs(draftOrgs);
    else if (aba === "outros") setFiltrosOutros(draftOutros);

    setShowFilters(false);
  };

  const limparFiltros = () => {
    if (aba === "atletas") {
      const base: Filtros = {
        independente: null,
        pontuacaoMin: null,
        pontuacaoMax: null,
        posicoes: [],
      };
      setDraft(base);
      setFiltros(base);
    } else if (aba === "profissionais") {
      const base: FiltrosProfissionais = {
        papel: "Ambos",
        vinculo: "Qualquer",
        cidade: "",
        estado: "",
      };
      setDraftProf(base);
      setFiltrosProf(base);
    } else if (aba === "escolas" || aba === "clubes") {
      const base: FiltrosOrgs = {
        cidade: "",
        estado: "",
        temSite: null,
      };
      setDraftOrgs(base);
      setFiltrosOrgs(base);
    } else if (aba === "outros") {
      const base: FiltrosOutros = {
        tipo: "Todos",
        cidade: "",
        estado: "",
      };
      setDraftOutros(base);
      setFiltrosOutros(base);
    }

    setShowFilters(false);
  };

  const hasMoreEscolas = showCountEscolas < escolasFiltradas.length;
  const hasMoreClubes = showCountClubes < clubesFiltrados.length;
  
  const activeFiltersCount = useMemo(() => {
    if (aba === "atletas") {
      return (
        (filtros.categoria ? 1 : 0) +
        (filtros.posicoes && filtros.posicoes.length ? 1 : 0) +
        (filtros.estado ? 1 : 0) +
        (filtros.cidade ? 1 : 0) +
        (filtros.independente !== null && filtros.independente !== undefined ? 1 : 0) +
        (typeof filtros.pontuacaoMin === "number" ? 1 : 0) +
        (typeof filtros.pontuacaoMax === "number" ? 1 : 0)
      );
    }

    if (aba === "profissionais") {
      return (
        (filtrosProf.papel && filtrosProf.papel !== "Ambos" ? 1 : 0) +
        (filtrosProf.vinculo && filtrosProf.vinculo !== "Qualquer" ? 1 : 0) +
        (filtrosProf.estado ? 1 : 0) +
        (filtrosProf.cidade ? 1 : 0)
      );
    }

    if (aba === "escolas") {
      return (
        (filtrosOrgs.estado ? 1 : 0) +
        (filtrosOrgs.cidade ? 1 : 0) +
        (filtrosOrgs.temSite !== null && filtrosOrgs.temSite !== undefined ? 1 : 0)
      );
    }

    if (aba === "clubes") {
      return (filtrosOrgs.estado ? 1 : 0) + (filtrosOrgs.cidade ? 1 : 0);
    }

    if (aba === "outros") {
      return (
        (filtrosOutros.tipo && filtrosOutros.tipo !== "Todos" ? 1 : 0) +
        (filtrosOutros.estado ? 1 : 0) +
        (filtrosOutros.cidade ? 1 : 0)
      );
    }

    return 0;
  }, [aba, filtros, filtrosProf, filtrosOrgs, filtrosOutros]);

  const rawLogoOrg = selectedEvento?.clube?.logo || (selectedEvento as any)?.escolinha?.logo || null;

  const favoritosNaAbaAtual = useMemo(() => {
    if (aba === "atletas") {
      return (dados.atletas || []).filter((a) =>
        isPerfilFavorito(getUserIdFromAtleta(a))
      ).length;
    }

    if (aba === "escolas") {
      return (dados.escolas || []).filter((e) =>
        isPerfilFavorito(getUserIdFromEscola(e))
      ).length;
    }

    if (aba === "clubes") {
      return (dados.clubes || []).filter((c) =>
        isPerfilFavorito(getUserIdFromClube(c))
      ).length;
    }

    if (aba === "profissionais") {
      return (profissionais || []).filter((p: any) => {
        const uid =
          p.role === "Olheiro"
            ? getUserIdFromOlheiro(p)
            : getUserIdFromProfessor(p);

        return isPerfilFavorito(uid);
      }).length;
    }

    if (aba === "outros") {
      const todos = [
        ...(dados.learning || []),
        ...(dados.marcas || []),
        ...(dados.federacoes || []),
      ];

      return todos.filter((item) => isPerfilFavorito(getUserIdFromOutro(item))).length;
    }

    return 0;
  }, [
    aba,
    dados.atletas,
    dados.escolas,
    dados.clubes,
    dados.learning,
    dados.marcas,
    dados.federacoes,
    profissionais,
    favoritosPerfilIds,
  ]);

  return (
    <div className="min-h-screen bg-[#FEFBE9] text-green-900 pb-28 sm:pb-24">
      <div className="h-16 sm:h-20 bg-green-900 text-white flex items-center">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-5">
          <h1 className="text-lg sm:text-xl font-extrabold tracking-wide text-center">Explorar</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 mt-3 sm:mt-4">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-800/70" />
            <input
              type="text"
              value={busca}
              data-testid="explorar-search"
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, posição, cidade..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border outline-none focus:ring-2 ring-emerald-100 bg-white text-sm sm:text-base"
            />
          </div>

          <button
            type="button"
            onClick={() => setMostrarFavoritos((prev) => !prev)}
            className={`relative shrink-0 px-3 py-2 rounded-xl border inline-flex items-center gap-2 text-sm font-semibold ${
              mostrarFavoritos
                ? "bg-amber-50 text-amber-700 border-amber-300"
                : "bg-white text-green-800 border-green-200 hover:bg-emerald-50"
            }`}
            title={
              mostrarFavoritos
                ? "Mostrar todos os perfis"
                : "Mostrar somente perfis favoritos"
            }
          >
            <Star
              size={16}
              fill={mostrarFavoritos ? "currentColor" : "none"}
            />

            <span className="hidden sm:inline">
              {mostrarFavoritos ? "Favoritos" : "Favoritos"}
            </span>

            {favoritosNaAbaAtual > 0 && (
              <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[11px] border border-amber-200">
                {favoritosNaAbaAtual}
              </span>
            )}
          </button>

          {aba !== "eventos" && (
            <>
              <button
                onClick={abrirFiltros}
                className="sm:hidden relative p-2 rounded-xl border bg-white hover:bg-emerald-50"
                aria-label="Abrir filtros"
              >
                <Filter size={18} />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-green-800 text-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <button
                onClick={abrirFiltros}
                className="hidden sm:flex px-3 py-2 rounded-xl border bg-white items-center gap-2 text-sm hover:bg-emerald-50"
                title="Filtros"
              >
                <Filter size={16} /> Filtros
                {activeFiltersCount > 0 && (
                  <Pill tone="emerald" className="ml-1">
                    {activeFiltersCount}
                  </Pill>
                )}
              </button>
            </>
          )}
        </div>

        <div className="mt-3 sm:mt-4">
          <div className="-mx-4 px-4 sm:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Tab active={aba === "atletas"} onClick={() => setAba("atletas")} icon={<Trophy className="h-4 w-4" />} className="min-w-[110px]">
                Atletas
              </Tab>
              <Tab active={aba === "escolas"} onClick={() => setAba("escolas")} icon={<School className="h-4 w-4" />} className="min-w-[110px]">
                Escolas
              </Tab>
              <Tab active={aba === "clubes"} onClick={() => setAba("clubes")} icon={<Building2 className="h-4 w-4" />} className="min-w-[110px]">
                Clubes
              </Tab>
              <Tab
                active={aba === "profissionais"}
                onClick={() => setAba("profissionais")}
                icon={<User className="h-4 w-4" />}
                className="min-w-[130px]"
              >
                Profissionais
              </Tab>
              <Tab
                active={aba === "outros"}
                onClick={() => setAba("outros")}
                icon={<Users className="w-4 h-4" />}
                className="min-w-[100px]" 
              >
                Outros
              </Tab>
              {ENABLE_EVENTOS_TAB && (
                <Tab
                  active={aba === "eventos"}
                  onClick={() => setAba("eventos")}
                  icon={<CalendarClock className="h-4 w-4" />}
                  className="min-w-[120px]"
                >
                  Eventos
                </Tab>
              )}

            </div>
          </div>

          <div
            className={`hidden sm:grid sm:gap-2 ${
              ENABLE_EVENTOS_TAB ? "sm:grid-cols-6" : "sm:grid-cols-5"
            }`}
          >
            <Tab active={aba === "atletas"} onClick={() => setAba("atletas")} icon={<Trophy className="h-4 w-4" />}>
              Atletas
            </Tab>

            <Tab active={aba === "escolas"} onClick={() => setAba("escolas")} icon={<School className="h-4 w-4" />}>
              Escolas
            </Tab>

            <Tab active={aba === "clubes"} onClick={() => setAba("clubes")} icon={<Building2 className="h-4 w-4" />}>
              Clubes
            </Tab>

            <Tab active={aba === "profissionais"} onClick={() => setAba("profissionais")} icon={<User className="h-4 w-4" />}>
              Profissionais
            </Tab>

            <Tab active={aba === "outros"} onClick={() => setAba("outros")} icon={<Users className="h-4 w-4" />}>
              Outros
            </Tab>

            {ENABLE_EVENTOS_TAB && (
              <Tab active={aba === "eventos"} onClick={() => setAba("eventos")} icon={<CalendarClock className="h-4 w-4" />}>
                Eventos
              </Tab>
            )}
          </div>
            {abaOrdenavel && (
              <div className="mt-3 flex justify-end">
                <label
                  className="
                    flex w-full
                    items-center gap-2
                    sm:w-auto
                  "
                >
                  <span
                    className="
                      hidden text-sm
                      font-medium
                      text-green-900/80
                      sm:inline
                    "
                  >
                    Ordenar:
                  </span>

                  <select
                    value={
                      ordenacaoAtual
                    }
                    onChange={(evento) =>
                      alterarOrdenacao(
                        evento.target
                          .value as
                          OrdenacaoExplorar
                      )
                    }
                    className="
                      w-full rounded-xl
                      border border-green-200
                      bg-white px-3 py-2
                      text-sm text-green-900
                      outline-none
                      focus:ring-2
                      focus:ring-green-100
                      sm:w-auto
                      sm:min-w-[250px]
                    "
                  >
                    <option value="nome_asc">
                      Destaques primeiro • Nome A-Z
                    </option>

                    <option value="nome_desc">
                      Destaques primeiro • Nome Z-A
                    </option>

                    <option value="recentes">
                      Destaques primeiro • Mais recentes
                    </option>

                    <option value="antigos">
                      Destaques primeiro • Mais antigos
                    </option>

                    {aba ===
                      "atletas" && (
                      <>
                        <option value="pontuacao_desc">
                          Destaques primeiro • Maior pontuação
                        </option>

                        <option value="pontuacao_asc">
                          Destaques primeiro • Menor pontuação
                        </option>
                      </>
                    )}
                  </select>
                </label>
              </div>
            )}
        </div>
       </div>

      {showFilters && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div
            className="absolute inset-0"
            onClick={() => setShowFilters(false)}
          />

          <div
            className="relative z-50 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-green-900">
                Filtros
              </h2>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Fechar filtros"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {aba === "atletas" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Categoria
                    </label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={draft.categoria ?? ""}
                      onChange={(e) => updateDraft({ categoria: e.target.value || undefined })}
                    >
                      <option value="">Todas</option>
                      {CATEGORIAS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Posição
                    </label>

                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const atuais = draft.posicoes || [];
                        if (!atuais.includes(v)) updateDraft({ posicoes: [...atuais, v] });
                        e.target.value = "";
                      }}
                    >
                      <option value="">Selecione uma posição...</option>
                      {POSICOES.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>

                    {draft.posicoes && draft.posicoes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {draft.posicoes.map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() =>
                              updateDraft({ posicoes: (draft.posicoes || []).filter((p) => p !== pos) })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] bg-emerald-50 border-emerald-200 text-emerald-800"
                          >
                            {pos}
                            <span className="text-[10px]">✕</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Estado
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: SP, RJ..."
                        value={draft.estado ?? ""}
                        onChange={(e) => updateDraft({ estado: e.target.value || undefined })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: São Paulo"
                        value={draft.cidade ?? ""}
                        onChange={(e) => updateDraft({ cidade: e.target.value || undefined })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Vínculo do Atleta
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ independente: null })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs ${
                          draft.independente === null || draft.independente === undefined
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        Qualquer
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ independente: true })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs ${
                          draft.independente === true
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        Independente
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft({ independente: false })}
                        className={`flex-1 px-3 py-2 rounded-lg border text-xs ${
                          draft.independente === false
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        Vinculado
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Pontuação
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] text-gray-600 mb-1">Mínima</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          value={draft.pontuacaoMin ?? ""}
                          onChange={(e) =>
                            updateDraft({ pontuacaoMin: e.target.value ? Number(e.target.value) : null })
                          }
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-gray-600 mb-1">Máxima</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          value={draft.pontuacaoMax ?? ""}
                          onChange={(e) =>
                            updateDraft({ pontuacaoMax: e.target.value ? Number(e.target.value) : null })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {aba === "profissionais" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tipo
                    </label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={draftProf.papel ?? "Ambos"}
                      onChange={(e) =>
                        setDraftProf((p) => ({ ...p, papel: e.target.value as any }))
                      }
                    >
                      <option value="Ambos">Todos</option>
                      <option value="Professor">Professores</option>
                      <option value="Olheiro">Olheiros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Vínculo
                    </label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={draftProf.vinculo ?? "Qualquer"}
                      onChange={(e) =>
                        setDraftProf((p) => ({ ...p, vinculo: e.target.value as any }))
                      }
                    >
                      <option value="Qualquer">Qualquer</option>
                      <option value="Independente">Independente</option>
                      <option value="Vinculado">Vinculado</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Estado
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: SP"
                        value={draftProf.estado ?? ""}
                        onChange={(e) =>
                          setDraftProf((p) => ({ ...p, estado: e.target.value || undefined }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: São Paulo"
                        value={draftProf.cidade ?? ""}
                        onChange={(e) =>
                          setDraftProf((p) => ({ ...p, cidade: e.target.value || undefined }))
                        }
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-600">
                    * O filtro “vínculo” só funciona se o backend enviar clubeId/escolinhaId.
                    Se não enviar, deixe em “Qualquer”.
                  </div>
                </>
              )}

              {(aba === "escolas" || aba === "clubes") && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Estado
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: SP"
                        value={draftOrgs.estado ?? ""}
                        onChange={(e) =>
                          setDraftOrgs((p) => ({ ...p, estado: e.target.value || undefined }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: São Paulo"
                        value={draftOrgs.cidade ?? ""}
                        onChange={(e) =>
                          setDraftOrgs((p) => ({ ...p, cidade: e.target.value || undefined }))
                        }
                      />
                    </div>
                  </div>

                  {aba === "escolas" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Site
                      </label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={
                          draftOrgs.temSite === null || draftOrgs.temSite === undefined
                            ? ""
                            : draftOrgs.temSite
                            ? "sim"
                            : "nao"
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftOrgs((p) => ({
                            ...p,
                            temSite: v === "" ? null : v === "sim",
                          }));
                        }}
                      >
                        <option value="">Qualquer</option>
                        <option value="sim">Com site</option>
                        <option value="nao">Sem site</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {aba === "outros" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Tipo
                    </label>

                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={draftOutros.tipo ?? "Todos"}
                      onChange={(e) =>
                        updateDraftOutros({
                          tipo: e.target.value as FiltrosOutros["tipo"],
                        })
                      }
                    >
                      <option value="Todos">Todos</option>
                      <option value="Learning">Learning</option>
                      <option value="Marca">Marca</option>
                      <option value="Federacao">Federação</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Estado
                      </label>

                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: SP"
                        value={draftOutros.estado ?? ""}
                        onChange={(e) =>
                          updateDraftOutros({
                            estado: e.target.value || undefined,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Cidade
                      </label>

                      <input
                        type="text"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="Ex: São Paulo"
                        value={draftOutros.cidade ?? ""}
                        onChange={(e) =>
                          updateDraftOutros({
                            cidade: e.target.value || undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={limparFiltros}
                className="flex-1 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={aplicarFiltros}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-5 mt-3 sm:mt-4">
        {aba === "atletas" && (
          <>
            <h2 className="text-base sm:text-lg font-bold mb-2">Atletas</h2>

            {carregandoDados && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm animate-pulse">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-gray-200" />
                    <div className="h-3 bg-gray-200 rounded mt-3" />
                    <div className="h-3 bg-gray-200 rounded mt-2 w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {!carregandoDados && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {atletasFiltrados.slice(0, showCountAtletas).map((a) => {
                    const rawFoto = a.foto ?? a.usuario?.foto;
                    const nome = a?.usuario?.nome ?? "profile";
                    const meta = getAtletaMeta(a);
                    const categoria = meta.categoria;
                    const uid = a?.usuario?.id ?? a?.usuarioId ?? a.id;
                    return (
                      <Link href={`/perfil/${uid}`} key={`${a.id}-${uid}`}>
                        <div className="bg-white rounded-xl shadow-sm p-3 hover:shadow transition flex flex-col items-center">
                          <div className="relative">
                            <Avatar
                              foto={rawFoto}
                              alt={`${nome} profile`}
                              className="w-20 h-20 sm:w-24 sm:h-24 border"
                            />
                            {shouldShowProBadgeOnAvatar(a) && (
                              <span className="absolute -top-1 -right-1 text-[10px] px-2 py-1 rounded-full bg-emerald-800 text-white font-extrabold shadow ring-2 ring-white">
                                PRO
                              </span>
                            )}

                          </div>

                          <p className="mt-2 font-medium text-center line-clamp-2 text-sm sm:text-base">
                            {nome}
                          </p>

                          <ProfileStatusBadges
                            item={a}
                          />

                          <div className="mt-1 flex flex-wrap gap-1 justify-center">
                            {categoria && (
                              <Pill tone="emerald">
                                <Shield className="h-3.5 w-3.5" /> {categoria}
                              </Pill>
                            )}
                            {meta.posicao && (
                              <Pill tone="sky">
                                <Goal className="h-3.5 w-3.5" /> {meta.posicao}
                              </Pill>
                            )}

                            {(meta.cidade || meta.estado) && (
                              <Pill tone="gray">
                                <MapPin className="h-3.5 w-3.5" /> {meta.cidade ?? ""} {meta.estado ? `, ${meta.estado}` : ""}
                              </Pill>
                            )}

                            {typeof meta.pontuacao === "number" && (
                              <Pill tone="amber">
                                <Heart className="h-3.5 w-3.5" /> {meta.pontuacao}
                              </Pill>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <h2 className="text-base sm:text-lg font-bold mt-6 mb-2">Top da semana (geral)</h2>
                  {topGeral.length === 0 ? (
                    <p className="text-gray-600 mb-4">Sem dados desta semana.</p>
                  ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                    {topGeral.slice(0, 10).map((r, idx) => {
                      const foto = r.usuario?.foto;
                      return (
                        <Link href={`/perfil/${r.usuario.id}`} key={r.atletaId}>
                          <div className="min-w-[130px] sm:min-w-[150px] bg-white rounded-xl shadow-sm p-3 flex flex-col items-center hover:shadow transition">
                            <div className="text-xs font-semibold mb-1">{idx + 1}º</div>
                            <Avatar
                              foto={foto}
                              alt={r.usuario.nome}
                              className="w-14 h-14 sm:w-16 sm:h-16 border"
                            />
                            <div className="mt-2 text-sm text-center line-clamp-2">{r.usuario.nome}</div>
                            <div className="text-xs mt-1">❤️ {r.total}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                <h3 className="text-base font-bold mt-4 mb-2">Líderes por categoria</h3>
                <div className="space-y-2 mb-4">
                  {Object.entries(topPorCategoria).map(([cat, lista]) => {
                    const top = (lista as RankItem[])[0];
                    if (!top) return null;
                    const foto = top.usuario?.foto;
                    const rotulo = CAT_LABEL[cat] ?? cat;
                    return (
                      <Link href={`/perfil/${top.usuario.id}`} key={`cat-${cat}`}>
                        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow transition">
                          <div className="text-xs sm:text-sm font-bold w-20 sm:w-24">{rotulo}</div>
                          <Avatar
                            foto={foto}
                            alt={top.usuario.nome}
                            className="w-9 h-9 sm:w-10 sm:h-10 border"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{top.usuario.nome}</div>
                            <div className="text-xs text-gray-600">❤️ {top.total}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {aba === "escolas" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">Escolas de Futebol</h2>
            <div className="space-y-3">
              {escolasFiltradas.slice(0, showCountEscolas).map((e) => {
                const rawLogo = e.logo;
                const href = e.usuarioId ? `/perfil/${e.usuarioId}` : undefined;
                const Card = (
                  <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow transition cursor-pointer">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border bg-white flex items-center justify-center overflow-hidden">
                        <Avatar
                          foto={rawLogo}
                          alt="Logo da escola"
                          className="w-full h-full"
                        />
                      </div>

                      {shouldShowProBadgeOnAvatar(e) && (
                        <span className="absolute -top-1 -right-1 text-[10px] px-2 py-1 rounded-full bg-emerald-800 text-white font-extrabold shadow ring-2 ring-white">
                          PRO
                        </span>
                      )}

                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{e.nome}</h3>

                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.cidade ?? "Cidade"}
                        {e.estado ? `, ${e.estado}` : ""}
                      </p>

                      <p className="text-xs text-gray-600 truncate">
                        {e.siteOficial || "Site indisponível"}
                      </p>

                      <ProfileStatusBadges
                        item={e}
                        align="start"
                      />
                    </div>
                  </div>
                );
                return href ? (
                  <Link href={href} key={e.id}>
                    {Card}
                  </Link>
                ) : (
                  <div key={e.id}>{Card}</div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-col items-center">
              {hasMoreEscolas && (
                <button
                  onClick={() => setShowCountEscolas((c) => Math.min(c + BATCH, escolasFiltradas.length))}
                  className="mt-2 px-4 py-2 rounded-xl border bg-white text-sm hover:bg-emerald-50"
                >
                  Carregar mais
                </button>
              )}
              <div ref={sentinelRef} className="h-1 w-full" />
              {!hasMoreEscolas && dados.escolas.length > 0 && (
                <div className="text-xs text-gray-500 mt-2"></div>
              )}
              {escolasFiltradas.length === 0 && !carregandoDados && (
                <div className="text-sm text-gray-600 mt-2">
                  {mostrarFavoritos
                    ? "Nenhuma escola favorita encontrada."
                    : "Nenhuma escola encontrada"}
                </div>
              )}
            </div>
          </>
        )}

        {aba === "clubes" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">Clubes</h2>
            <div className="space-y-3">
              {clubesFiltrados.slice(0, showCountClubes).map((c) => {
                const rawLogo = c.logo;
                const href = c.usuarioId ? `/perfil/${c.usuarioId}` : undefined;
                const Card = (
                  <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow transition cursor-pointer">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border bg-white flex items-center justify-center overflow-hidden">
                        <Avatar
                          foto={rawLogo}
                          alt="Logo do clube"
                          className="w-full h-full"
                        />
                      </div>

                      {shouldShowProBadgeOnAvatar(c) && (
                        <span className="absolute -top-1 -right-1 text-[10px] px-2 py-1 rounded-full bg-emerald-800 text-white font-extrabold shadow ring-2 ring-white">
                          PRO
                        </span>
                      )}

                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{c.nome}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.cidade ?? "Cidade"}
                        {c.estado ? `, ${c.estado}` : ""}
                      </p>

                      <p className="text-xs text-gray-600">Clube Profissional</p>

                      <ProfileStatusBadges
                        item={c}
                        align="start"
                      />
                    </div>
                  </div>
                );
                return href ? (
                  <Link href={href} key={c.id}>
                    {Card}
                  </Link>
                ) : (
                  <div key={c.id}>{Card}</div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-col items-center">
              {hasMoreClubes && (
                <button
                  onClick={() => setShowCountClubes((c) => Math.min(c + BATCH, clubesFiltrados.length))}
                  className="mt-2 px-4 py-2 rounded-xl border bg-white text-sm hover:bg-emerald-50"
                >
                  Carregar mais
                </button>
              )}
              <div ref={sentinelRef} className="h-1 w-full" />
              {!hasMoreClubes && dados.clubes.length > 0 && (
                <div className="text-xs text-gray-500 mt-2"></div>
              )}
              {clubesFiltrados.length === 0 && !carregandoDados && (
                <div className="text-sm text-gray-600 mt-2">
                  {mostrarFavoritos
                    ? "Nenhum clube favorito encontrado."
                    : "Nenhum clube encontrado"}
                </div>
              )}
            </div>
          </>
        )}

        {aba === "profissionais" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">Professores e Olheiros</h2>
            {profissionaisFiltrados.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {profissionaisFiltrados.slice(0, showCountProfs).map((p) => {
                  const rawFoto = p.foto ?? p.usuario?.foto;
                  const uid = p.usuario.id;
                  const href = p.role === "Olheiro" ? `/perfil-olheiro/${uid}` : `/perfil/${uid}`;

                  return (
                    <Link href={href} key={`${p.role}-${p.id}`}>
                      <div className="bg-white rounded-xl shadow-sm p-3 hover:shadow transition flex flex-col items-center">
                        <div className="relative">
                          <Avatar
                            foto={rawFoto}
                            alt="Foto do usuário"
                            className="w-20 h-20 sm:w-24 sm:h-24 border"
                          />
                          {shouldShowProBadgeOnAvatar(p) && (
                            <span className="absolute -top-1 -right-1 text-[10px] px-2 py-1 rounded-full bg-emerald-800 text-white font-extrabold shadow ring-2 ring-white">
                              PRO
                            </span>
                          )}

                        </div>

                        <p className="mt-2 font-medium text-center line-clamp-2 text-sm sm:text-base">
                          {p.usuario.nome}
                        </p>

                        <ProfileStatusBadges
                          item={p}
                        />

                        {(() => {
                          const cidade = p.usuario?.cidade ?? "";
                          const estado = p.usuario?.estado ?? "";
                          const temLocal = !!(cidade || estado);
                          if (!temLocal) return null;

                          return (
                            <p className="mt-1 text-sm text-gray-600 flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {cidade}
                              {estado ? `, ${estado}` : ""}
                            </p>
                          );
                        })()}

                        <Pill
                          tone={
                            p.role === "Professor"
                              ? "sky"
                              : "rose"
                          }
                          className="mt-1"
                        >
                          {p.role}
                        </Pill>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-600">
                {mostrarFavoritos
                  ? "Nenhum profissional favorito encontrado."
                  : "Nenhum profissional encontrado."}
              </p>
            )}

          </>
        )}

        {aba === "outros" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">
              Outros perfis
            </h2>

            {outrosFiltrados.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {outrosFiltrados.slice(0, showCountOutros).map((item) => {
                  const rawFoto = item.logo ?? item.foto ?? item.usuario?.foto;
                  const uid = item.usuario?.id ?? item.usuarioId ?? item.id;

                  const nome =
                    item.nome ??
                    item.usuario?.nome ??
                    item.usuario?.nomeDeUsuario ??
                    "Perfil";

                  const cidade = item.cidade ?? item.usuario?.cidade ?? "";
                  const estado = item.estado ?? item.usuario?.estado ?? "";

                  const labelTipo =
                    item.tipoOutro === "Federacao"
                      ? "Federação"
                      : item.tipoOutro === "Marca"
                      ? "Marca"
                      : "Learning";

                  const pillTone =
                    item.tipoOutro === "Learning"
                      ? "sky"
                      : item.tipoOutro === "Marca"
                      ? "amber"
                      : "emerald";

                  return (
                    <Link href={`/perfil/${uid}`} key={`${item.tipoOutro}-${item.id}`}>
                      <div className="bg-white rounded-xl shadow-sm p-3 hover:shadow transition flex flex-col items-center">
                        <div className="relative">
                          <Avatar
                            foto={rawFoto}
                            alt="Foto do usuário"
                            className="w-20 h-20 sm:w-24 sm:h-24 border"
                          />

                          {shouldShowProBadgeOnAvatar(item) && (
                            <span className="absolute -top-1 -right-1 text-[10px] px-2 py-1 rounded-full bg-emerald-800 text-white font-extrabold shadow ring-2 ring-white">
                              PRO
                            </span>
                          )}
                        </div>

                        <p className="mt-2 font-medium text-center line-clamp-2 text-sm sm:text-base">
                          {nome}
                        </p>

                        <ProfileStatusBadges
                          item={item}
                        />

                        {(cidade || estado) && (
                          <p className="mt-1 text-xs text-gray-600 flex items-center gap-1 text-center">
                            <MapPin className="h-3.5 w-3.5" />
                            {[cidade, estado].filter(Boolean).join(", ")}
                          </p>
                        )}

                        <Pill tone={pillTone as any} className="mt-2">
                          {labelTipo}
                        </Pill>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-600 mt-2">
                {mostrarFavoritos
                  ? "Nenhum perfil favorito encontrado em Outros."
                  : "Nenhum perfil encontrado em Outros."}
              </div>
            )}

            <div className="mt-3 flex flex-col items-center">
              {showCountOutros < outrosFiltrados.length && (
                <button
                  onClick={() =>
                    setShowCountOutros((c) =>
                      Math.min(c + BATCH, outrosFiltrados.length)
                    )
                  }
                  className="mt-2 px-4 py-2 rounded-xl border bg-white text-sm hover:bg-emerald-50"
                >
                  Carregar mais
                </button>
              )}

              <div ref={sentinelRef} className="h-1 w-full" />
            </div>
          </>
        )}

        {ENABLE_EVENTOS_TAB && aba === "eventos" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">Eventos e Peneiras</h2>

            {eventosFiltrados.length === 0 && !carregandoDados && (
              <p className="text-sm text-gray-600">Nenhum evento encontrado no momento.</p>
            )}

            {carregandoDados && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3 mt-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mt-4" />
                  </div>
                ))}
              </div>
            )}

            {!carregandoDados && eventosFiltrados.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {eventosFiltrados.map((ev) => {
                  const dataLabel = formatDateRange(ev.inicio, ev.fim);
                  const localLabel =
                    ev.local || ev.cidade || ev.estado
                      ? `${ev.local ? ev.local + " • " : ""}${ev.cidade ?? ""}${ev.estado ? ` - ${ev.estado}` : ""}`
                      : "Local a definir";

                      
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setSelectedEvento(ev);
                        setShowEventoModal(true);
                        setErroEvento(null);
                      }}
                      className="text-left bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{ev.titulo}</h3>
                            {(ev.clube || (ev as any).escolinha) && (
                              <p className="text-xs text-gray-600">
                                Organizado por {ev.clube?.nome || (ev as any).escolinha?.nome}
                              </p>
                            )}
                          <p className="mt-1 text-xs text-gray-600">{dataLabel}</p>
                        </div>
                        <Pill tone={ev.tipo === "PENEIRA" ? "amber" : "emerald"} className="shrink-0">
                          {ev.tipo === "PENEIRA" ? "Peneira" : "Evento"}
                        </Pill>
                      </div>

                      <p className="text-xs text-gray-700 line-clamp-3">
                        {ev.descricao || "Sem descrição detalhada."}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-gray-700">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {dataLabel}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {localLabel}
                        </span>
                        {typeof ev.totalInscritos === "number" && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {ev.totalInscritos} inscritos
                          </span>
                        )}
                      </div>

                      {ev.inscrito && (
                        <Pill tone="emerald" className="mt-1">
                          <Ticket className="h-3 w-3" /> Você está inscrito
                        </Pill>
                      )}
                      {ev.convidado && !ev.inscrito && (
                        <Pill tone="sky" className="mt-1">
                          Convite recebido
                        </Pill>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {showEventoModal && selectedEvento && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40">
          <div className="absolute inset-0" onClick={() => setShowEventoModal(false)} />

          <div
            className="relative z-50 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-green-900">
                  {selectedEvento.titulo}
                </h2>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pill tone={selectedEvento.tipo === "PENEIRA" ? "amber" : "emerald"}>
                    {selectedEvento.tipo === "PENEIRA" ? "Peneira" : "Evento"}
                  </Pill>
                  <Pill tone="gray">
                    {formatDateRange(selectedEvento.inicio, selectedEvento.fim)}
                  </Pill>
                  {selectedEvento.status !== "ABERTO" && (
                    <Pill tone="rose">
                      {selectedEvento.status === "ENCERRADO" ? "Encerrado" : "Cancelado"}
                    </Pill>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowEventoModal(false)}
                className="p-1 rounded-full hover:bg-gray-100"
                aria-label="Fechar detalhes do evento"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(selectedEvento.clube || (selectedEvento as any).escolinha) && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full border bg-white flex items-center justify-center overflow-hidden">
                  <Avatar
                    foto={rawLogoOrg}
                    alt="Logo do organizador"
                    className="w-full h-full"
                  />
                </div>
                <div className="text-xs text-gray-700">
                  <div className="font-semibold">
                    Organizado por{" "}
                    {selectedEvento.clube?.nome || (selectedEvento as any).escolinha?.nome}
                  </div>
                </div>
              </div>
            )}


            <div className="space-y-3 text-sm text-gray-800">
              {selectedEvento.descricao && (
                <p className="whitespace-pre-line">{selectedEvento.descricao}</p>
              )}

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-green-800" />
                <div>
                  <div>{selectedEvento.local || "Local a definir"}</div>
                  {(selectedEvento.cidade || selectedEvento.estado || selectedEvento.pais) && (
                    <div className="text-xs text-gray-600">
                      {[selectedEvento.cidade, selectedEvento.estado, selectedEvento.pais]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}
                  {selectedEvento.endereco && (
                    <div className="text-xs text-gray-600 mt-0.5">{selectedEvento.endereco}</div>
                  )}
                </div>
              </div>

              {typeof selectedEvento.vagas === "number" && (
                <div className="text-xs text-gray-700">
                  Vagas: {selectedEvento.vagas}
                  {typeof selectedEvento.totalInscritos === "number" && (
                    <> • {selectedEvento.totalInscritos} já inscritos</>
                  )}
                </div>
              )}

              {selectedEvento.valorInscricao && (
                <div className="text-xs text-gray-700">
                  Taxa de inscrição: R$ {selectedEvento.valorInscricao}
                </div>
              )}

              {selectedEvento.requisitos && selectedEvento.requisitos.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-1">Requisitos:</div>
                  <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                    {selectedEvento.requisitos.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {erroEvento && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
                  {erroEvento}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {selectedEvento.linkInscricao && (
                <a
                  href={selectedEvento.linkInscricao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2 rounded-lg border text-sm font-medium text-green-800 hover:bg-emerald-50"
                >
                  Ver página do evento
                </a>
              )}

              <button
                type="button"
                disabled={
                  selectedEvento.status !== "ABERTO" ||
                  selectedEvento.inscrito ||
                  inscrevendoEvento
                }
                onClick={async () => {
                  if (!selectedEvento) return;
                  const token = Storage?.token || "";

                  if (!token) {
                    setErroEvento("Faça login para se inscrever no evento.");
                    return;
                  }

                  try {
                    setInscrevendoEvento(true);
                    setErroEvento(null);

                    await axios.post(
                      `${API.BASE_URL}/api/eventos/${selectedEvento.id}/inscricoes`,
                      {},
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );

                    setSelectedEvento((prev) =>
                      prev
                        ? {
                            ...prev,
                            inscrito: true,
                            totalInscritos: (prev.totalInscritos ?? 0) + 1,
                          }
                        : prev
                    );
                    setDados((prev) => ({
                      ...prev,
                      eventos: prev.eventos.map((ev) =>
                        ev.id === selectedEvento.id
                          ? {
                              ...ev,
                              inscrito: true,
                              totalInscritos: (ev.totalInscritos ?? 0) + 1,
                            }
                          : ev
                      ),
                    }));
                  } catch (err: any) {
                    const msg =
                      err?.response?.data?.message ||
                      "Não foi possível concluir sua inscrição. Tente novamente.";
                    setErroEvento(msg);
                  } finally {
                    setInscrevendoEvento(false);
                  }
                }}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold ${
                  selectedEvento.status !== "ABERTO" || selectedEvento.inscrito
                    ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                <Ticket className="h-4 w-4" />
                {selectedEvento.inscrito
                  ? "Você já está inscrito"
                  : selectedEvento.status !== "ABERTO"
                  ? "Inscrições encerradas"
                  : inscrevendoEvento
                  ? "Inscrevendo..."
                  : "Inscrever-se"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="explorar" />

    </div>
  );
}

export default Explorar;