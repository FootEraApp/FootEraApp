// client/src/pages/desafios
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

const TODAS_CATEGORIAS = ["Sub9","Sub11","Sub13","Sub15","Sub17","Sub20","Livre"] as const;
const UFS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

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
}

function fullUrl(possiblyRelative?: string) {
  if (!possiblyRelative) return "";
  if (possiblyRelative.startsWith("http") || possiblyRelative.startsWith("data:"))
    return possiblyRelative;
  return `${API.BASE_URL}${possiblyRelative}`;
}

/* ===================== RANKING GLOBAL (Top 100) ===================== */
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

const RankingGlobalTab: React.FC = () => {
  const token =
    Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token") || "";

  const [uf, setUf] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [qTop, setQTop] = useState<string>(""); // busca local no Top100
  const [lista, setLista] = useState<RankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [buscaNome, setBuscaNome] = useState("");
  const [minhaPosicao, setMinhaPosicao] = useState<PosicaoResp | null>(null);
  const [buscandoPos, setBuscandoPos] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <img
              src={minhaPosicao.foto ? fullUrl(minhaPosicao.foto) : "/default-profile.png"}
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
        {loading ? "Carregando Top 100..." : `Top 100 ${uf ? `• ${uf}` : ""} ${categoria ? `• ${categoria}` : ""}`}
      </h3>
      {loading ? (
        <div className="text-gray-600">Aguarde…</div>
      ) : (listaFiltradaTop.length === 0 ? (
        <div className="text-gray-600">Nenhum atleta encontrado para os filtros.</div>
      ) : (
        <div className="space-y-2">
          {listaFiltradaTop.map((r) => {
            const foto = r.foto ? fullUrl(r.foto) : "/default-profile.png";
            return (
              <div
                key={r.atletaId}
                className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${r.isViewer ? "ring-2 ring-green-600" : ""}`}
              >
                <div className="w-10 text-center font-bold text-gray-800">#{r.rank}</div>
                <img src={foto} className="w-10 h-10 rounded-full object-cover" alt={r.nome} />
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
    </div>
  );
};
/* =================== FIM RANKING GLOBAL (Top 100) =================== */

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

  const token = Storage.token;

  useEffect(() => {
    const fetchSubmissoesEseguindo = async () => {
      try {
        const [submissoesRes, seguindoRes] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/desafios/submissoes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API.BASE_URL}/api/seguidores/meus-seguidos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const norm: Submissao[] = (submissoesRes.data as any[]).map((s) => ({
          ...s,
          curtidas: Array.isArray(s.curtidas) ? s.curtidas : [],
          curtidasCount: Number(s.curtidasCount ?? (s.curtidas?.length ?? 0)),
          comentariosCount: Number(s.comentariosCount ?? 0),
          viewerLiked: Boolean(s.viewerLiked ?? false),
        }));

        setSubmissoes(norm);

        const brutos = Array.isArray(seguindoRes.data) ? seguindoRes.data : [];
        const ids = brutos
          .map((x: any) =>
            typeof x === "string" ? x : x?.seguidoUsuarioId ?? x?.id ?? x?.usuarioId ?? ""
          )
          .filter(Boolean);
        setSeguindoIds(ids);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    fetchSubmissoesEseguindo();
  }, [token]);

  const seguindoSet = useMemo(
    () => new Set(seguindoIds.map((id) => id.toLowerCase())),
    [seguindoIds]
  );

  const submissoesFiltradas = useMemo(() => {
    return submissoes.filter((s) => {
      const nivelLower = String(s.desafio?.nivel ?? "").toLowerCase();
      const nivelOk = !filtroNivel || nivelLower === filtroNivel;

      const categorias = Array.isArray(s.desafio?.categoria) ? s.desafio.categoria : [];
      const categoriaOk = !filtroCategoria || categorias.includes(filtroCategoria);

      const userIdLower = String(s.usuarioId ?? s.atleta?.usuario?.id ?? "").toLowerCase();
      const seguindoOk = !filtroSeguindo || (userIdLower && seguindoSet.has(userIdLower));

      return nivelOk && categoriaOk && seguindoOk;
    });
  }, [submissoes, filtroNivel, filtroCategoria, filtroSeguindo, seguindoSet]);

  const toggleLike = async (subId: string) => {
    try {
      const r = await axios.post(
        `${API.BASE_URL}/api/desafios/submissoes/${subId}/like`,
        {},
        { headers: { Authorization: `Bearer ${Storage.token || ""}` } }
      );
      const { liked, count } = r.data;

      setSubmissoes((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, viewerLiked: liked, curtidasCount: count } : s))
      );

      setModalSub((m) => (m && m.id === subId ? { ...m, viewerLiked: liked, curtidasCount: count } : m));
      setCommentModalSub((m) =>
        m && m.id === subId ? { ...m, viewerLiked: liked, curtidasCount: count } : m
      );
    } catch (e) {
      console.error("Falha ao curtir:", e);
      alert("Não foi possível curtir.");
    }
  };

  const enviarComentario = async (subId: string) => {
    const txt = (comentarioTexto[subId] || "").trim();
    if (!txt) return;

    try {
      const r = await axios.post(
        `${API.BASE_URL}/api/desafios/submissoes/${subId}/comentarios`,
        { conteudo: txt },
        { headers: { Authorization: `Bearer ${Storage.token || ""}` } }
      );
      const { comentario, count } = r.data;

      setSubmissoes((prev) =>
        prev.map((s) =>
          s.id === subId
            ? {
                ...s,
                comentariosCount: count,
                comentarios: [...(s.comentarios || []), comentario],
              }
            : s
        )
      );
      setComentarioTexto((p) => ({ ...p, [subId]: "" }));

      setModalSub((m) =>
        m && m.id === subId
          ? { ...m, comentariosCount: count, comentarios: [...(m.comentarios || []), comentario] }
          : m
      );

      setCommentModalSub((m) =>
        m && m.id === subId
          ? { ...m, comentariosCount: count, comentarios: [...(m.comentarios || []), comentario] }
          : m
      );
    } catch (e) {
      console.error("Falha ao comentar:", e);
      alert("Não foi possível comentar.");
    }
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
    const recentes = submissoes.filter((s) => new Date(s.createdAt) >= seteDiasAtras);
    const porAtleta = new Map<string, RankAgg>();

    for (const s of recentes) {
      const atletaId = s.atleta?.id;
      if (!atletaId) continue;

      const atual = porAtleta.get(atletaId);
      if (!atual) {
        porAtleta.set(atletaId, { atleta: s.atleta, total: s.curtidasCount || 0, best: s });
      } else {
        atual.total += s.curtidasCount || 0;
        if (!atual.best || (s.curtidasCount || 0) > (atual.best.curtidasCount || 0)) {
          atual.best = s;
        }
      }
    }

    return Array.from(porAtleta.values()).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [submissoes, seteDiasAtras]);

  const fetchComentariosDaSubmissao = async (subId: string) => {
    try {
      const r = await axios.get(`${API.BASE_URL}/api/desafios/submissoes/${subId}/comentarios`, {
        headers: { Authorization: `Bearer ${Storage.token || ""}` },
      });
      const lista = Array.isArray(r.data) ? (r.data as Comentario[]) : [];
      if (lista.length) {
        setSubmissoes((prev) =>
          prev.map((s) => (s.id === subId ? { ...s, comentarios: lista } : s))
        );
        setModalSub((m) => (m && m.id === subId ? { ...m, comentarios: lista } : m));
        setCommentModalSub((m) => (m && m.id === subId ? { ...m, comentarios: lista } : m));
      }
    } catch {
    }
  };

  const abrirModal = (s: Submissao) => {
    setModalSub(s);
    if (!s.comentarios || s.comentarios.length === 0) fetchComentariosDaSubmissao(s.id);
    document.body.style.overflow = "hidden";
  };
  const fecharModal = () => {
    setModalSub(null);
    document.body.style.overflow = "";
  };

  const abrirCommentModal = (s: Submissao) => {
    setCommentModalSub(s);
    if (!s.comentarios || s.comentarios.length === 0) fetchComentariosDaSubmissao(s.id);
    document.body.style.overflow = "hidden";
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

      {/* Conteúdo principal por aba */}
      {aba === "ranking" ? (
        <div className="space-y-3">
          {rankingSemanal.length === 0 ? (
            <p className="text-gray-500">Sem submissões nesta semana.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 items-end mb-6 text-center">
                {rankingSemanal.slice(0, 3).map((r, i) => {
                  const borda = i === 0 ? "border-yellow-400" : i === 1 ? "border-gray-400" : "border-amber-700";
                  const foto = r.atleta.usuario.foto ? fullUrl(r.atleta.usuario.foto) : "/default-profile.png";
                  const titulo = r.best?.desafio?.titulo ?? "";
                  return (
                    <div
                      key={r.atleta.id}
                      className={`flex flex-col items-center ${i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3"}`}
                    >
                      <div
                        onClick={() => r.best && abrirModal(r.best)}
                        className={`cursor-pointer bg-white shadow-lg rounded-xl p-3 flex flex-col items-center transition 
                          border-4 ${borda} hover:ring-2 hover:ring-green-600
                          ${i === 0 ? "h-40" : i === 1 ? "h-32" : "h-28"} w-full justify-end`}
                      >
                        <img src={foto} className="w-16 h-16 rounded-full object-cover mb-2" alt="Perfil" />
                        <div className="font-bold text-sm truncate">{r.atleta.usuario.nome}</div>
                        <div className="mt-1 text-sm">❤️ {r.total}</div>
                      </div>
                      <div className="mt-2 font-bold text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3">
              {rankingSemanal.slice(3).map((r, i) => {
                const foto = r.atleta.usuario.foto ? fullUrl(r.atleta.usuario.foto) : "/default-profile.png";
                const titulo = r.best?.desafio?.titulo ?? "";
                return (
                  <button
                    key={r.atleta.id}
                    onClick={() => r.best && abrirModal(r.best)}
                    className="w-full text-left bg-white shadow rounded-lg p-4 flex items-center gap-3 hover:ring-2 hover:ring-green-600 transition"
                  >
                    <div className="w-8 text-center font-bold">{i + 4}</div>
                    <img src={foto} className="w-10 h-10 rounded-full object-cover" alt="Perfil" />
                    <div className="flex-1">
                      <div className="font-semibold">{r.atleta.usuario.nome}</div>
                      <div className="text-sm text-gray-500 truncate">{titulo}</div>
                    </div>
                    <div className="text-sm">❤️ {r.total}</div>
                  </button>
                );
              })}
            </div>
            </>
          )}
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
                <img
                  src={
                    sub.atleta.usuario.foto
                      ? fullUrl(sub.atleta.usuario.foto)
                      : "/default-profile.png"
                  }
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
                  onClick={() => toggleLike(sub.id)}
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
                  onClick={() => enviarComentario(sub.id)}
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

      {modalSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharModal();
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <img
                  src={
                    modalSub.atleta.usuario.foto
                      ? fullUrl(modalSub.atleta.usuario.foto)
                      : "/default-profile.png"
                  }
                  className="w-10 h-10 rounded-full object-cover"
                  alt="Perfil"
                />
                <div>
                  <div className="font-semibold">{modalSub.atleta.usuario.nome}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(modalSub.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
              <button
                className="p-2 rounded hover:bg-gray-100"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <X />
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(90vh-64px)]">
              <h2 className="text-lg font-bold mb-2">{modalSub.desafio.titulo}</h2>

              <div className="flex flex-wrap gap-2 text-sm mb-3">
                <span className="bg-gray-200 px-2 py-1 rounded">Nível: {modalSub.desafio.nivel}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {modalSub.desafio.pontuacao} pontos
                </span>
                {modalSub.desafio.categoria.map((cat, idx) => (
                  <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))}
              </div>

              {modalSub.midias[0] && (
                <div className="mb-4">
                  <div className="w-full max-h-[65vh] overflow-hidden rounded-lg bg-black/5 flex items-center justify-center">
                    {String(modalSub.midias[0].tipo).toLowerCase() === "video" ? (
                      <video
                        src={fullUrl(modalSub.midias[0].url)}
                        controls
                        playsInline
                        className="w-full max-h-[65vh] object-contain"
                        style={{ maxHeight: "65vh" }}
                      />
                    ) : (
                      <img
                        src={fullUrl(modalSub.midias[0].url)}
                        alt="Submissão"
                        loading="lazy"
                        className="w-full max-h-[65vh] object-contain"
                        style={{ maxHeight: "65vh" }}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                <button
                  onClick={() => toggleLike(modalSub.id)}
                  className="flex items-center gap-1 cursor-pointer"
                  title={modalSub.viewerLiked ? "Remover gostei" : "Gostei"}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      modalSub.viewerLiked ? "fill-red-600 text-red-600" : "text-gray-600"
                    }`}
                  />
                  <span>{modalSub.curtidasCount}</span>
                </button>

                <button
                  onClick={() => abrirCommentModal(modalSub)}
                  className="flex items-center gap-1 cursor-pointer"
                  title="Ver comentários"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{modalSub.comentariosCount}</span>
                </button>

                <button
                  onClick={() => compartilhar(modalSub.id)}
                  className="flex items-center gap-1 cursor-pointer"
                  title="Copiar link"
                >
                  <Share className="w-4 h-4" />
                  <span>Compartilhar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {commentModalSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharCommentModal();
          }}
        >
          <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <img
                  src={
                    commentModalSub.atleta.usuario.foto
                      ? fullUrl(commentModalSub.atleta.usuario.foto)
                      : "/default-profile.png"
                  }
                  className="w-10 h-10 rounded-full object-cover"
                  alt="Perfil"
                />
                <div>
                  <div className="font-semibold">{commentModalSub.atleta.usuario.nome}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(commentModalSub.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
              <button
                className="p-2 rounded hover:bg-gray-100"
                onClick={fecharCommentModal}
                aria-label="Fechar"
              >
                <X />
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(90vh-64px)]">
              <h3 className="font-semibold mb-3">
                Comentários ({commentModalSub.comentariosCount})
              </h3>

              {(!commentModalSub.comentarios || commentModalSub.comentarios.length === 0) ? (
                <p className="text-sm text-gray-500 mb-3">Seja o primeiro a comentar!</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-auto pr-2">
                  {commentModalSub.comentarios.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <img
                        src={c.usuario.foto ? fullUrl(c.usuario.foto) : "/default-profile.png"}
                        className="w-8 h-8 rounded-full object-cover mt-0.5"
                        alt={c.usuario.nome}
                      />
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-semibold">{c.usuario.nome}</span>{" "}
                          <span className="text-xs text-gray-500">
                            {new Date(c.dataCriacao).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="text-sm">{c.conteudo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-gray-600 mt-4 mb-2">
                <button
                  onClick={() => toggleLike(commentModalSub.id)}
                  className="flex items-center gap-1 cursor-pointer"
                  title={commentModalSub.viewerLiked ? "Remover gostei" : "Gostei"}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      commentModalSub.viewerLiked ? "fill-red-600 text-red-600" : "text-gray-600"
                    }`}
                  />
                  <span>{commentModalSub.curtidasCount}</span>
                </button>

                <button
                  onClick={() => compartilhar(commentModalSub.id)}
                  className="flex items-center gap-1 cursor-pointer"
                  title="Copiar link"
                >
                  <Share className="w-4 h-4" />
                  <span>Compartilhar</span>
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  value={comentarioTexto[commentModalSub.id] || ""}
                  onChange={(e) =>
                    setComentarioTexto((p) => ({ ...p, [commentModalSub.id]: e.target.value }))
                  }
                  placeholder="Adicionar comentário..."
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={() => enviarComentario(commentModalSub.id)}
                  className="px-3 py-2 bg-green-700 text-white rounded"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
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
