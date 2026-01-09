import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
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
  Users,
  Ticket
} from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import BottomNav from "@/components/layout/BottomNav.js";

const ENABLE_EVENTOS_TAB = false; 
const FALLBACK_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";

type UsuarioBasic = { id: string; nome: string; foto?: string | null };
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
  categoriaBase?: string | null;
  idade?: number | null;
};

type ProfessorItem = { id: string; usuario: UsuarioBasic; foto?: string | null };

type ClubeItem = {
  id: string;
  usuarioId?: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
};
type EscolaItem = {
  id: string;
  usuarioId?: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
  siteOficial?: string | null;
};
type OlheiroItem = { id: string; usuario: UsuarioBasic; foto?: string | null };

type DadosExplorar = {
  atletas: AtletaItem[];
  professores: ProfessorItem[];
  olheiros: OlheiroItem[];
  clubes: ClubeItem[];
  escolas: EscolaItem[];
  eventos: EventoItem[];
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

type RankItem = {
  atletaId: string;
  total: number;
  usuario: { id: string; nome: string; foto?: string | null };
};

type AbaExplorar = "atletas" | "escolas" | "clubes" | "profissionais" | "eventos";

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
  Sub9: "Sub-9",
  Sub11: "Sub-11",
  Sub13: "Sub-13",
  Sub15: "Sub-15",
  Sub17: "Sub-17",
  Sub20: "Sub-20",
  Livre: "Livre",
};
const CATEGORIAS = ["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Sub-23", "Profissional"];

