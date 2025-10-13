import { useEffect, useMemo, useState } from "react";
import {
  ALL_ACHIEVEMENTS,
  entityFromTipoUsuario,
  AchievementLite,
} from "../lib/achievementsCatalog.js";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { Volleyball, User, CirclePlus, Search, House, HelpCircle } from "lucide-react";
import { Link } from "wouter";

type Earned = {
  id: string;
  entity: string;
  title: string;
  description: string;
  icon?: string;
  tier?: "bronze" | "prata" | "ouro" | "platina";
  group: string;
};

const groupOrder = [
  "Treinos",
  "Desafios",
  "Desafios em Grupo",
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

const USE_API = true;

const getToken = () =>
  (Storage as any)?.token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

export default function ConquistasPage() {
  const usuarioId = readUsuarioId();
  const tipoRaw = readTipoUsuario();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [earned, setEarned] = useState<Earned[]>([]);
  const [serverEntity, setServerEntity] = useState<string | null>(null);

  const entity = useMemo(() => {
    return serverEntity || entityFromTipoUsuario(String(tipoRaw)) || "Atleta";
  }, [serverEntity, tipoRaw]);

  const catalog: AchievementLite[] = useMemo(
    () => ALL_ACHIEVEMENTS.filter((a: AchievementLite) => a.entity === entity),
    [entity]
  );

  const earnedIds = useMemo(() => new Set(earned.map((e) => e.id)), [earned]);

  const grouped = useMemo(() => {
    const map: Record<string, AchievementLite[]> = {};
    for (const c of catalog) (map[c.group] ||= []).push(c);
    for (const k of Object.keys(map))
      map[k].sort((a, b) => a.title.localeCompare(b.title));
    return map;
  }, [catalog]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErro(null);

      if (!usuarioId || !USE_API) {
        setEarned([]);
        setServerEntity(entityFromTipoUsuario(String(tipoRaw)) ?? "Atleta");
        setLoading(false);
        return;
      }

      try {
        const base = (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";
        const url = `${base}/api/conquistas/${usuarioId}`;
        const token = getToken();

        const r = await fetch(url, {
          credentials: "include", // mantenha se usa cookie de sessão; não atrapalha
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
        setServerEntity(json?.entity || null);
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
  }, [usuarioId, tipoRaw]);

  const totalEarned = earnedIds.size;
  const totalCatalog = catalog.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Conquistas</h1>
          <p className="text-gray-600">
            {USE_API
              ? `Veja seu progresso de badges como ${entity}.`
              : "Modo offline: exibindo todas as conquistas disponíveis."}
          </p>

          <div className="mt-4 bg-white border rounded-xl p-4 shadow-sm">
            {loading ? (
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

        {groupOrder
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
                            <h3 className="font-semibold text-gray-900">{item.title}</h3>
                            <TierPill tier={item.tier} active={has} />
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>

                          <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 border text-gray-600">
                              {item.entity}
                            </span>
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 border text-gray-600">
                              {item.group}
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
        <Link href="/feed"><House /></Link>
        <Link href="/explorar"><Search /></Link>
        <Link href="/post"><CirclePlus /></Link>
        <Link href="/treinos"><Volleyball /></Link>
        <Link href="/perfil"><User /></Link>
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