import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Heart,
  MessageCircle,
  Share,
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  ChevronDown,
  ChevronUp,
  X,
  Medal,
} from "lucide-react";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import CardAtletaShield from "../components/cards/CardAtletaShield.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";

const TODAS_CATEGORIAS = ["Sub9","Sub11","Sub13","Sub15","Sub17","Sub20","Livre"] as const;
const UFS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

const authHeaders = { Authorization: `Bearer ${Storage.token || ""}` };

function normaliza(input: any[]): Submissao[] {
  const arr = Array.isArray(input) ? input : [];
  return arr.map((s: any) => {
  const isTreino = !!(s.treinoAgendadoId || s.treino || s.tipo === "TREINO");

  const desafio: Desafio = isTreino
    ? {
        id:
          s.treinoAgendado?.treinoProgramado?.id ||
          s.treinoProgramadoId ||
          String(s.id || "treino"),
        titulo:
          s.treinoTituloSnapshot ||
          s.treinoAgendado?.treinoProgramado?.nome ||
          s.titulo ||
          "Treino",
        nivel: String(s.nivel || "base"),
        pontuacao: Number(s.pontuacaoSnapshot ?? s.pontosCreditados ?? 0),
        categoria: Array.isArray(s.categoria) ? s.categoria : [],
        imagemUrl:
          s.imagemUrl || s.treinoAgendado?.treinoProgramado?.imagemUrl || undefined,
      }
    : {
        id: s.desafio?.id || String(s.id),
        titulo: s.desafio?.titulo || s.titulo || "",
        nivel: s.desafio?.nivel || s.nivel || "base",
        pontuacao: Number(s.desafio?.pontuacao ?? s.pontuacao ?? 0),
        categoria: Array.isArray(s.desafio?.categoria) ? s.desafio.categoria : [],
        imagemUrl: s.desafio?.imagemUrl,
      };

  const usuarioId =
    s.usuarioId || s.atleta?.usuario?.id || s.atleta?.usuarioId || null;

  const atleta: Atleta =
    s.atleta && s.atleta.usuario
      ? s.atleta
      : {
          id: s.atleta?.id || s.atletaId || usuarioId || "",
          usuario: {
            id: usuarioId || "",
            nome: s.atleta?.nome || s.usuario?.nome || s.nome || "Atleta",
            foto: s.atleta?.foto || s.usuario?.foto || s.foto || undefined,
          },
        };

  return {
    id: String(s.id),
    desafio,
    atleta,
    midias: Array.isArray(s.midias)
      ? s.midias.map((m: any) => ({
          id: String(m.id || m.url),
          url: m.url,
          tipo: m.tipo || "imagem",
        }))
      : [],
    createdAt: s.criadoEm || s.createdAt || new Date().toISOString(),
    usuarioId,
    curtidas: Array.isArray(s.curtidas) ? s.curtidas : [],
    curtidasCount: Number(s.curtidasCount ?? (s.curtidas?.length ?? 0)),
    comentariosCount: Number(s.comentariosCount ?? 0),
    viewerLiked: Boolean(s.viewerLiked ?? false),
    tipo: isTreino ? "TREINO" : "DESAFIO",
  } as Submissao;
});
}

interface Midia {
  id: string;
  url: string;
  tipo: string;
}
interface Desafio {
  id: string;
  titulo: string;
  nivel: string;
  pontuacao: number;
  categoria: string[];
  imagemUrl?: string;
}
interface Usuario {
  id: string;
  nome: string;
  foto?: string;
}
interface Atleta {
  id: string;
  usuario: Usuario;
}
interface Comentario {
  id: string;
  conteudo: string;
  dataCriacao: string;
  usuario: { id: string; nome: string; foto?: string };
}
interface Submissao {
  id: string;
  desafio: Desafio;
  atleta: Atleta;
  midias: Midia[];
  createdAt: string;
  usuarioId: string | null;
  curtidas: { usuarioId: string }[];
  curtidasCount: number;
  comentariosCount: number;
  viewerLiked: boolean;
  comentarios?: Comentario[];
  tipo: "TREINO" | "DESAFIO";
}

  function fullUrl(possiblyRelative?: string) {  
   if (!possiblyRelative) return "";
   if (possiblyRelative.startsWith("http") || possiblyRelative.startsWith("data:"))
     return possiblyRelative;
   return `${API.BASE_URL}${possiblyRelative}`;
 }

