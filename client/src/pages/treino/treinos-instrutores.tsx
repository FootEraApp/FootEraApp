// client/src/pages/treinos/treinos-instrutores.tsx
import React, { useEffect, useState, type SVGProps } from "react";
import { Link, useLocation } from "wouter";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  Check,
  X,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, FLAGS } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";

/* ===================== Tipos ===================== */
interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
}
interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  dataAgendada?: string;
  exercicios: Exercicio[];
  duracao?: number;
  objetivo?: string;
  dicas?: string[];
  professorId?: string;
  escolinhaId?: string;
  clubeId?: string;
  pontuacao?: number | null;
}
interface UsuarioLogado {
  tipo: "admin" | "atleta" | "escola" | "escolinha" | "clube" | "professor" | "olheiro";
  usuarioId: string;
  tipoUsuarioId: string;
}
interface SubmissaoParaValidacao {
  id: string;
  criadoEm: string;
  aprovado: boolean | null;
  pontosSugeridos: number;
  atleta: { id: string; usuarioId: string; nome: string; foto?: string | null };
  treino: { agendadoId: string; titulo: string; programadoId?: string | null };
  midias: string[];
  observacao?: string | null;
}

/* ===================== Helpers ===================== */
function SoccerFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="2.25" />
      <rect x="3" y="8.5" width="4" height="7" rx="0.5" />
      <rect x="17" y="8.5" width="4" height="7" rx="0.5" />
    </svg>
  );
}
const PLACEHOLDER_USER = "/assets/default-user.png";
function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/assets/") || raw.startsWith("/attached_assets/")) return raw;
  if (raw.startsWith("/uploads/")) return `${API.BASE_URL}${raw}`;
  return `${API.BASE_URL}/uploads/${raw.replace(/^\/+/, "")}`;
}
function formatarData(data?: string) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "";
}
function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
}
const getToken = () =>
  (Storage as any).token ?? localStorage.getItem("token") ?? sessionStorage.getItem("token") ?? "";

