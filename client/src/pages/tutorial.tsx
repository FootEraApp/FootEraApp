// client/src/pages/tutorial
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import BottomNav from "@/components/layout/BottomNav.js";

import cadastroFooteraVideo from "@/components/tutorial/cadastro footera.mp4";
import configuracoesAssinaturasVideo from "@/components/tutorial/configuracoes e assinaturas.mp4";
import criarAgendarTreinoTurmaVideo from "@/components/tutorial/criar e agendar treino p turma.mp4";
import criarEditarMeusExercicioVideo from "@/components/tutorial/criar e editar meus exercicio.mp4";
import criarEditarTreinoVideo from "@/components/tutorial/criar e editar treino.mp4";
import criarMetodologiaCursoVideo from "@/components/tutorial/criar metodologia curso.mp4";
import criarMetodologiaTrilhaVideo from "@/components/tutorial/criar metodologia trilha.mp4";
import explorarMensagensVideo from "@/components/tutorial/explorar e mensagens.mp4";
import feedVideo from "@/components/tutorial/feed.mp4";
import loginFooteraVideo from "@/components/tutorial/login footera.mp4";
import paginaMetodologiaVideo from "@/components/tutorial/pagina metodologia.mp4";
import paginaTreinoClubeRealizarTreinoTurma from "@/components/tutorial/pagina treino clube-realizar treino turma.mp4";
import paginasGerenciarClubeEscolinhaVideo from "@/components/tutorial/paginas gerenciar clube-escolinha.mp4";
import paginasGerenciarProfessorVideo from "@/components/tutorial/paginas gerenciar professor.mp4";
import perfilClubeVideo from "@/components/tutorial/perfil clube.mp4";
import perfilOlheiroVideo from "@/components/tutorial/perfil olheiro.mp4";
import perfilPrincipalAtletaVideo from "@/components/tutorial/perfil principal atleta.mp4";
import postagemVideo from "@/components/tutorial/postagem.mp4";
import treinosAtletaVideo from "@/components/tutorial/treinos atleta.mp4";

type VideoSource =
  | { kind: "youtube"; url: string }
  | { kind: "mp4"; url: string };

