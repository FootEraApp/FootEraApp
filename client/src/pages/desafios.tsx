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
} from "lucide-react";
import { Link } from "wouter";

import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

interface Midia {
  id: string;
  url: string;
  tipo: string; // "Video" | "Imagem"
}

interface Desafio {
  id: string;
  titulo: string;
  nivel: string; // Base | Avancado | Performance
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

const DesafiosPage: React.FC = () => {
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [filtroSeguindo, setFiltroSeguindo] = useState(false);
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [seguindoIds, setSeguindoIds] = useState<string[]>([]);
  const [comentarioTexto, setComentarioTexto] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<"feed" | "ranking">("feed");

  // modal de mídia (ranking)
  const [modalSub, setModalSub] = useState<Submissao | null>(null);
  // modal de comentários
  const [commentModalSub, setCommentModalSub] = useState<Submissao | null>(null);

  const token = Storage.token;

  // ----- Carregar dados -----
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

  // ----- Ações (like, comentar, compartilhar) -----
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

  // ----- Ranking (client-side) -----
  const seteDiasAtras = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const rankingSemanal = useMemo(() => {
    return submissoes
      .filter((s) => new Date(s.createdAt) >= seteDiasAtras)
      .sort((a, b) => b.curtidasCount - a.curtidasCount)
      .slice(0, 20);
  }, [submissoes, seteDiasAtras]);

  // ----- Comentários: fetch on-demand -----
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
      // rota pode não existir ainda; tudo bem
    }
  };

  // ----- Modal mídia (ranking) -----
  const abrirModal = (s: Submissao) => {
    setModalSub(s);
    if (!s.comentarios || s.comentarios.length === 0) fetchComentariosDaSubmissao(s.id);
    document.body.style.overflow = "hidden";
  };
  const fecharModal = () => {
    setModalSub(null);
    document.body.style.overflow = "";
  };

  // ----- Modal comentários -----
  const abrirCommentModal = (s: Submissao) => {
    setCommentModalSub(s);
    if (!s.comentarios || s.comentarios.length === 0) fetchComentariosDaSubmissao(s.id);
    document.body.style.overflow = "hidden";
  };
  const fecharCommentModal = () => {
    setCommentModalSub(null);
    document.body.style.overflow = "";
  };

  // Fechar modais com ESC
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

      {/* Abas */}
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
      </div>

      {/* Filtros */}
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
                {Array.from(new Set(submissoes.flatMap((s) => s.desafio.categoria))).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* CONTEÚDO */}
      {aba === "ranking" ? (
        <div className="space-y-3">
          {rankingSemanal.length === 0 ? (
            <p className="text-gray-500">Sem submissões nesta semana.</p>
          ) : (
            <>
              {/* Pódio Top 3 */}
              <div className="grid grid-cols-3 gap-4 items-end mb-6 text-center">
                {rankingSemanal.slice(0, 3).map((s, i) => {
                  const borda =
                    i === 0
                      ? "border-yellow-400" // ouro
                      : i === 1
                      ? "border-gray-400"   // prata
                      : "border-amber-700"; // bronze

                  return (
                    <div
                      key={s.id}
                      className={`flex flex-col items-center ${
                        i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3"
                      }`}
                    >
                      <div
                        onClick={() => abrirModal(s)}
                        className={`cursor-pointer bg-white shadow-lg rounded-xl p-3 flex flex-col items-center transition 
                          border-4 ${borda} hover:ring-2 hover:ring-green-600
                          ${i === 0 ? "h-40" : i === 1 ? "h-32" : "h-28"} 
                          w-full justify-end`}
                      >
                        <img
                          src={
                            s.atleta.usuario.foto
                              ? fullUrl(s.atleta.usuario.foto)
                              : "/default-profile.png"
                          }
                          className="w-16 h-16 rounded-full object-cover mb-2"
                          alt="Perfil"
                        />
                        <div className="font-bold text-sm truncate">
                          {s.atleta.usuario.nome}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {s.desafio.titulo}
                        </div>
                        <div className="mt-1 text-sm">❤️ {s.curtidasCount}</div>
                      </div>
                      <div className="mt-2 font-bold text-lg">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lista do restante */}
              <div className="space-y-3">
                {rankingSemanal.slice(3).map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => abrirModal(s)}
                    className="w-full text-left bg-white shadow rounded-lg p-4 flex items-center gap-3 hover:ring-2 hover:ring-green-600 transition"
                  >
                    <div className="w-8 text-center font-bold">{i + 4}</div>
                    <img
                      src={
                        s.atleta.usuario.foto
                          ? fullUrl(s.atleta.usuario.foto)
                          : "/default-profile.png"
                      }
                      className="w-10 h-10 rounded-full object-cover"
                      alt="Perfil"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{s.atleta.usuario.nome}</div>
                      <div className="text-sm text-gray-500 truncate">
                        {s.desafio.titulo}
                      </div>
                    </div>
                    <div className="text-sm">❤️ {s.curtidasCount}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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

              {/* Comentário inline opcional */}
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

      {/* MODAL MÍDIA (RANKING) */}
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
            {/* Header */}
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

            {/* Conteúdo (rolável) */}
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

              {/* Mídia com limite de altura */}
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

              {/* Ações */}
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

      {/* MODAL DE COMENTÁRIOS */}
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
            {/* Header */}
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

            {/* Lista de comentários (rolável) */}
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

              {/* Ações: like e compartilhar aqui também */}
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

              {/* Input de novo comentário */}
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

      {/* NAV */}
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
