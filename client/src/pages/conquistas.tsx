import { useEffect, useMemo, useState } from "react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft, Volleyball, User, CirclePlus, Search, House, HelpCircle } from "lucide-react";
import { Link } from "wouter";

type Earned = {
  vinculoId: string;
  conquista: {
    id: string;
    titulo: string;
    descricao?: string | null;
    tipo: string;
    icon?: string | null;
    iconUrl?: string | null;
    pontos?: number | null;
    meta?: number | null;
    ativo: boolean;
    publico: string[];
  };
  conquistadoEm?: string | null;
  progresso: number;
  concluida: boolean;
  refTipo?: string | null;
  refId?: string | null;
};

type CatalogItem = {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: string;
  icon?: string | null;
  iconUrl?: string | null;
  ativo: boolean;
  publico: string[];
  tier?: "bronze" | "prata" | "ouro" | "platina";
  groupLabel: string; 
  entityLabel: string;
  meta?: number | null;
};

type CertificadoItem = {
  id: string;
  metodologiaId: string;
  tituloMetodologia: string;
  nomeUsuario: string;
  nomeEmissor: string;
  codigoValidacao: string;
  emitidoEm?: string | null;
  concluidoEm?: string | null;
  imagemUrl?: string | null;
  pdfUrl?: string | null;
};

const groupOrder = [
  "Treinos",
  "Desafios",
  "Desafios em Grupo",
  "Learning",
  "Pontuação",
  "Gestão",
  "Eventos",
] as const;

function pickFirst<T>(...vals: (T | null | undefined)[]) {
  for (const v of vals) {
    const s = v == null ? "" : String(v);
    if (s.trim() !== "") return v as T;
  }
  return "" as any;
}

function extractTierFromDescricao(desc?: string | null): "bronze" | "prata" | "ouro" | "platina" | undefined {
  if (!desc) return undefined;
  const m = desc.match(/Tier:\s*(bronze|prata|ouro|platina)/i);
  const t = m?.[1]?.toLowerCase() as any;
  return t;
}