type TutorialItem = {
  id: string;
  titulo: string;
  duracao?: string;
  categoria: "Introdução" | "Criar Treino" | "Gerenciar" | "Publicações" | "Dicas" | "Metodologia";
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
    titulo: "Login na FootEra",
    duracao: "2:10",
    categoria: "Introdução",
    descricao: "Como acessar sua conta na plataforma.",
    source: { kind: "mp4", url: loginFooteraVideo },
  },
  {
    id: "intro-2",
    titulo: "Cadastro na FootEra",
    duracao: "2:40",
    categoria: "Introdução",
    descricao: "Como criar sua conta e começar a usar a plataforma.",
    source: { kind: "mp4", url: cadastroFooteraVideo },
  },

  {
    id: "criar-1",
    titulo: "Criar e editar treino",
    duracao: "3:40",
    categoria: "Criar Treino",
    descricao: "Como montar e editar um treino.",
    source: { kind: "mp4", url: criarEditarTreinoVideo },
  },
  {
    id: "criar-2",
    titulo: "Criar e agendar treino para turma",
    duracao: "4:55",
    categoria: "Criar Treino",
    descricao: "Como criar um treino e agendar para uma turma.",
    source: { kind: "mp4", url: criarAgendarTreinoTurmaVideo },
  },
  {
    id: "criar-3",
    titulo: "Criar e editar meus exercícios",
    duracao: "3:20",
    categoria: "Criar Treino",
    descricao: "Como cadastrar e ajustar seus próprios exercícios.",
    source: { kind: "mp4", url: criarEditarMeusExercicioVideo },
  },

  {
    id: "criar-4",
    titulo: "Criar metodologia de curso",
    duracao: "3:55",
    categoria: "Metodologia",
    descricao: "Como cadastrar e criar sua propria metodologia de curso.",
    source: { kind: "mp4", url: criarMetodologiaCursoVideo },
  },
  {
    id: "criar-5",
    titulo: "Criar metodologia de trilha",
    duracao: "3:18",
    categoria: "Metodologia",
    descricao: "Como cadastrar e criar sua propria metodologia de trilha.",
    source: { kind: "mp4", url: criarMetodologiaTrilhaVideo },
  },

  {
    id: "ger-1",
    titulo: "Páginas de gerenciar clube e escolinha",
    duracao: "3:30",
    categoria: "Gerenciar",
    descricao: "Como administrar clube e escolinha dentro da plataforma.",
    source: { kind: "mp4", url: paginasGerenciarClubeEscolinhaVideo },
  },
  {
    id: "ger-2",
    titulo: "Páginas de gerenciar professor",
    duracao: "4:10",
    categoria: "Gerenciar",
    descricao: "Como gerenciar professores e suas informações.",
    source: { kind: "mp4", url: paginasGerenciarProfessorVideo },
  },
  {
    id: "ger-3",
    titulo: "Configurações e assinaturas",
    duracao: "4:45",
    categoria: "Gerenciar",
    descricao: "Como acessar e configurar preferências e planos.",
    source: { kind: "mp4", url: configuracoesAssinaturasVideo },
  },

  {
    id: "pub-1",
    titulo: "Feed",
    duracao: "2:50",
    categoria: "Publicações",
    descricao: "Como funciona o feed da plataforma.",
    source: { kind: "mp4", url: feedVideo },
  },
  {
    id: "pub-2",
    titulo: "Postagem",
    duracao: "2:20",
    categoria: "Publicações",
    descricao: "Como criar e interagir com postagens.",
    source: { kind: "mp4", url: postagemVideo },
  },
  {
    id: "pub-3",
    titulo: "Explorar e mensagens",
    duracao: "3:15",
    categoria: "Publicações",
    descricao: "Como navegar no explorar e usar mensagens.",
    source: { kind: "mp4", url: explorarMensagensVideo },
  },

  {
    id: "pub-4",
    titulo: "Página Metodologia",
    duracao: "2:14",
    categoria: "Publicações",
    descricao: "Como navegar no learning e editar metodologias.",
    source: { kind: "mp4", url: paginaMetodologiaVideo },
  },

  {
    id: "dica-1",
    titulo: "Perfil principal do atleta",
    duracao: "3:10",
    categoria: "Dicas",
    descricao: "Visão geral do perfil principal do atleta.",
    source: { kind: "mp4", url: perfilPrincipalAtletaVideo },
  },
  {
    id: "dica-2",
    titulo: "Treinos do atleta",
    duracao: "3:00",
    categoria: "Dicas",
    descricao: "Como visualizar e acompanhar treinos do atleta.",
    source: { kind: "mp4", url: treinosAtletaVideo },
  },
  {
    id: "dica-3",
    titulo: "Perfil do clube",
    duracao: "2:45",
    categoria: "Dicas",
    descricao: "Como funciona a página de perfil do clube.",
    source: { kind: "mp4", url: perfilClubeVideo },
  },
  {
    id: "dica-4",
    titulo: "Perfil do olheiro",
    duracao: "2:45",
    categoria: "Dicas",
    descricao: "Como funciona a página de perfil do olheiro.",
    source: { kind: "mp4", url: perfilOlheiroVideo },
  },
  {
    id: "dica-5",
    titulo: "Página treino clube — realizar treino",
    duracao: "3:30",
    categoria: "Dicas",
    descricao: "Fluxo para realizar treino dentro da área do clube.",
    source: { kind: "mp4", url: paginaTreinoClubeRealizarTreinoTurma },
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

  const capituloVazio = itensFiltrados.length === 0;

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
                      <source src={selecionado.source.url} type="video/mp4" />
                      Seu navegador não suporta vídeo.
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