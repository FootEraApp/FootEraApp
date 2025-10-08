import { useEffect, useMemo, useState } from "react";

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
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const VERSAO_TERMO = "2025-10-06";
const VERSAO_PRIV = "2025-10-06";

export default function TermosEPrivacidade() {
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
      ? "/assets/legal/termos-de-uso.txt"
      : "/assets/legal/politica-de-privacidade.txt";
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
      .map(s => s.trim())
      .filter(Boolean);
  }, [conteudo]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/assets/usuarios/footera-logo.png" className="w-8 h-8" alt="FootEra" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              Termos de Uso & Política de Privacidade
            </h1>
            <p className="text-xs text-gray-500">
              Versão {versao} • Hash (SHA-256): <span className="font-mono">{hash.slice(0, 16)}…</span>
            </p>
          </div>
          <div className="ml-auto">
            <div className="inline-flex rounded-xl bg-white p-1 shadow-sm border">
              <button
                type="button"
                onClick={() => goTab("termos")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${isTermos ? "bg-green-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${!isTermos ? "bg-green-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}
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
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8">
          <div className="bg-white rounded-xl shadow border p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {isTermos ? "Termos de Uso" : "Política de Privacidade"}
              </h2>
              <div className="text-xs text-gray-500">
                Última atualização: {versao}
              </div>
            </div>

            {!conteudo && <p className="text-sm text-gray-600">Carregando…</p>}

            <article className="prose max-w-none prose-p:my-3 prose-h3:mt-6">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap text-sm text-gray-800">{p}</p>
              ))}
            </article>

            <div className="pt-4 border-t flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">Arquivos oficiais:</span>
              <a className="underline text-blue-700" href="/assets/legal/termos-de-uso.txt" download>Baixar TXT</a>
              <a className="underline text-blue-700" href="/assets/legal/termos-de-uso-footera.docx" target="_blank" rel="noreferrer">Baixar DOCX</a>
              <span className="mx-2 text-gray-300">|</span>
              <a className="underline text-blue-700" href="/assets/legal/politica-de-privacidade.txt" download>Baixar TXT</a>
              <a className="underline text-blue-700" href="/assets/legal/Politica-de-privacidade-Footera.docx" target="_blank" rel="noreferrer">Baixar DOCX</a>
              <span className="mx-2 text-gray-300">|</span>
              <button
                onClick={() => navigator.clipboard.writeText(hash)}
                className="text-gray-700 border px-2 py-1 rounded hover:bg-gray-50"
                title="Copiar hash"
              >
                Copiar hash
              </button>
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow border p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Segurança de menores</h3>
            <ul className="text-sm text-gray-700 list-disc list-inside space-y-2">
              <li><strong>&lt; 12 anos (modo “Júnior”)</strong>: conta gerida por responsável; perfil privado; DMs fechadas por padrão; geolocalização e vídeos <em>privados</em> até o responsável ativar.</li>
              <li><strong>12–17</strong>: perfil restrito por padrão (seguidores aprovados). Avisos antes de compartilhar rosto/localização. DMs apenas com contas verificadas/aprovadas ou com opt-in do responsável.</li>
              <li><strong>Banner de saúde</strong>: conteúdo educacional; não substitui avaliação médica/profissional; responsável decide aptidão.</li>
              <li><strong>Observadores</strong>: só com consentimento específico; responsável escolhe o que é visível.</li>
            </ul>
            <div className="text-sm text-gray-600">
              Contato: <a className="underline text-blue-700" href="mailto:suporte@footera.app.br">suporte@footera.app.br</a>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}