/* ===================== Props ===================== */
export default function TreinosInstrutores({ tipo }: { tipo: UsuarioLogado["tipo"] | "" }) {
  const [, navigate] = useLocation();

  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [abaProfessor, setAbaProfessor] = useState<"avaliar" | "criar">("avaliar");
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [submissoesPendentes, setSubmissoesPendentes] = useState<SubmissaoParaValidacao[]>([]);
  const [carregandoSubmissoes, setCarregandoSubmissoes] = useState(false);
  const [page, setPage] = useState({ total: 0, limit: 20, offset: 0 });

  const [dataAgendarById, setDataAgendarById] = useState<Record<string, string>>({});
  const [obsById, setObsById] = useState<Record<string, string>>({});

  useEffect(() => {
    const tipoSalvo =
      (Storage as any).tipoSalvo ??
      (Storage as any).tipoUsuario ??
      (Storage as any).tipo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario");

    const usuarioId = (Storage as any).usuarioId ?? localStorage.getItem("usuarioId");
    const tipoUsuarioId = (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");

    const t = String(tipoSalvo || "").toLowerCase() as UsuarioLogado["tipo"];
    if (["admin", "atleta", "escola", "escolinha", "clube", "professor", "olheiro"].includes(t) && usuarioId) {
      setUsuario({ tipo: t, usuarioId, tipoUsuarioId: tipoUsuarioId ?? "" });
    } else {
      console.warn("Tipo/IDs inválidos", { tipoSalvo, usuarioId, tipoUsuarioId });
    }
  }, []);

  // carregar dados principais
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const t = (usuario?.tipo ?? tipo ?? "").toLowerCase();

    (async () => {
      // treinos programados
      try {
        const resTreinos = await fetch(`${API.BASE_URL}/api/treinos/programados`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resTreinos.ok) throw new Error(`/treinos/programados: ${resTreinos.status}`);
        const jsonTreinos = await resTreinos.json();
        const normTreinos = (Array.isArray(jsonTreinos) ? jsonTreinos : []).map((tr: any) => ({
          id: tr.id,
          nome: tr.nome,
          descricao: tr.descricao ?? undefined,
          nivel: tr.nivel,
          dataAgendada: tr.dataAgendada ?? undefined,
          duracao: tr.duracao ?? undefined,
          objetivo: tr.objetivo ?? undefined,
          dicas: Array.isArray(tr.dicas) ? tr.dicas : [],
          professorId: tr.professorId ?? undefined,
          escolinhaId: tr.escolinhaId ?? undefined,
          clubeId: tr.clubeId ?? undefined,
          pontuacao: tr.pontuacao ?? undefined,
          exercicios: (tr.exercicios ?? []).map((ex: any) => ({
            id: ex.exercicio?.id ?? ex.id ?? "",
            nome: ex.exercicio?.nome ?? ex.nome ?? "",
            repeticoes: ex.repeticoes ?? undefined,
          })),
        })) as TreinoProgramado[];
        setTreinos(normTreinos);
      } catch (e) {
        console.error(e);
        setTreinos([]);
      }

      // submissões pendentes (para quem é gestor)
      if (["professor", "admin", "escola", "escolinha", "clube"].includes(t)) {
        carregarSubmissoes();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.tipoUsuarioId, tipo]);

  async function carregarSubmissoes(append = false) {
    const token = getToken();
    if (!token || !usuario) return;

    const limit = page.limit;
    const offset = append ? page.offset + page.limit : 0;

    setCarregandoSubmissoes(true);
    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/submissoes?tipoUsuarioId=${usuario.tipoUsuarioId}&status=pendente&limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Falha /treinos/submissoes: ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? [];

      setSubmissoesPendentes((prev) => (append ? [...prev, ...items] : items));
      setPage({ total: data.total ?? items.length, limit: data.limit ?? limit, offset });
    } catch (e) {
      console.error(e);
      if (!append) setSubmissoesPendentes([]);
    } finally {
      setCarregandoSubmissoes(false);
    }
  }

  async function validarSubmissao(id: string, aprovado: boolean, pontosSug?: number) {
    const token = getToken();
    if (!token || !usuario) return;

    let pontos = 0;
    if (aprovado) {
      const inp = prompt("Pontos a creditar para este treino:", String(pontosSug ?? 0));
      if (inp === null) return;
      const n = Number(inp);
      pontos = Number.isFinite(n) && n >= 0 ? n : 0;
    }

    try {
      const res = await fetch(`${API.BASE_URL}/api/treinos/submissoes/${id}/validar?tipoUsuarioId=${usuario.tipoUsuarioId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aprovado, pontos }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao validar:", res.status, txt);
        return alert("Não foi possível validar a submissão.");
      }
      setSubmissoesPendentes((prev) => prev.filter((s) => s.id !== id));
      alert(aprovado ? "Submissão aprovada e pontos creditados!" : "Submissão reprovada.");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao validar.");
    }
  }
  const aprovar = (id: string, pontos?: number) => validarSubmissao(id, true, pontos);
  const reprovar = (id: string) => validarSubmissao(id, false, 0);

  // ---- Agendar treino programado (mantido, só aparece se existir atletaId no storage) ----
  async function agendarTreinoProgramado(treino: TreinoProgramado, dataSelecionadaISO: string, observacao?: string) {
    const token = getToken();
    const atletaId = (Storage as any).tipoUsuarioId || (Storage as any).atletaId;
    if (!token || !atletaId) {
      alert("Para agendar um treino, acesse com um atleta.");
      return;
    }
    const dia = (dataSelecionadaISO || new Date(Date.now() + 86400000).toISOString()).slice(0, 10);
    const quandoISO = `${dia}T23:59:59.000Z`;

    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          titulo: treino.nome,
          dataTreino: quandoISO,
          dataExpiracao: null,
          atletaId,
          treinoProgramadoId: treino.id,
          observacao: observacao ?? null,
        }),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        if (r.status === 409) return alert("Você já tem um agendamento futuro desse treino.");
        console.error("Falha ao agendar:", r.status, txt);
        return alert("Não foi possível agendar o treino.");
      }

      const novo = await r.json();
      window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));
      alert("Treino agendado!");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  }

  const formatarDataHora = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

  // ---- UI helpers ----
  const renderTreinoCard = (treino: TreinoProgramado) => {
    const temAtletaNoStorage = Boolean((Storage as any).tipoUsuarioId || (Storage as any).atletaId);
    return (
      <div key={treino.id} className="bg-white p-4 rounded-xl shadow-sm border mb-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-bold text-lg text-green-800 cursor-pointer hover:underline" onClick={() => navigate(`/treinos/unico?programadoId=${treino.id}`)}>
            {treino.nome}
          </h4>
          {typeof treino.pontuacao === "number" && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">+{treino.pontuacao} pts</span>
          )}
        </div>

        {treino.descricao && <p className="text-sm text-gray-700 mt-1">{treino.descricao}</p>}

        <div className="mt-3 flex flex-col gap-2">
          {/* Só mostra UI de agendar se houver atletaId disponível */}
          {temAtletaNoStorage && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                className="px-3 py-2 border rounded-lg"
                value={dataAgendarById[treino.id] ?? ""}
                onChange={(e) => setDataAgendarById((p) => ({ ...p, [treino.id]: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Observação (opcional)"
                className="px-3 py-2 border rounded-lg flex-1"
                value={obsById[treino.id] ?? ""}
                onChange={(e) => setObsById((p) => ({ ...p, [treino.id]: e.target.value }))}
              />
              <button
                onClick={() => {
                  const iso = dataAgendarById[treino.id] || new Date().toISOString().slice(0, 10);
                  agendarTreinoProgramado(treino, iso, obsById[treino.id]);
                }}
                className="bg-green-800 text-white px-3 py-2 rounded-lg"
              >
                Agendar treino
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
          <p><strong>Nível:</strong> {treino.nivel}</p>
          {treino.dataAgendada && <p><strong>Data:</strong> {formatarData(treino.dataAgendada)}</p>}
          {typeof treino.duracao === "number" && <p><strong>Duração:</strong> {treino.duracao} min</p>}
          {treino.objetivo && <p className="sm:col-span-2"><strong>Objetivo:</strong> {treino.objetivo}</p>}
        </div>

        {treino.exercicios?.length > 0 && (
          <div className="mt-3">
            <strong className="text-sm text-gray-800">Exercícios:</strong>
            <div className="max-h-40 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
              {treino.exercicios.map((ex, i) => (
                <div key={ex.id || `${i}-${ex.nome || "ex"}`} className="border-b pb-1 last:border-b-0">
                  <strong>{i + 1}.</strong> {ex.nome} {ex.repeticoes && <span className="text-gray-500">({ex.repeticoes})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isGestor =
    usuario?.tipo &&
    ["professor", "admin", "escola", "escolinha", "clube"].includes(String(usuario.tipo).toLowerCase());

  const isOlheiro = String((Storage as any).tipoSalvo ?? "").toLowerCase() === "olheiro";

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4">
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <HealthBanner />
        </div>

        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            {isGestor ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-[420px]">
                <button
                  onClick={() => setAbaProfessor("avaliar")}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    abaProfessor === "avaliar" ? "bg-green-800 text-white border-green-900" : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Avaliar Treinos
                </button>
                <button
                  onClick={() => setAbaProfessor("criar")}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    abaProfessor === "criar" ? "bg-green-800 text-white border-green-900" : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Meus Treinos
                </button>
              </div>
            ) : (
              <div className="text-lg font-semibold text-green-900">Treinos</div>
            )}

            <Link
              href="/treinos/elenco"
              aria-label="Ir para o elenco (campo)"
              title="Elenco (campo)"
              className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <SoccerFieldIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {isGestor && abaProfessor === "avaliar" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <h3 className="text-lg font-semibold mb-3">Treinos dos atletas afiliados</h3>

              {carregandoSubmissoes ? (
                <p className="text-gray-500">Carregando submissões pendentes...</p>
              ) : submissoesPendentes.length === 0 ? (
                <p className="text-gray-500">Nenhum treino pendente para avaliação no momento.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {submissoesPendentes.map((s) => {
                      const foto = s.atleta?.foto ? resolveUploadUrl(s.atleta.foto) : PLACEHOLDER_USER;
                      const midias = (Array.isArray(s.midias) ? s.midias : []).map(resolveUploadUrl);

                      return (
                        <li key={s.id} className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-3 sm:p-4">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <img
                              src={foto}
                              alt={s.atleta?.nome}
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border"
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                (el as any).onerror = null;
                                el.src = PLACEHOLDER_USER;
                              }}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold text-green-900 truncate">{s.treino.titulo}</div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  +{s.pontosSugeridos ?? 0} pts
                                </span>

                                <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() => aprovar(s.id, s.pontosSugeridos)}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Aprovar e creditar pontos"
                                  >
                                    <Check className="w-4 h-4" /> Aprovar
                                  </button>
                                  <button
                                    onClick={() => reprovar(s.id)}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                                    title="Reprovar"
                                  >
                                    <X className="w-4 h-4" /> Reprovar
                                  </button>
                                </div>
                              </div>

                              <div className="text-sm text-gray-600 truncate">{s.atleta?.nome}</div>
                              <div className="text-xs text-gray-500">{formatarData(s.criadoEm)} • {new Date(s.criadoEm).toLocaleTimeString("pt-BR")}</div>

                              {!!midias.length && (
                                <div className="mt-3 sm:mt-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                                    {midias.map((src, idx) => {
                                      const isVid = isVideoUrl(src);
                                      return isVid ? (
                                        <div key={`${src}-${idx}`} className="relative w-full overflow-hidden rounded-lg bg-black border pt-[56.25%]">
                                          <video
                                            src={src}
                                            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition"
                                            controls
                                            playsInline
                                            muted
                                            aria-label={`mídia ${idx + 1}`}
                                            preload="metadata"
                                          />
                                        </div>
                                      ) : (
                                        <a key={`${src}-${idx}`} href={src} target="_blank" rel="noreferrer" className="block group" title="Abrir imagem">
                                          <div className="relative w-full overflow-hidden rounded-lg border bg-gray-50 pt-[56.25%]">
                                            <img
                                              src={src}
                                              alt={`mídia ${idx + 1}`}
                                              className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {submissoesPendentes.length < page.total && (
                    <div className="mt-3 flex justify-center">
                      <button onClick={() => carregarSubmissoes(true)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                        Carregar mais
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {abaProfessor === "criar" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold">{usuario?.tipo === "admin" ? "Todos os Treinos" : "Treinos que você criou"}</h3>
                <button className="bg-green-800 text-white px-4 py-2 rounded-lg" onClick={() => navigate("/treinos/novo")}>
                  Criar novo treino
                </button>
              </div>

              {(usuario?.tipo === "admin"
                ? treinos
                : treinos.filter(
                    (t) =>
                      t.professorId === usuario?.tipoUsuarioId ||
                      t.escolinhaId === usuario?.tipoUsuarioId ||
                      t.clubeId === usuario?.tipoUsuarioId,
                  )
              ).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(usuario?.tipo === "admin"
                    ? treinos
                    : treinos.filter(
                        (t) =>
                          t.professorId === usuario?.tipoUsuarioId ||
                          t.escolinhaId === usuario?.tipoUsuarioId ||
                          t.clubeId === usuario?.tipoUsuarioId,
                      )
                  ).map(renderTreinoCard)}
                </div>
              ) : (
                <p className="text-gray-500">{usuario?.tipo === "admin" ? "Nenhum treino cadastrado." : "Você ainda não criou nenhum treino."}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]">
        <Link href="/feed" className="hover:opacity-90" aria-label="Feed">
          <House />
        </Link>
        <Link href="/explorar" className="hover:opacity-90" aria-label="Explorar">
          <Search />
        </Link>
        <Link href="/post" className="hover:opacity-90" aria-label="Novo post">
          <CirclePlus />
        </Link>
        <Link href={isOlheiro ? "/olheiros" : "/treinos"} className="hover:opacity-90" aria-label="Treinos">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:opacity-90" aria-label="Perfil">
          <User />
        </Link>
      </nav>
    </div>
  );
}