const mapIdadeParaCategoria = (idade?: number | null): string | null => {
  if (idade == null) return null;
  if (idade <= 9) return "Sub-9";
  if (idade <= 11) return "Sub-11";
  if (idade <= 13) return "Sub-13";
  if (idade <= 15) return "Sub-15";
  if (idade <= 17) return "Sub-17";
  if (idade <= 20) return "Sub-20";
  if (idade <= 23) return "Sub-23";
  return "Profissional";
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
  const [dados, setDados] = useState<DadosExplorar>({
    atletas: [],
    professores: [],
    olheiros: [],
    clubes: [],
    escolas: [],
    eventos: [], 
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });
  const [draft, setDraft] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });

  const updateDraft = (patch: Partial<Filtros>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const [topGeral, setTopGeral] = useState<RankItem[]>([]);
  const [topPorCategoria, setTopPorCategoria] = useState<Record<string, RankItem[]>>({});

  const [carregandoDados, setCarregandoDados] = useState(false);

  const [pageSize, setPageSize] = useState(12);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [showCountAtletas, setShowCountAtletas] = useState(12);
  const [showCountEscolas, setShowCountEscolas] = useState(12);
  const [showCountClubes, setShowCountClubes] = useState(12);
  const [showCountProfs, setShowCountProfs] = useState(12);

  const [selectedEvento, setSelectedEvento] = useState<EventoItem | null>(null);
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [inscrevendoEvento, setInscrevendoEvento] = useState(false);
  const [erroEvento, setErroEvento] = useState<string | null>(null);


  const handleImgError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackDone === "1") return;
    img.dataset.fallbackDone = "1";
    img.src = FALLBACK_AVATAR;
  };

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1024) setPageSize(24);
      else if (w >= 640) setPageSize(16);
      else setPageSize(12);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    setShowCountAtletas((c) => Math.max(c, pageSize));
    setShowCountEscolas((c) => Math.max(c, pageSize));
    setShowCountClubes((c) => Math.max(c, pageSize));
    setShowCountProfs((c) => Math.max(c, pageSize));
  }, [pageSize]);

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
          id: p.id,
          usuario: p.usuario,
          foto: p.usuario?.foto ?? p.foto,
          role: "Professor" as const,
        })),
        ...(dados.olheiros || []).map((o) => ({
          id: o.id,
          usuario: o.usuario,
          foto: o.usuario?.foto ?? o.foto,
          role: "Olheiro" as const,
        })),
      ].filter((x) => x?.usuario?.id),
    [dados.professores, dados.olheiros]
  );

  const atletasFiltrados = useMemo(() => {
    const f = filtros;
    const norm = (s?: string | null) => (s || "").toLowerCase();
    return (dados.atletas || []).filter((a) => {
      if (f.categoria) {
        const cat = a.categoriaBase || mapIdadeParaCategoria(a.idade);
        if (!cat || norm(cat) !== norm(f.categoria)) return false;
      }
      if (f.posicoes && f.posicoes.length > 0) {
        const posNorm = norm(a.posicao);
        if (!posNorm) return false;

        const bate = f.posicoes.some((p) => posNorm.includes(norm(p)));
        if (!bate) return false;
      }
      if (f.estado && !norm(a.estado).includes(norm(f.estado))) return false;
      if (f.cidade && !norm(a.cidade).includes(norm(f.cidade))) return false;
      if (f.independente !== null && f.independente !== undefined) {
        if (a.independente == null || a.independente !== f.independente) return false;
      }
      if (typeof f.pontuacaoMin === "number") {
        if (typeof a.pontuacao !== "number" || a.pontuacao < f.pontuacaoMin) return false;
      }
      if (typeof f.pontuacaoMax === "number") {
        if (typeof a.pontuacao !== "number" || a.pontuacao > f.pontuacaoMax) return false;
      }
      return true;
    });
  }, [dados.atletas, filtros]);

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


  useEffect(() => {
    setShowCountAtletas(pageSize);
  }, [pageSize, busca, filtrosKey, dados.atletas.length]);

  useEffect(() => {
    setShowCountEscolas(pageSize);
  }, [pageSize, busca, filtrosKey, dados.escolas.length]);

  useEffect(() => {
    setShowCountClubes(pageSize);
  }, [pageSize, busca, filtrosKey, dados.clubes.length]);

  useEffect(() => {
    setShowCountProfs(pageSize);
  }, [pageSize, busca, filtrosKey, dados.professores.length, dados.olheiros.length]);

  useEffect(() => {
  const el = sentinelRef.current;
  if (!el) return;

  const io = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (!entry.isIntersecting) return;

      if (aba === "atletas") {
        setShowCountAtletas((c) => Math.min(c + pageSize, atletasFiltrados.length));
      } else if (aba === "escolas") {
        setShowCountEscolas((c) => Math.min(c + pageSize, dados.escolas.length));
      } else if (aba === "clubes") {
        setShowCountClubes((c) => Math.min(c + pageSize, dados.clubes.length));
      } else if (aba === "profissionais") {
        setShowCountProfs((c) => Math.min(c + pageSize, profissionais.length));
      }
    },
    { root: null, rootMargin: "400px", threshold: 0 }
  );

  io.observe(el);
  return () => io.disconnect();
}, [
  aba,
  pageSize,
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
    const token = Storage?.token ?? (typeof window !== "undefined" ? Storage.token : "");
    const params: any = { q: busca, excludeUsuarioId: loggedUserId };
    if (filtros.categoria) params.categoria = filtros.categoria;
    if (filtros.posicoes && filtros.posicoes.length) {
      params.posicoes = filtros.posicoes.join(",");
    }
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.cidade) params.cidade = filtros.cidade;
    if (filtros.independente !== null && filtros.independente !== undefined)
      params.independente = String(!!filtros.independente);
    if (typeof filtros.pontuacaoMin === "number") params.pMin = filtros.pontuacaoMin;
    if (typeof filtros.pontuacaoMax === "number") params.pMax = filtros.pontuacaoMax;

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
          clubes: filtrarEu<ClubeItem>(data.clubes || []),
          escolas: filtrarEu<EscolaItem>(data.escolas || []),
          eventos: (data.eventos || []) as EventoItem[],
        });
      })
      .catch(() => {
        setDados({ atletas: [], professores: [], olheiros: [], clubes: [], escolas: [], eventos: [] });
      })
      .finally(() => setCarregandoDados(false));
  }, [busca, loggedUserId, filtrosKey, filtrarEu]);

  const abrirFiltros = () => {
    setDraft(filtros);
    setShowFilters(true);
  };
  const aplicarFiltros = () => {
    setFiltros(draft);
    setShowFilters(false);
  };
  const limparFiltros = () => {
    const base: Filtros = {
      independente: null,
      pontuacaoMin: null,
      pontuacaoMax: null,
      posicoes: [],
    };
    setDraft(base);
    setFiltros(base);
    setShowFilters(false);
  };

  const hasMoreAtletas = showCountAtletas < atletasFiltrados.length;
  const hasMoreEscolas = showCountEscolas < dados.escolas.length;
  const hasMoreClubes = showCountClubes < dados.clubes.length;
  const hasMoreProfs = showCountProfs < profissionais.length;

  const activeFiltersCount =
    (filtros.categoria ? 1 : 0) +
    (filtros.posicoes && filtros.posicoes.length ? 1 : 0) +
    (filtros.estado ? 1 : 0) +
    (filtros.cidade ? 1 : 0) +
    (filtros.independente !== null && filtros.independente !== undefined ? 1 : 0) +
    (typeof filtros.pontuacaoMin === "number" ? 1 : 0) +
    (typeof filtros.pontuacaoMax === "number" ? 1 : 0);

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

          {aba === "atletas" && (
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
                {activeFiltersCount > 0 && <Pill tone="emerald" className="ml-1">{activeFiltersCount}</Pill>}
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
              ENABLE_EVENTOS_TAB ? "sm:grid-cols-5" : "sm:grid-cols-4"
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
            {ENABLE_EVENTOS_TAB && (
              <Tab active={aba === "eventos"} onClick={() => setAba("eventos")} icon={<CalendarClock className="h-4 w-4" />}>
                Eventos
              </Tab>
            )}
          </div>

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
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={draft.categoria ?? ""}
                  onChange={(e) =>
                    updateDraft({
                      categoria: e.target.value || undefined,
                    })
                  }
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
                    if (!atuais.includes(v)) {
                      updateDraft({ posicoes: [...atuais, v] });
                    }
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
                          updateDraft({
                            posicoes: (draft.posicoes || []).filter((p) => p !== pos),
                          })
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
                    onChange={(e) =>
                      updateDraft({
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
                    value={draft.cidade ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        cidade: e.target.value || undefined,
                      })
                    }
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
                    <span className="block text-[11px] text-gray-600 mb-1">
                      Mínima
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={draft.pontuacaoMin ?? ""}
                      onChange={(e) =>
                        updateDraft({
                          pontuacaoMin: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-gray-600 mb-1">
                      Máxima
                    </span>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={draft.pontuacaoMax ?? ""}
                      onChange={(e) =>
                        updateDraft({
                          pontuacaoMax: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
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
            <h2 className="text-base sm:text-lg font-bold mb-2">Atletas em Destaque</h2>

            {carregandoDados && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {atletasFiltrados.slice(0, showCountAtletas).map((a) => {
                    const rawFoto = a.foto ?? a.usuario?.foto;
                    const foto = formatarUrlFoto(rawFoto, "usuarios") || FALLBACK_AVATAR;
                    const nome = a?.usuario?.nome ?? "profile";
                    const uid = a?.usuario?.id ?? a?.usuarioId ?? a.id;
                    const categoria = a.categoriaBase || mapIdadeParaCategoria(a.idade);
                    return (
                      <Link href={`/perfil/${uid}`} key={`${a.id}-${uid}`}>
                        <div className="bg-white rounded-xl shadow-sm p-3 hover:shadow transition flex flex-col items-center">
                          <img
                            src={foto}
                            alt={`${nome} profile`}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border"
                            onError={handleImgError}
                          />
                          <p className="mt-2 font-medium text-center line-clamp-2 text-sm sm:text-base">{nome}</p>
                          <div className="mt-1 flex flex-wrap gap-1 justify-center">
                            {categoria && (
                              <Pill tone="emerald">
                                <Shield className="h-3.5 w-3.5" /> {categoria}
                              </Pill>
                            )}
                            {a.posicao && (
                              <Pill tone="sky">
                                <Goal className="h-3.5 w-3.5" /> {a.posicao}
                              </Pill>
                            )}
                            {(a.cidade || a.estado) && (
                              <Pill tone="gray">
                                <MapPin className="h-3.5 w-3.5" /> {a.cidade ?? ""} {a.estado ? `, ${a.estado}` : ""}
                              </Pill>
                            )}
                            {typeof a.pontuacao === "number" && (
                              <Pill tone="amber">
                                <Heart className="h-3.5 w-3.5" /> {a.pontuacao}
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
                      const foto = formatarUrlFoto(r.usuario?.foto, "usuarios") || "/assets/default-user.png";
                      return (
                        <Link href={`/perfil/${r.usuario.id}`} key={r.atletaId}>
                          <div className="min-w-[130px] sm:min-w-[150px] bg-white rounded-xl shadow-sm p-3 flex flex-col items-center hover:shadow transition">
                            <div className="text-xs font-semibold mb-1">{idx + 1}º</div>
                            <img
                              src={foto}
                              onError={handleImgError}
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border"
                              alt={r.usuario.nome}
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
                    const foto = formatarUrlFoto(top.usuario?.foto, "usuarios") || "/assets/default-user.png";
                    const rotulo = CAT_LABEL[cat] ?? cat;
                    return (
                      <Link href={`/perfil/${top.usuario.id}`} key={`cat-${cat}`}>
                        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow transition">
                          <div className="text-xs sm:text-sm font-bold w-20 sm:w-24">{rotulo}</div>
                          <img
                            src={foto}
                            onError={handleImgError}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border"
                            alt={top.usuario.nome}
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
              {dados.escolas.slice(0, showCountEscolas).map((e) => {
                const logo = formatarUrlFoto(e.logo) || FALLBACK_AVATAR;
                const href = e.usuarioId ? `/perfil/${e.usuarioId}` : undefined;
                const Card = (
                  <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow transition cursor-pointer">
                    <img src={logo} alt="Logo da escola" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border" />
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{e.nome}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.cidade ?? "Cidade"}
                        {e.estado ? `, ${e.estado}` : ""}
                      </p>
                      <p className="text-xs text-gray-600 truncate">{e.siteOficial || "Site indisponível"}</p>
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
                  onClick={() => setShowCountEscolas((c) => Math.min(c + pageSize, dados.escolas.length))}
                  className="mt-2 px-4 py-2 rounded-xl border bg-white text-sm hover:bg-emerald-50"
                >
                  Carregar mais
                </button>
              )}
              <div ref={sentinelRef} className="h-1 w-full" />
              {!hasMoreEscolas && dados.escolas.length > 0 && (
                <div className="text-xs text-gray-500 mt-2">Fim dos resultados</div>
              )}
              {dados.escolas.length === 0 && !carregandoDados && (
                <div className="text-sm text-gray-600 mt-2">Nenhuma escola encontrada</div>
              )}
            </div>
          </>
        )}

        {aba === "clubes" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">Clubes</h2>
            <div className="space-y-3">
              {dados.clubes.slice(0, showCountClubes).map((c) => {
                const logo = formatarUrlFoto(c.logo) || FALLBACK_AVATAR;
                const href = c.usuarioId ? `/perfil/${c.usuarioId}` : undefined;
                const Card = (
                  <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow transition cursor-pointer">
                    <img src={logo} alt="Logo do clube" className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border" />
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{c.nome}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.cidade ?? "Cidade"}
                        {c.estado ? `, ${c.estado}` : ""}
                      </p>
                      <p className="text-xs text-gray-600">Clube Profissional</p>
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
                  onClick={() => setShowCountClubes((c) => Math.min(c + pageSize, dados.clubes.length))}
                  className="mt-2 px-4 py-2 rounded-xl border bg-white text-sm hover:bg-emerald-50"
                >
                  Carregar mais
                </button>
              )}
              <div ref={sentinelRef} className="h-1 w-full" />
              {!hasMoreClubes && dados.clubes.length > 0 && (
                <div className="text-xs text-gray-500 mt-2">Fim dos resultados</div>
              )}
              {dados.clubes.length === 0 && !carregandoDados && (
                <div className="text-sm text-gray-600 mt-2">Nenhum clube encontrado</div>
              )}
            </div>
          </>
        )}

        {aba === "profissionais" && (
          <>
            <h2 className="text-base sm:text-lg font-bold my-4">Professores e Olheiros</h2>
            {profissionais.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {profissionais.slice(0, showCountProfs).map((p) => {
                  const rawFoto = p.foto ?? p.usuario?.foto;
                  const foto = formatarUrlFoto(rawFoto, "usuarios") || "/assets/default-user.png";
                  const uid = p.usuario.id;
                  const href = p.role === "Olheiro" ? `/perfil-olheiro/${uid}` : `/perfil/${uid}`;

                  return (
                    <Link href={href} key={`${p.role}-${p.id}`}>
                      <div className="bg-white rounded-xl shadow-sm p-3 hover:shadow transition flex flex-col items-center">
                        <img
                          src={foto}
                          alt="Foto do usuário"
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border"
                          onError={handleImgError}
                        />
                        <p className="mt-2 font-medium text-center line-clamp-2 text-sm sm:text-base">{p.usuario.nome}</p>
                        <Pill tone="amber" className="mt-1">
                          {p.role}
                        </Pill>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-600">Nenhum profissional encontrado</p>
            )}

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
                <img
                  src={
                    formatarUrlFoto(selectedEvento.clube?.logo || (selectedEvento as any).escolinha?.logo) ||
                    "/placeholder.png"
                  }
                  alt="Logo do organizador"
                  className="w-8 h-8 rounded-full object-cover border"
                />
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