type RankItem = {
  rank: number;
  atletaId: string;
  nome: string;
  foto?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  categoria: string[];
  pontuacaoTotal: number;
  performance: number;
  disciplina: number;
  responsabilidade: number;
  isViewer: boolean;
};
type RankListResp = { total: number; items: RankItem[] };
type PosicaoResp = {
  atletaId: string;
  nome: string;
  foto?: string | null;
  cidade?: string | null;
  estado?: string | null;
  pais?: string | null;
  categoria: string[];
  pontuacaoTotal: number;
  posicao: number;
  total: number;
  inTop100: boolean;
  isViewer: boolean;
};

const calcOVR = (r: RankItem) =>
  Math.round(
    (Number(r.performance || 0) + Number(r.disciplina || 0) + Number(r.responsabilidade || 0)) / 3
  );

const RankingGlobalTab: React.FC = () => {
  const token =
    Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  const [uf, setUf] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [qTop, setQTop] = useState<string>("");
  const [lista, setLista] = useState<RankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [buscaNome, setBuscaNome] = useState("");
  const [minhaPosicao, setMinhaPosicao] = useState<PosicaoResp | null>(null);
  const [buscandoPos, setBuscandoPos] = useState(false);

  const [cardModal, setCardModal] = useState<RankItem | null>(null);
  const openCardModal = (r: RankItem) => {
    setCardModal(r);
    document.body.style.overflow = "hidden";
  };
  const closeCardModal = () => {
    setCardModal(null);
    document.body.style.overflow = "";
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCardModal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (uf) params.estado = uf;
      if (categoria) params.categoria = categoria;

      const { data } = await axios.get<RankListResp>(`${API.BASE_URL}/api/ranking/global`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setLista(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total ?? 0));
    } catch (e) {
      console.error(e);
      setLista([]);
      setTotal(0);
      alert("Não foi possível carregar o ranking global.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const aplicarFiltros = async () => {
    await carregar();
    setMinhaPosicao(null);
  };

  const limparFiltros = async () => {
    setUf("");
    setCategoria("");
    await carregar();
    setMinhaPosicao(null);
  };

  const listaFiltradaTop = useMemo(() => {
    const q = qTop.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((x) => x.nome.toLowerCase().includes(q));
  }, [lista, qTop]);

  const buscarMinhaPosicao = async () => {
    try {
      if (!buscaNome.trim()) {
        alert("Digite seu nome para procurar sua posição.");
        return;
      }
      setBuscandoPos(true);
      const params: any = {};
      if (buscaNome.trim()) params.q = buscaNome.trim();
      if (uf) params.estado = uf;
      if (categoria) params.categoria = categoria;

      const { data } = await axios.get<PosicaoResp>(`${API.BASE_URL}/api/ranking/posicao`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setMinhaPosicao(data || null);
      if (data?.inTop100) setQTop(data.nome);
    } catch (e: any) {
      console.error(e?.response?.data || e);
      setMinhaPosicao(null);
      alert(e?.response?.data?.error || "Não foi possível encontrar a posição.");
    } finally {
      setBuscandoPos(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <Medal className="text-amber-600" />
          <div className="font-semibold">Ranking global (Top 100)</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Estado (UF)</label>
            <select className="w-full border rounded px-3 py-2" value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">Todos</option>
              {UFS_BR.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Categoria</label>
            <select className="w-full border rounded px-3 py-2" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {TODAS_CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="self-end flex gap-2">
            <button onClick={aplicarFiltros} className="px-4 py-2 bg-green-700 text-white rounded">Aplicar</button>
            <button onClick={limparFiltros} className="px-4 py-2 bg-gray-200 rounded">Limpar</button>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full border rounded pl-9 pr-3 py-2"
              placeholder="Buscar no Top 100…"
              value={qTop}
              onChange={(e) => setQTop(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              className="flex-1 border rounded px-3 py-2"
              placeholder="Seu nome (ex.: João Silva)"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
            />
            <button
              onClick={buscarMinhaPosicao}
              disabled={buscandoPos}
              className="px-4 py-2 bg-green-700 text-white rounded disabled:opacity-60"
            >
              {buscandoPos ? "Buscando..." : "Ver minha posição"}
            </button>
          </div>
        </div>

        {minhaPosicao && (
          <div className="mt-4 border rounded-lg p-3 flex items-center gap-3">
            <div className="w-12 text-center">
              <div className="font-bold text-lg">#{minhaPosicao.posicao}</div>
              <div className="text-xs text-gray-500">de {minhaPosicao.total}</div>
            </div>
            <img src={formatarUrlFoto(minhaPosicao.foto, "usuarios")}
              className="w-12 h-12 rounded-full object-cover"
              alt={minhaPosicao.nome}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{minhaPosicao.nome}</div>
              <div className="text-xs text-gray-500">
                {minhaPosicao.cidade ? `${minhaPosicao.cidade} • ` : ""}
                {minhaPosicao.estado || ""} {minhaPosicao.pais ? `• ${minhaPosicao.pais}` : ""}
              </div>
              {!!minhaPosicao.categoria?.length && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {minhaPosicao.categoria.map((c) => (
                    <span key={c} className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm">Pontos</div>
              <div className="font-bold">{minhaPosicao.pontuacaoTotal}</div>
              {!minhaPosicao.inTop100 && (
                <div className="text-[11px] text-gray-500 mt-1">fora do Top 100</div>
              )}
            </div>
          </div>
        )}
      </div>

      <h3 className="text-lg font-bold">
        {loading ? "Carregando Top 100..." : `Top 100${uf ? ` • ${uf}` : ""}${categoria ? ` • ${categoria}` : ""}`}
      </h3>
      {loading ? (
        <div className="text-gray-600">Aguarde…</div>
      ) : (listaFiltradaTop.length === 0 ? (
        <div className="text-gray-600">Nenhum atleta encontrado para os filtros.</div>
      ) : (
        <div className="space-y-2">
          {listaFiltradaTop.map((r) => {
            const foto = formatarUrlFoto(r.foto, "usuarios");
            const isTop10 = r.rank <= 10;
            return (
              <div
                key={r.atletaId}
                className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${r.isViewer ? "ring-2 ring-green-600" : ""}`}
              >
                <div className="w-10 text-center font-bold text-gray-800">#{r.rank}</div>

                {isTop10 ? (
                  <button
                    onClick={() => openCardModal(r)}
                    className="shrink-0"
                    title="Ver carta em detalhe"
                  >
                    <CardAtletaShield
                      atleta={{ id: r.atletaId, nome: r.nome, foto: r.foto || undefined, posicao: `#${r.rank}` }}
                      ovr={calcOVR(r)}
                      perf={r.performance}
                      disc={r.disciplina}
                      resp={r.responsabilidade}
                      goldenMinOVR={88}
                      size={{ w: 44, h: 62 }}
                    />
                  </button>
                ) : (
                  <img src={foto} className="w-10 h-10 rounded-full object-cover shrink-0" alt={r.nome} />
                )}

                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {r.nome} {r.isViewer && <span className="text-xs text-green-700">(você)</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {r.cidade ? `${r.cidade} • ` : ""}{r.estado || ""}{r.pais ? ` • ${r.pais}` : ""}
                  </div>
                  {!!r.categoria?.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.categoria.map((c) => (
                        <span key={c} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 border">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Pontos</div>
                  <div className="font-bold text-base">{r.pontuacaoTotal}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {cardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) closeCardModal(); }}
        >
          <div className="w-full max-w-md relative p-4">
            <button
              className="absolute top-3 right-3 p-2 rounded bg-black/40 text-white hover:bg-black/60"
              onClick={closeCardModal}
              aria-label="Fechar"
            >
              <X className="text-white" />
            </button>

            <div className="w-full flex flex-col items-center">
              <CardAtletaShield
                atleta={{ id: cardModal.atletaId, nome: cardModal.nome, foto: cardModal.foto || undefined, posicao: `#${cardModal.rank}` }}
                ovr={calcOVR(cardModal)}
                perf={cardModal.performance}
                disc={cardModal.disciplina}
                resp={cardModal.responsabilidade}
                size={{ w: 320, h: 448 }}
                goldenMinOVR={88}
              />
              <div className="mt-3 text-center text-white">
                <div className="text-xl font-bold">{cardModal.nome}</div>
                <div className="text-sm opacity-90">
                  #{cardModal.rank} • {cardModal.pontuacaoTotal} pts
                </div>
                {!!cardModal.categoria?.length && (
                  <div className="mt-2 flex flex-wrap gap-2 justify-center">
                    {cardModal.categoria.map((c) => (
                      <span key={c} className="text-xs px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DesafiosPage: React.FC = () => {
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [filtroSeguindo, setFiltroSeguindo] = useState(false);
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [seguindoIds, setSeguindoIds] = useState<string[]>([]);
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<"feed" | "ranking" | "rankingGlobal">("feed");

  const [modalSub, setModalSub] = useState<Submissao | null>(null);
  const [commentModalSub, setCommentModalSub] = useState<Submissao | null>(null);
  const [subsDesafios, setSubsDesafios] = useState<Submissao[]>([]);
  const [subsTreinos, setSubsTreinos] = useState<Submissao[]>([]);

  const token = Storage.token;

  const applyUpdate = (alvo: Submissao, patch: Partial<Submissao>) => {
    setSubsDesafios(prev => prev.map(s => s.id === alvo.id ? { ...s, ...patch } : s));
    setSubsTreinos(prev => prev.map(s => s.id === alvo.id ? { ...s, ...patch } : s));
    setSubmissoes(prev   => prev.map(s => s.id === alvo.id ? { ...s, ...patch } : s));
    setModalSub(m => (m && m.id === alvo.id ? { ...m, ...patch } : m));
    setCommentModalSub(m => (m && m.id === alvo.id ? { ...m, ...patch } : m));
  };

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, seguindoRes] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/desafios/submissoes`, { headers: authHeaders }),
          axios.get(`${API.BASE_URL}/api/treinos/submissoes`,   { headers: authHeaders }),
          axios.get(`${API.BASE_URL}/api/seguidores/meus-seguidos`, { headers: authHeaders }),
        ]);

        const d1 = normaliza(r1.data);
        const d2 = normaliza(r2.data);

        setSubsDesafios(d1);
        setSubsTreinos(d2);
        setSubmissoes([...d1, ...d2]);

        const brutos = Array.isArray(seguindoRes.data) ? seguindoRes.data : [];
        const ids = brutos
          .map((x: any) => (typeof x === "string" ? x : x?.seguidoUsuarioId ?? x?.id ?? x?.usuarioId ?? ""))
          .filter(Boolean);
        setSeguindoIds(ids);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const feed = useMemo(
    () => [...subsDesafios, ...subsTreinos].sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [subsDesafios, subsTreinos]
  );

  const seguindoSet = useMemo(
    () => new Set(seguindoIds.map((id) => id.toLowerCase())),
    [seguindoIds]
  );

  const submissoesFiltradas = useMemo(() => {
    return feed.filter((s) => {
      const nivelLower = String(s.desafio?.nivel ?? "").toLowerCase();
      const nivelOk = !filtroNivel || nivelLower === filtroNivel;

      const categorias = Array.isArray(s.desafio?.categoria) ? s.desafio.categoria : [];
      const categoriaOk = !filtroCategoria || categorias.includes(filtroCategoria);

      const userIdLower = String(s.usuarioId ?? s.atleta?.usuario?.id ?? "").toLowerCase();
      const seguindoOk = !filtroSeguindo || (userIdLower && seguindoSet.has(userIdLower));

      return nivelOk && categoriaOk && seguindoOk;
    });
  }, [feed, filtroNivel, filtroCategoria, filtroSeguindo, seguindoSet]);

  const baseDeSub = (s: Submissao) =>
    `${API.BASE_URL}${s.tipo === "TREINO" ? "/api/treinos/submissoes" : "/api/desafios/submissoes"}`;

  const toggleLike = async (sub: Submissao) => {
    try {
      const r = await axios.post(
        `${baseDeSub(sub)}/${sub.id}/like`,
        {},
        { headers: { Authorization: `Bearer ${Storage.token || ""}` } }
      );
      const { liked, count } = r.data;
      applyUpdate(sub, { viewerLiked: liked, curtidasCount: count });
    } catch (e) {
      console.error("Falha ao curtir:", e);
      alert("Não foi possível curtir.");
    }
  };

  const enviarComentario = async (sub: Submissao) => {
    const txt = (comentarioTexto[sub.id] || "").trim();
    if (!txt) return;
    try {
      const r = await axios.post(
        `${baseDeSub(sub)}/${sub.id}/comentarios`,
        { conteudo: txt },
        { headers: { Authorization: `Bearer ${Storage.token || ""}` } }
      );
      const { comentario, count } = r.data;
      applyUpdate(sub, {
        comentariosCount: count,
        comentarios: [ ...(sub.comentarios || []), comentario ],
      });
      setComentarioTexto(p => ({ ...p, [sub.id]: "" }));
    } catch (e) {
      console.error("Falha ao comentar:", e);
      alert("Não foi possível comentar.");
    }
  };

  const fetchComentariosDaSubmissao = async (sub: Submissao) => {
    try {
      const r = await axios.get(`${baseDeSub(sub)}/${sub.id}/comentarios`, {
        headers: { Authorization: `Bearer ${Storage.token || ""}` },
      });
      const lista = Array.isArray(r.data) ? (r.data as Comentario[]) : [];
      if (lista.length) applyUpdate(sub, { comentarios: lista });
    } catch {}
  };

  const compartilhar = async (subId: string) => {
    const link = `${window.location.origin}/desafios?submissao=${subId}`;
    try {
      await navigator.clipboard.writeText(link);
      alert("Link da submissão copiado!");
    } catch {
      alert("Não foi possível copiar o link.");
    }
  };

  const seteDiasAtras = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  type RankAgg = { atleta: Atleta; total: number; best?: Submissao };

  const rankingSemanal = useMemo<RankAgg[]>(() => {
    const recentes = feed.filter((s) => new Date(s.createdAt) >= seteDiasAtras);
    const porAtleta = new Map<string, RankAgg>();
    for (const s of recentes) {
      const atletaId = s.atleta?.id;
      if (!atletaId) continue;
      const atual = porAtleta.get(atletaId);
      if (!atual) {
        porAtleta.set(atletaId, { atleta: s.atleta, total: s.curtidasCount || 0, best: s });
      } else {
        atual.total += s.curtidasCount || 0;
        if (!atual.best || (s.curtidasCount || 0) > (atual.best.curtidasCount || 0)) atual.best = s;
      }
    }
    return Array.from(porAtleta.values()).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [feed, seteDiasAtras]);

  const abrirModal = (s: Submissao) => {
    setModalSub(s);
    if (!s.comentarios || s.comentarios.length === 0) {
      fetchComentariosDaSubmissao(s);
    }
    document.body.style.overflow = "hidden";
  };

  const abrirCommentModal = (s: Submissao) => {
    setCommentModalSub(s);
    if (!s.comentarios || s.comentarios.length === 0) {
      fetchComentariosDaSubmissao(s);
    }
    document.body.style.overflow = "hidden";
  };

  const fecharModal = () => {
    setModalSub(null);
    document.body.style.overflow = "";
  };

  const fecharCommentModal = () => {
    setCommentModalSub(null);
    document.body.style.overflow = "";
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modalSub) fecharModal();
        if (commentModalSub) fecharCommentModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalSub, commentModalSub]);

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4">Desafios dos Atletas</h1>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setAba("feed")}
          className={`px-3 py-1 rounded-full border ${
            aba === "feed"
              ? "bg-green-700 text-white border-green-700"
              : "bg-white text-green-700 border-green-700"
          }`}
        >
          Feed
        </button>
        <button
          onClick={() => setAba("ranking")}
          className={`px-3 py-1 rounded-full border ${
            aba === "ranking"
              ? "bg-green-700 text-white border-green-700"
              : "bg-white text-green-700 border-green-700"
          }`}
        >
          Ranking semanal
        </button>
        <button
          onClick={() => setAba("rankingGlobal")}
          className={`px-3 py-1 rounded-full border ${
            aba === "rankingGlobal"
              ? "bg-green-700 text-white border-green-700"
              : "bg-white text-green-700 border-green-700"
          }`}
        >
          Ranking global
        </button>

      </div>

      {aba === "feed" && (
        <>
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="flex items-center gap-2 mb-2"
          >
            {mostrarFiltros ? "Esconder filtros" : "Mostrar filtros"}
            {mostrarFiltros ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {mostrarFiltros && (
            <div className="flex flex-wrap gap-4 mb-4 items-center">
              <button
                className={`px-4 py-2 rounded-full border ${
                  filtroSeguindo ? "bg-green-500 text-white" : "bg-white text-gray-700"
                }`}
                onClick={() => setFiltroSeguindo((prev) => !prev)}
              >
                {filtroSeguindo ? "Seguindo ✓" : "Seguindo"}
              </button>

              <select
                className="px-3 py-2 border rounded-full"
                value={filtroNivel ?? ""}
                onChange={(e) => setFiltroNivel(e.target.value === "" ? null : e.target.value)}
              >
                <option value="">Todos os níveis</option>
                <option value="base">Base</option>
                <option value="avancado">Avançado</option>
                <option value="performance">Performance</option>
              </select>

              <select
                className="px-3 py-2 border rounded-full"
                value={filtroCategoria ?? ""}
                onChange={(e) => setFiltroCategoria(e.target.value === "" ? null : e.target.value)}
              >
                <option value="">Todas as categorias</option>
                {TODAS_CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

       {aba === "ranking" ? (
        <div className="space-y-3">
          <p className="text-gray-500">Sem submissões nesta semana.</p>
        </div>
      ) : aba === "rankingGlobal" ? (
        <RankingGlobalTab />
      ) : submissoesFiltradas.length === 0 ? (
        <p className="text-gray-500">Nenhuma submissão encontrada.</p>
      ) : (
        submissoesFiltradas.map((sub) => {
          const midia = sub.midias[0];
          const isVideo = String(midia?.tipo ?? "").toLowerCase() === "video";

          return (
            <div key={sub.id} className="bg-white shadow rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <img src={ formatarUrlFoto(sub.atleta.usuario.foto, "usuarios") }
                  alt="Perfil"
                  className="w-10 h-10 rounded-full mr-3 object-cover"
                />
                <div>
                  <p className="font-semibold">{sub.atleta.usuario.nome}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(sub.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              <h2 className="text-lg font-bold">{sub.desafio.titulo}</h2>
              <div className="flex flex-wrap gap-2 text-sm my-2">
                <span className="bg-gray-200 px-2 py-1 rounded">
                  Nível: {sub.desafio.nivel}
                </span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {sub.desafio.pontuacao} pontos
                </span>
                {sub.desafio.categoria.map((cat, idx) => (
                  <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))}
              </div>

              {midia && (
                <div className="mt-3 mb-4">
                  <div className="w-full max-h-[60vh] overflow-hidden rounded-lg bg-black/5 flex items-center justify-center">
                    {isVideo ? (
                      <video
                        src={fullUrl(midia.url)}
                        controls
                        playsInline
                        className="w-full max-h-[60vh] object-contain"
                        style={{ maxHeight: "60vh" }}
                      />
                    ) : (
                      <img
                        src={fullUrl(midia.url)}
                        alt="Submissão"
                        loading="lazy"
                        className="w-full max-h-[60vh] object-contain"
                        style={{ maxHeight: "60vh" }}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-gray-600 mt-2">
                <button
                  onClick={() => toggleLike(sub)}
                  className="flex items-center gap-1 cursor-pointer"
                  title={sub.viewerLiked ? "Remover gostei" : "Gostei"}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      sub.viewerLiked ? "fill-red-600 text-red-600" : "text-gray-600"
                    }`}
                  />
                  <span>{sub.curtidasCount}</span>
                </button>

                <button
                  onClick={() => abrirCommentModal(sub)}
                  className="flex items-center gap-1 cursor-pointer"
                  title="Ver comentários"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{sub.comentariosCount}</span>
                </button>

                <button
                  onClick={() => compartilhar(sub.id)}
                  className="flex items-center gap-1 cursor-pointer"
                  title="Copiar link"
                >
                  <Share className="w-4 h-4" />
                  <span>Compartilhar</span>
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={comentarioTexto[sub.id] || ""}
                  onChange={(e) =>
                    setComentarioTexto((p) => ({ ...p, [sub.id]: e.target.value }))
                  }
                  placeholder="Adicionar comentário..."
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={() => enviarComentario(sub)}
                  className="px-3 py-2 bg-green-700 text-white rounded"
                >
                  Enviar
                </button>
              </div>

              {!!sub.comentarios?.length && (
                <div className="mt-3 space-y-2">
                  {sub.comentarios.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="font-semibold">{c.usuario.nome}</span>: {c.conteudo}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
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
};

export default DesafiosPage;
