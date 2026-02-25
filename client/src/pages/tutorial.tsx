import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import BottomNav from "@/components/layout/BottomNav.js";

type VideoSource =
  | { kind: "youtube"; url: string }
  | { kind: "mp4"; url: string };

type TutorialItem = {
  id: string;
  titulo: string;
  duracao?: string;
  categoria: "Introdução" | "Criar Treino" | "Gerenciar" | "Publicações" | "Dicas";
  descricao?: string;
  source: VideoSource;
  passos?: string[];
};

function youtubeEmbedUrl(url: string) {
  try {
    if (url.includes("/embed/")) return url;
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    const u = new URL(url);
    const id = u.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
  } catch {}
  return url;
}

const TUTORIAIS: TutorialItem[] = [
  {
    id: "intro-1",
    titulo: "Bem-vindo: como funciona a criação de treinos",
    duracao: "2:10",
    categoria: "Introdução",
    descricao: "Visão geral do fluxo (do rascunho até a publicação).",
    source: { kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  },

  // ===== CRIAR TREINO =====

  {
    id: "criar-1",
    titulo: "Passo 1 — Dados do treino",
    duracao: "3:40",
    categoria: "Criar Treino",
    descricao: "Nome, código, nível e categoria.",
    source: { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
  },
  {
    id: "criar-2",
    titulo: "Passo 2 — Adicionar Exercícios",
    duracao: "4:55",
    categoria: "Criar Treino",
    descricao: "Ordem, repetições e organização.",
    source: { kind: "mp4", url: "/assets/videos/tutorial-adicionar-exercicios.mp4" },
  },
  {
    id: "criar-3",
    titulo: "Passo 3 — Vincular Atletas",
    duracao: "3:20",
    categoria: "Criar Treino",
    descricao: "Selecionar atletas e finalizar treino.",
    source: { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
  },

  // ===== GERENCIAR (Clubes e Escolas) =====

  {
    id: "ger-1",
    titulo: "Gerenciar Atletas — adicionar, remover e permissões",
    duracao: "3:30",
    categoria: "Gerenciar",
    descricao: "Como administrar atletas vinculados ao clube/escola e permissões.",
    source: { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
  },
  {
    id: "ger-2",
    titulo: "Turmas — criar, editar e organizar grupos",
    duracao: "4:10",
    categoria: "Gerenciar",
    descricao: "Como criar turmas, editar informações e organizar atletas por categoria.",
    source: { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
  },
  {
    id: "ger-3",
    titulo: "Professores — convidar, vincular e administrar",
    duracao: "4:45",
    categoria: "Gerenciar",
    descricao: "Fluxo para clubes e escolas adicionarem professores e gerenciarem acessos.",
    source: { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" },
  },
];

const CATEGORIAS: TutorialItem["categoria"][] = [
  "Introdução",
  "Criar Treino",
  "Gerenciar",
  "Publicações",
  "Dicas",
];

export default function TutorialPage() {
  const [, navigate] = useLocation();

  const [categoria, setCategoria] = useState<TutorialItem["categoria"]>("Criar Treino");
  const [busca, setBusca] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<string>(
    TUTORIAIS.find((t) => t.categoria === "Criar Treino")?.id ?? TUTORIAIS[0].id
  );
  const [concluidos, setConcluidos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tutorial_treinos_concluidos");
      if (raw) setConcluidos(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tutorial_treinos_concluidos", JSON.stringify(concluidos));
    } catch {}
  }, [concluidos]);

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return TUTORIAIS.filter((t) => t.categoria === categoria).filter((t) => {
      if (!q) return true;
      return (
        t.titulo.toLowerCase().includes(q) ||
        (t.descricao ?? "").toLowerCase().includes(q) ||
        (t.passos ?? []).some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [categoria, busca]);

  const selecionado = useMemo(() => {
    return TUTORIAIS.find((t) => t.id === selecionadoId) ?? TUTORIAIS[0];
  }, [selecionadoId]);

  const capituloVazio =
    categoria === "Publicações" || categoria === "Dicas";

  function marcarConcluido(id: string) {
    setConcluidos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="min-h-screen bg-[#F6F2E8]">
      <header className="sticky top-0 z-40 bg-green-900 text-white border-b border-black/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="leading-tight">
            <p className="text-sm font-semibold">Tutorial • Criar Treinos</p>
            <p className="text-xs text-white/70">Aprenda passo a passo</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/treinos"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium"
            >
              Voltar ao Treino
            </Link>

            <button
              type="button"
              onClick={() => navigate("/treinos/novo")}
              className="px-3 py-1.5 rounded-lg bg-white text-green-900 hover:bg-white/90 text-sm font-semibold"
            >
              Ir para criar treino
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
        <aside className="bg-white rounded-2xl shadow-sm border border-black/5 p-3 h-fit">
          <p className="text-sm font-semibold text-gray-900 px-2 py-2">Capítulos</p>
          <div className="space-y-1">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategoria(c);
                  const first = TUTORIAIS.find((t) => t.categoria === c);
                  if (first) setSelecionadoId(first.id);
                  setBusca("");
                }}
                className={`w-full text-left px-3 py-2 rounded-xl transition ${
                  c === categoria ? "bg-green-900 text-white" : "hover:bg-gray-50 text-gray-800"
                }`}
              >
                <span className="text-sm font-semibold">{c}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          {capituloVazio ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🚧</div>
              <h2 className="text-xl font-bold text-gray-900">Em breve</h2>
              <p className="text-sm text-gray-600 mt-2">
                Estamos preparando novos conteúdos para este capítulo.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-black/5">
                <p className="text-xs text-gray-500">{selecionado.categoria}</p>
                <h1 className="text-lg font-bold text-gray-900">{selecionado.titulo}</h1>
                {selecionado.descricao && (
                  <p className="text-sm text-gray-600 mt-1">{selecionado.descricao}</p>
                )}
              </div>

              <div className="p-4">
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                  {selecionado.source.kind === "youtube" ? (
                    <iframe
                      title={selecionado.titulo}
                      className="w-full h-full"
                      src={youtubeEmbedUrl(selecionado.source.url)}
                      allowFullScreen
                    />
                  ) : (
                    <video className="w-full h-full" controls preload="metadata">
                      <source src={selecionado.source.url} />
                    </video>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="bg-white rounded-2xl shadow-sm border border-black/5 p-4 h-fit">
          <p className="text-sm font-semibold text-gray-900">Aulas deste capítulo</p>

          <div className="mt-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-900"
            />
          </div>

          <div className="mt-4 space-y-2 max-h-[520px] overflow-auto pr-1">
            {itensFiltrados.map((t) => {
              const active = t.id === selecionadoId;
              const done = !!concluidos[t.id];

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelecionadoId(t.id)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    active ? "border-green-900 bg-green-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.titulo}</p>
                      {t.descricao ? (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{t.descricao}</p>
                      ) : null}
                    </div>

                    <span
                      className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                        done ? "bg-green-900 text-white" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {done ? "✓" : "•"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </main>

      <BottomNav />

    </div>
  );
}

