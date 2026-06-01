// client/src/pages/TermosEPrivacidade
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Instagram, Facebook } from "lucide-react";
import ReactMarkdown from "react-markdown";

type TabKey = "termos" | "privacidade";

function getInitialTab(): TabKey {
  try {
    const qs = new URLSearchParams(window.location.search);
    const q = (qs.get("tab") || "").toLowerCase();
    if (q === "privacidade") return "privacidade";
    if (q === "termos") return "termos";
    const hash = (window.location.hash || "").replace("#", "").toLowerCase();
    if (hash === "privacidade") return "privacidade";
    return "termos";
  } catch {
    return "termos";
  }
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VERSAO_TERMO = "2026-06-01";
const VERSAO_PRIV = "2026-06-01";
const SHOW_SOCIALS = false;
const LOGO_SRC = "/assets/usuarios/footera-logo.png";

export default function TermosEPrivacidade() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabKey>(getInitialTab());
  const [conteudo, setConteudo] = useState<string>("");
  const [hash, setHash] = useState<string>("");
  const isTermos = tab === "termos";

  useEffect(() => {
    const onPopState = () => setTab(getInitialTab());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const url = isTermos
      ? "/assets/legal/termos-de-uso-footera.md"
      : "/assets/legal/politica-de-privacidade-footera.md";

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const txt = await res.text();
        setConteudo(txt);
        setHash(await sha256(txt));
      } catch {
        setConteudo("Não foi possível carregar o documento.");
        setHash("");
      }
    })();
  }, [isTermos]);

  const versao = isTermos ? VERSAO_TERMO : VERSAO_PRIV;

  const goTab = (t: TabKey) => {
    setTab(t);
    const url = `/termos?tab=${t}`;
    window.history.replaceState({}, "", url);
  };

  const paragraphs = useMemo(() => {
    return conteudo
      .split(/\n{2,}/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [conteudo]);

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="overflow-hidden rounded-3xl bg-[#F6F1E7] shadow-[0_18px_50px_rgba(0,0,0,0.12)] border border-black/5">
          {/* HEADER */}
          <header className="bg-green-900 text-white">
            <div className="flex items-center justify-between px-5 py-4 md:px-8">
              {/* LOGO */}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center gap-3"
                aria-label="Ir para Home"
              >
                <img
                  src={LOGO_SRC}
                  alt="Logo FootEra"
                  className="w-11 h-11 md:w-14 md:h-14 object-contain"
                />

                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-lg md:text-xl font-extrabold">FootEra</div>
                  <div className="text-[11px] md:text-xs text-white/80">
                    A metodologia dos profissionais
                  </div>
                </div>
              </button>

              {/* MENU DESKTOP */}
              <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="hover:text-green-200 transition"
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/?tab=sobre")}
                  className="hover:text-green-200 transition"
                >
                  Sobre
                </button>

                <Link href="/termos" className="text-green-200 transition">
                  Termos de Uso &amp; Política de Privacidade
                </Link>

                <button
                  type="button"
                  onClick={() => navigate("/?tab=novidades")}
                  className="hover:text-green-200 transition"
                >
                  Novidades
                </button>
              </nav>

              {/* AÇÕES */}
              <div className="flex items-center gap-2 md:gap-3">
                {SHOW_SOCIALS && (
                  <div className="hidden md:flex items-center gap-2 mr-1">
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="h-9 w-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/15 transition"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>

                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="h-9 w-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/15 transition"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="px-4 py-2 rounded-full border border-white/25 bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition"
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/cadastro")}
                  className="px-4 py-2 rounded-full bg-white text-green-900 text-sm font-bold hover:bg-[#f3f3f3] transition"
                >
                  Cadastro
                </button>
              </div>
            </div>

            {/* MENU MOBILE/TABLET */}
            <div className="lg:hidden px-5 pb-4 md:px-8">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/?tab=sobre")}
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Sobre
                </button>

                <Link
                  href="/termos"
                  className="px-3 py-1.5 rounded-full border border-white/30 bg-white/20 text-xs font-medium"
                >
                  Termos &amp; Privacidade
                </Link>

                <button
                  type="button"
                  onClick={() => navigate("/?tab=novidades")}
                  className="px-3 py-1.5 rounded-full border border-white/20 bg-white/10 text-xs font-medium"
                >
                  Novidades
                </button>
              </div>
            </div>
          </header>

          {/* TOPO DO CONTEÚDO */}
          <section className="bg-[#F6F1E7] border-b border-black/5">
            <div className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                  <div>
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-900 px-3 py-1 text-xs md:text-sm font-semibold">
                      Área jurídica
                    </span>

                    <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-green-900">
                      Termos de Uso &amp; Política de Privacidade
                    </h1>

                    <p className="mt-2 text-sm md:text-base text-gray-700">
                      Consulte as regras, condições de uso da plataforma e as
                      diretrizes de privacidade aplicáveis ao ecossistema FootEra.
                    </p>

                    <p className="mt-2 text-xs text-gray-500">
                      Versão {versao} • Hash (SHA-256):{" "}
                      <span className="font-mono">
                        {hash ? `${hash.slice(0, 16)}…` : "—"}
                      </span>
                    </p>
                  </div>


                <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm border border-green-100">
                  <button
                    type="button"
                    onClick={() => goTab("termos")}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
                      isTermos
                        ? "bg-green-700 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    aria-selected={isTermos}
                    aria-controls="painel-termos"
                    role="tab"
                    id="aba-termos"
                  >
                    Termos de Uso
                  </button>

                  <button
                    type="button"
                    onClick={() => goTab("privacidade")}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition ${
                      !isTermos
                        ? "bg-green-700 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    aria-selected={!isTermos}
                    aria-controls="painel-privacidade"
                    role="tab"
                    id="aba-privacidade"
                  >
                    Política de Privacidade
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* CONTEÚDO */}
          <main className="bg-[#F6F1E7] px-4 py-6 md:px-8 md:py-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
              <section className="lg:col-span-8">
                <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                      {isTermos ? "Termos de Uso" : "Política de Privacidade"}
                    </h2>

                    <div className="text-xs text-gray-500">
                      Última atualização: {versao}
                    </div>
                  </div>

                  {!conteudo && (
                    <p className="text-sm text-gray-600">Carregando…</p>
                  )}

                  <article className="prose max-w-none">
                    <ReactMarkdown>
                      {conteudo}
                    </ReactMarkdown>
                  </article>

                  <div className="pt-4 border-t text-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-500 font-medium">Arquivos oficiais:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-500">Termos de uso:</span>

                      <a
                        className="underline text-green-800 hover:text-green-700"
                        href="/assets/legal/termos-de-uso-footera.md"
                        download
                      >
                        Baixar Markdown
                      </a>

                      <a
                        className="underline text-green-800 hover:text-green-700"
                        href="/assets/legal/termos-de-uso-footera.docx"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Baixar DOCX
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-500">Política de privacidade:</span>

                      <a
                        className="underline text-green-800 hover:text-green-700"
                        href="/assets/legal/politica-de-privacidade-footera.md"
                        download
                      >
                        Baixar Markdown
                      </a>

                      <a
                        className="underline text-green-800 hover:text-green-700"
                        href="/assets/legal/politica-de-privacidade-footera.docx"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Baixar DOCX
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="lg:col-span-4">
                <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 md:p-6 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    Segurança de menores
                  </h3>

                  <ul className="text-sm text-gray-700 list-disc list-inside space-y-2 leading-6">
                    <li>
                      <strong>&lt; 12 anos (modo “Júnior”)</strong>: conta gerida
                      por responsável; perfil privado; DMs fechadas por padrão;
                      geolocalização e vídeos <em>privados</em> até o responsável
                      ativar.
                    </li>
                    <li>
                      <strong>12–17</strong>: perfil restrito por padrão
                      (seguidores aprovados). Avisos antes de compartilhar
                      rosto/localização. DMs apenas com contas
                      verificadas/aprovadas ou com opt-in do responsável.
                    </li>
                    <li>
                      <strong>Banner de saúde</strong>: conteúdo educacional; não
                      substitui avaliação médica/profissional; responsável decide
                      aptidão.
                    </li>
                    <li>
                      <strong>Observadores</strong>: só com consentimento
                      específico; responsável escolhe o que é visível.
                    </li>
                  </ul>

                  <div className="rounded-xl bg-[#F6F1E7] border border-green-100 p-4">
                    <div className="text-sm font-medium text-green-900">
                      Suporte FootEra
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      Contato para dúvidas sobre termos, privacidade e uso da
                      plataforma.
                    </div>
                    <div className="mt-2 text-sm">
                      <a
                        className="underline text-green-800 hover:text-green-700"
                        href="mailto:suporte@footera.app.br"
                      >
                        suporte@footera.app.br
                      </a>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </main>

          {/* RODAPÉ */}
          <footer className="border-t border-gray-200 bg-white px-6 py-5 md:px-10">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-600">
                © {new Date().getFullYear()} FootEra. Todos os direitos reservados.
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="text-green-900 hover:text-green-700"
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/?tab=sobre")}
                  className="text-green-900 hover:text-green-700"
                >
                  Sobre
                </button>

                <Link href="/termos" className="text-green-900 hover:text-green-700">
                  Termos &amp; Privacidade
                </Link>

                <button
                  type="button"
                  onClick={() => navigate("/?tab=novidades")}
                  className="text-green-900 hover:text-green-700"
                >
                  Novidades
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}