function limparDescricao(desc?: string | null) {
  if (!desc) return "";

  let s = String(desc);

  s = s.replace(/(^|\s|•)\s*Grupo:\s*([^\n\r•]+)\s*/gi, " ");
  s = s.replace(/(^|\s|•)\s*Tier:\s*(bronze|prata|ouro|platina)\s*/gi, " ");
  s = s.replace(/\s*•\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  return s;
}

function extractGrupoFromDescricao(desc?: string | null): string | null {
  if (!desc) return null;
  const m = desc.match(/Grupo:\s*([^\n\r•]+)/i);
  const g = m?.[1]?.trim();
  return g ? g : null;
}

function groupLabelFromTipo(tipo?: string | null): string {
  const t = String(tipo || "").toUpperCase();
  if (t === "TREINO") return "Treinos";
  if (t === "DESAFIO") return "Desafios";
  if (t === "PERFIL") return "Pontuação";
  if (t === "ORGANIZACAO") return "Gestão";
  if (t === "EVENTO") return "Eventos";
  if (t === "METODOLOGIA") return "Learning";
  return "Outros";
}

function entityLabelFromOwnerTipo(ownerTipo?: string | null): string {
  const t = String(ownerTipo || "");
  if (!t) return "Atleta";
  return t[0].toUpperCase() + t.slice(1).toLowerCase();
}

function entityFromTipoUsuario(
  tipo: string
): "Atleta" | "Professor" | "Escolinha" | "Clube" | "Learning" | "Marca" | "Federacao" | null {
  const t = String(tipo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (t === "atleta") return "Atleta";
  if (t === "professor") return "Professor";
  if (t === "escolinha" || t === "escola") return "Escolinha";
  if (t === "clube") return "Clube";
  if (t === "learning") return "Learning";
  if (t === "marca") return "Marca";
  if (t === "federacao") return "Federacao";

  return null;
}

function readTipoUsuario(): string {
  const v = pickFirst(
    (Storage as any)?.usuarioTipoRaw,
    (Storage as any)?.tipoUsuario,
    localStorage.getItem("usuarioTipoRaw"),
    localStorage.getItem("tipoUsuario"),
    sessionStorage.getItem("usuarioTipoRaw"),
    sessionStorage.getItem("tipoUsuario")
  );
  const raw = String(v).trim();
  try {
    return typeof v === "string" && (raw.startsWith("{") || raw.startsWith("\""))
      ? JSON.parse(raw)
      : raw;
  } catch {
    return raw;
  }
}

function readUsuarioId(): string | null {
  const v = pickFirst(
    (Storage as any)?.usuarioId,
    (Storage as any)?.usuarioid,
    localStorage.getItem("usuarioId"),
    localStorage.getItem("usuarioid"),
    sessionStorage.getItem("usuarioId"),
    sessionStorage.getItem("usuarioid")
  );
  const raw = String(v).trim();
  return raw === "" ? null : raw;
}

function formatarData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

const USE_API = true;
const ENABLE_DESAFIOS = false;
const ENABLE_DESAFIOS_GRUPO = false;

const BLOQUEADOS_POR_FLAG = new Set<string>([
  ...(ENABLE_DESAFIOS ? [] : ["Desafios"]),
  ...(ENABLE_DESAFIOS_GRUPO ? [] : ["Desafios em Grupo"]),
]);

const GROUPS_PROGRESSO_BASE = new Set<string>([
  "Treinos",
  "Learning",
  "Pontuação",
  "Gestão",
  "Eventos",
]);

const GROUPS_PROGRESSO_TOTAL = new Set<string>([
  ...GROUPS_PROGRESSO_BASE,
  ...(ENABLE_DESAFIOS ? ["Desafios"] : []),
  ...(ENABLE_DESAFIOS_GRUPO ? ["Desafios em Grupo"] : []),
]);

const getToken = () =>
  (Storage as any)?.token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

export default function ConquistasPage() {
  const usuarioId = readUsuarioId();
  const tipoRaw = readTipoUsuario();

  const usuarioIdDaPagina = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("usuarioId") || qs.get("userId") || usuarioId;
  }, [usuarioId]);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [earned, setEarned] = useState<Earned[]>([]);
  const [serverEntity, setServerEntity] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [certificados, setCertificados] = useState<CertificadoItem[]>([]);
  const [loadingCertificados, setLoadingCertificados] = useState(true);

  const entity = useMemo(() => {
    return serverEntity || entityFromTipoUsuario(String(tipoRaw)) || "Atleta";
  }, [serverEntity, tipoRaw]);

  const earnedIds = useMemo(
    () =>
      new Set(
        earned
          .filter((e) => e?.concluida)
          .map((e) => String(e?.conquista?.id ?? ""))
          .filter(Boolean)
      ),
    [earned]
  );

  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingCatalog(true);

      try {
        const base = (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";
        const url = `${base}/api/conquistas/catalog/${String(entity).toLowerCase()}`;

        const token = getToken();
        const r = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!r.ok) throw new Error(`Falha ao carregar catálogo (${r.status})`);

        const json = await r.json();
        const itemsRaw = Array.isArray(json?.items) ? json.items : [];
        const ownerTipo = String(json?.ownerTipo ?? entity ?? "Atleta");
        const entityLabel = entityLabelFromOwnerTipo(ownerTipo);

        const items: CatalogItem[] = itemsRaw.map((c: any) => {
          const grupoDesc = extractGrupoFromDescricao(c?.descricao);
          const rawGroupLabel = grupoDesc || groupLabelFromTipo(c?.tipo);

          const groupLabel =
            rawGroupLabel === "Metodologias" ||
            rawGroupLabel === "Metodologias Profissionais"
              ? "Learning"
              : rawGroupLabel;
              
          const tier = extractTierFromDescricao(c?.descricao);

          return {
            id: String(c.id),
            titulo: String(c.titulo ?? ""),
            descricao: c.descricao ?? null,
            tipo: String(c.tipo ?? ""),
            icon: c.icon ?? null,
            iconUrl: c.iconUrl ?? null,
            ativo: Boolean(c.ativo),
            publico: Array.isArray(c.publico) ? c.publico : [],
            tier,
            groupLabel,
            entityLabel,
            meta: (c?.meta ?? null) == null ? null : Number(c.meta),
          };
        });

        setCatalog(items);
      } catch (e) {
        console.error("ERRO loadCatalog:", e);
        setCatalog([]);
      } finally {
        setLoadingCatalog(false);
      }
    };

    loadCatalog();
  }, [entity]);

  const grouped = useMemo(() => {
    const map: Record<string, CatalogItem[]> = {};

    for (const c of catalog) {
      if (BLOQUEADOS_POR_FLAG.has(c.groupLabel)) continue;
      (map[c.groupLabel] ||= []).push(c);
    }

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const am = a.meta == null ? 999999 : Number(a.meta);
        const bm = b.meta == null ? 999999 : Number(b.meta);
        if (am !== bm) return am - bm;
        return a.titulo.localeCompare(b.titulo);
      });
    }

    return map;
  }, [catalog]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErro(null);

      if (!usuarioIdDaPagina || !USE_API) {
        setEarned([]);
        setServerEntity(entityFromTipoUsuario(String(tipoRaw)) ?? "Atleta");
        setLoading(false);
        return;
      }

      try {
        const base = (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";
        const url = `${base}/api/conquistas/${usuarioIdDaPagina}?sync=1`;
        const token = getToken();

        const r = await fetch(url, {
          credentials: "include", 
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (r.status === 401) {
          setErro("Você precisa estar logado para ver suas conquistas.");
          setEarned([]);
          setServerEntity(entityFromTipoUsuario(String(tipoRaw)) ?? "Atleta");
          setLoading(false);
          return;
        }
        if (!r.ok) {
          throw new Error(`Falha ao carregar conquistas (${r.status})`);
        }

        const json = await r.json();
        setServerEntity(json?.ownerTipo || null);
        setEarned(Array.isArray(json?.earned) ? json.earned : []);
      } catch (e: any) {
        setErro(e?.message || "Erro ao carregar conquistas.");
        setEarned([]);
        setServerEntity(entityFromTipoUsuario(String(tipoRaw)) ?? "Atleta");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [usuarioIdDaPagina, tipoRaw]);

  const progressoCatalogIds = useMemo(() => {
    return new Set(
      catalog.filter((c) => GROUPS_PROGRESSO_TOTAL.has(c.groupLabel)).map((c) => c.id)
    );
  }, [catalog]);

  const totalCatalog = progressoCatalogIds.size;

  const totalEarned = useMemo(() => {
    return earned.filter(
      (e) => e?.concluida && progressoCatalogIds.has(String(e?.conquista?.id ?? ""))
    ).length;
  }, [earned, progressoCatalogIds]);

  useEffect(() => {
    const loadCertificados = async () => {
      setLoadingCertificados(true);

      if (!usuarioIdDaPagina || !USE_API) {
        setCertificados([]);
        setLoadingCertificados(false);
        return;
      }

      try {
        const base = (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";
        const token = getToken();

        const url =
          String(usuarioIdDaPagina) === String(usuarioId || "")
            ? `${base}/api/conquistas/certificados`
            : `${base}/api/conquistas/certificados/${usuarioIdDaPagina}`;

        const r = await fetch(url, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!r.ok) throw new Error(`Falha ao carregar certificados (${r.status})`);

        const json = await r.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        setCertificados(items);
      } catch (e) {
        console.error("ERRO loadCertificados:", e);
        setCertificados([]);
      } finally {
        setLoadingCertificados(false);
      }
    };

    loadCertificados();
  }, [usuarioIdDaPagina, usuarioId]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <Link
                              href="/perfil"
                              aria-label="Voltar para perfil"
                              className="inline-flex h-10 w-10 items-center justify-center
                                rounded-full border border-green-800 bg-white text-green-900
                                shadow-sm hover:bg-green-50 focus:outline-none
                                focus:ring-2 focus:ring-green-700/30 mt-2 ml-2 mb-2"
                              >
                              <ArrowLeft className="h-5 w-5" />
                            </Link>
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Conquistas</h1>
          <p className="text-gray-600">
            {USE_API
              ? `Veja seu progresso de badges como ${entity}.`
              : "Modo offline: exibindo todas as conquistas disponíveis."}
          </p>

          <div className="mt-4 bg-white border rounded-xl p-4 shadow-sm">
            {(loading || loadingCatalog) ? (
              <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                <div className="h-full w-1/3 bg-green-600 animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Progresso total: <strong>{totalEarned}</strong> / {totalCatalog}
                  </span>
                  {!!totalCatalog && (
                    <span className="text-sm text-gray-700">
                      {Math.round((totalEarned / Math.max(totalCatalog, 1)) * 100)}%
                    </span>
                  )}
                </div>
                <div className="mt-2 h-2 w-full bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{ width: `${(totalEarned / Math.max(totalCatalog, 1)) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>

          {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
          {!usuarioId && (
            <p className="mt-2 text-sm text-gray-500">
              Entre na sua conta para sincronizar suas conquistas.
            </p>
          )}
        </header>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              Certificados
            </h2>
            {!loadingCertificados && (
              <span className="text-sm text-gray-600">
                {certificados.length} emitido{certificados.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loadingCertificados ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                <div className="h-full w-1/3 bg-green-600 animate-pulse" />
              </div>
            </div>
          ) : certificados.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm text-gray-500">
              Nenhum certificado emitido ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {certificados.map((cert) => (
                <div
                  key={cert.id}
                  className="rounded-xl border p-4 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-green-100 text-2xl">
                      🎓
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {cert.tituloMetodologia}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1">
                        Emitido por: {cert.nomeEmissor || "FootEra"}
                      </p>

                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        <div>Concluído em: {formatarData(cert.concluidoEm)}</div>
                        <div>Emitido em: {formatarData(cert.emitidoEm)}</div>
                        <div>Código: {cert.codigoValidacao}</div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {cert.pdfUrl ? (
                          <a
                            href={cert.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block px-3 py-1.5 rounded-lg bg-green-700 text-white text-sm"
                          >
                            Ver certificado
                          </a>
                        ) : (
                          <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-sm border">
                            Certificado disponível em breve
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {groupOrder
          .filter((g) => !BLOQUEADOS_POR_FLAG.has(g))
          .filter((g) => grouped[g]?.length)
          .map((group) => (
            <section key={group} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center gap-2">
                  {group}
                  {group === "Pontuação" && <PontuacaoHelp />}
                </h2>
                {!loading && (
                  <span className="text-sm text-gray-600">
                    {grouped[group].filter((a) => earnedIds.has(a.id)).length} / {grouped[group].length}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {(grouped[group] || []).map((item) => {
                  const has = earnedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={
                        "rounded-xl border p-4 bg-white shadow-sm transition " +
                        (has
                          ? "border-green-600 hover:shadow-md"
                          : "border-gray-200 opacity-70 grayscale hover:grayscale-0 hover:opacity-90")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={
                            "w-12 h-12 flex items-center justify-center rounded-xl text-2xl " +
                            (has ? "bg-green-100" : "bg-gray-100")
                          }
                          aria-hidden
                        >
                          <span>{item.icon || "🏆"}</span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
                            <TierPill tier={item.tier} active={has} />
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {limparDescricao(item.descricao)}
                          </p>

                          <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 border text-gray-600">
                              {item.entityLabel}
                            </span>
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 border text-gray-600">
                              {item.groupLabel}
                            </span>
                            {!has && <span className="ml-auto text-gray-400">Bloqueado</span>}
                            {has && <span className="ml-auto text-green-700 font-medium">Conquistado</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link to="/feed"><House /></Link>
        <Link to="/explorar"><Search /></Link>
        <Link to="/post"><CirclePlus /></Link>
        <Link to="/treinos"><Volleyball /></Link>
        <Link to="/perfil"><User /></Link>
      </nav>
    </div>
  );
}

function TierPill({
  tier,
  active,
}: {
  tier?: "bronze" | "prata" | "ouro" | "platina";
  active: boolean;
}) {
  if (!tier) return null;
  const map: Record<string, string> = {
    bronze: active ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-gray-100 text-gray-500 border-gray-200",
    prata: active ? "bg-gray-100 text-gray-700 border-gray-300" : "bg-gray-100 text-gray-500 border-gray-200",
    ouro: active ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-gray-100 text-gray-500 border-gray-200",
    platina: active ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200",
  };
  return <span className={`text-xs px-2 py-0.5 rounded border ${map[tier] || ""}`}>{tier[0].toUpperCase() + tier.slice(1)}</span>;
}

function PontuacaoHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-full p-1 text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600"
        aria-label="Como funciona a pontuação"
        title="Como funciona a pontuação"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-2 w-80 -left-2 sm:left-6 top-6 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm"
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="font-medium text-gray-900 mb-1">Como calculamos seus pontos</p>
          <ul className="list-disc pl-4 space-y-1 text-gray-700">
            <li>
              <strong>PERFORMANCE</strong> = soma dos pontos que aparecem no seu Histórico (treinos + desafios realizados).
            </li>
            <li>
              <strong>DISCIPLINA</strong> = <em>nº de treinos</em> × <strong>2</strong>.
            </li>
            <li>
              <strong>RESPONSABILIDADE</strong> = <em>nº de desafios</em> × <strong>2</strong>.
            </li>
          </ul>
          <p className="text-gray-600 mt-2">
            As badges de pontuação acendem quando você atinge os marcos definidos (ex.: 50/100/200 pontos em cada categoria).
          </p>
        </div>
      )}
    </div>
  );
}