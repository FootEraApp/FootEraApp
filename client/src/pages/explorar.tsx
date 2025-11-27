// client/src/pages/explorar
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
} from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

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
};

type Filtros = {
  categoria?: string;
  posicao?: string;
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
  const [aba, setAba] = useState<"atletas" | "escolas" | "clubes" | "profissionais">("atletas");
  const [dados, setDados] = useState<DadosExplorar>({
    atletas: [],
    professores: [],
    olheiros: [],
    clubes: [],
    escolas: [],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });
  const [draft, setDraft] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });

  const [topGeral, setTopGeral] = useState<RankItem[]>([]);
  const [topPorCategoria, setTopPorCategoria] = useState<Record<string, RankItem[]>>({});

  const [carregandoDados, setCarregandoDados] = useState(false);

  const [pageSize, setPageSize] = useState(12);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [showCountAtletas, setShowCountAtletas] = useState(12);
  const [showCountEscolas, setShowCountEscolas] = useState(12);
  const [showCountClubes, setShowCountClubes] = useState(12);
  const [showCountProfs, setShowCountProfs] = useState(12);

  // ---------- Fallback de imagem padrão, rodando só 1x ----------
  const handleImgError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackDone === "1") return; // evita loop infinito
    img.dataset.fallbackDone = "1";
    img.src = "/assets/default-user.png"; // estático do client/public/assets
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

  const filtrosKey = JSON.stringify(filtros);

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
        if (aba === "atletas") setShowCountAtletas((c) => Math.min(c + pageSize, atletasFiltrados.length));
        else if (aba === "escolas") setShowCountEscolas((c) => Math.min(c + pageSize, dados.escolas.length));
        else if (aba === "clubes") setShowCountClubes((c) => Math.min(c + pageSize, dados.clubes.length));
        else if (aba === "profissionais") setShowCountProfs((c) => Math.min(c + pageSize, profissionais.length));
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [aba, pageSize, dados.escolas.length, dados.clubes.length, dados.professores.length, dados.olheiros.length]);

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
    if (filtros.posicao) params.posicao = filtros.posicao;
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
        });
      })
      .catch(() => {
        setDados({ atletas: [], professores: [], olheiros: [], clubes: [], escolas: [] });
      })
      .finally(() => setCarregandoDados(false));
  }, [busca, loggedUserId, filtrosKey, filtrarEu]);

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
      if (f.posicao && !norm(a.posicao).includes(norm(f.posicao))) return false;
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

  const abrirFiltros = () => {
    setDraft(filtros);
    setShowFilters(true);
  };
  const aplicarFiltros = () => {
    setFiltros(draft);
    setShowFilters(false);
  };
  const limparFiltros = () => {
    const base = { independente: null, pontuacaoMin: null, pontuacaoMax: null } as Filtros;
    setDraft(base);
    setFiltros(base);
    setShowFilters(false);
  };

  const hasMoreAtletas = showCountAtletas < atletasFiltrados.length;
  const hasMoreEscolas = showCountEscolas < dados.escolas.length;
  const hasMoreClubes = showCountClubes < dados.clubes.length;
  const hasMoreProfs = showCountProfs < profissionais.length;

  const activeFiltersCount =
    (draft.categoria ? 1 : 0) +
    (draft.posicao ? 1 : 0) +
    (draft.estado ? 1 : 0) +
    (draft.cidade ? 1 : 0) +
    (draft.independente !== null && draft.independente !== undefined ? 1 : 0) +
    (typeof draft.pontuacaoMin === "number" ? 1 : 0) +
    (typeof draft.pontuacaoMax === "number" ? 1 : 0);

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
            </div>
          </div>
          <div className="hidden sm:grid sm:grid-cols-4 sm:gap-2">
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
          </div>
        </div>
      </div>

      {/* filtros (bottom sheet) omitidos por brevidade – permanecem iguais ao seu código, sem mudança */}

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
                    const foto = formatarUrlFoto(rawFoto, "usuarios") || "/assets/default-user.png";
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

                {/* ... resto da aba atletas, só trocando onError pelo handleImgError ... */}

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
                const logo = formatarUrlFoto(e.logo) || "/placeholder.png";
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
                const logo = formatarUrlFoto(c.logo) || "/placeholder.png";
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

            {/* resto da aba profissionais igual */}
          </>
        )}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <Link href="/feed" className="hover:underline">
          <House />
        </Link>
        <Link href="/explorar" className="hover:underline">
          <Search />
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus />
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User />
        </Link>
      </nav>
    </div>
  );
}

export default Explorar;