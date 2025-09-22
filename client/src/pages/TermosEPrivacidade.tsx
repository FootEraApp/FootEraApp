import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import logo from "/assets/usuarios/footera-logo.png";

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

export default function TermosEPrivacidade() {
  const [location, setLocation] = useLocation();
  const [tab, setTab] = useState<TabKey>(getInitialTab());

  useEffect(() => {
    const onPopState = () => setTab(getInitialTab());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

    const goTab = (t: TabKey) => {
    setTab(t);
    const url = `/termos?tab=${t}`;
    window.history.replaceState({}, "", url);
  };

  const isTermos = tab === "termos";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} className="w-8 h-8" alt="FootEra" />
          <h1 className="text-xl font-semibold text-gray-800">
            Termos de Uso & Política de Privacidade
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm border">
          <button
            type="button"
            onClick={() => goTab("termos")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
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
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
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

        <section
          id="painel-termos"
          role="tabpanel"
          aria-labelledby="aba-termos"
          hidden={!isTermos}
          className="mt-6"
        >
          <div className="bg-white rounded-xl shadow border p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Termos de Uso</h2>
            <p className="text-sm text-gray-600">
              <em>Texto provisório.</em> Você ainda não forneceu os termos finais. 
              Este espaço é um placeholder para o conteúdo oficial dos Termos de Uso da FootEra.
            </p>

            <div className="space-y-3 text-sm text-gray-700">
              <h3 className="font-medium">1. Aceite</h3>
              <p>Ao criar uma conta e utilizar a plataforma, o usuário concorda com estes Termos de Uso.</p>

              <h3 className="font-medium">2. Cadastro e Conta</h3>
              <p>Informações corretas, confidencialidade de credenciais e responsabilidade por atividades na conta.</p>

              <h3 className="font-medium">3. Regras de Conduta</h3>
              <p>Proibição de uso indevido, assédio, conteúdo ilegal, violação de direitos e tentativas de fraude.</p>

              <h3 className="font-medium">4. Conteúdo do Usuário</h3>
              <p>Direitos, licenças, moderação e remoção de conteúdo que viole estes termos.</p>

              <h3 className="font-medium">5. Limitações de Responsabilidade</h3>
              <p>Serviço “no estado em que se encontra”; isenções e limites conforme legislação aplicável.</p>

              <h3 className="font-medium">6. Rescisão</h3>
              <p>Encerramento de contas e remoção de acesso em caso de violações.</p>

              <h3 className="font-medium">7. Alterações</h3>
              <p>Atualizações dos termos com notificação razoável.</p>
            </div>
          </div>
        </section>

        <section
          id="painel-privacidade"
          role="tabpanel"
          aria-labelledby="aba-privacidade"
          hidden={isTermos}
          className="mt-6"
        >
          <div className="bg-white rounded-xl shadow border p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Política de Privacidade</h2>
            <p className="text-sm text-gray-600">
              <em>Texto provisório.</em> Você ainda não forneceu a política final. 
              Este espaço é um placeholder para o conteúdo oficial da Política de Privacidade da FootEra.
            </p>

            <div className="space-y-3 text-sm text-gray-700">
              <h3 className="font-medium">1. Coleta de Dados</h3>
              <p>Tipos de dados pessoais coletados, finalidades e base legal.</p>

              <h3 className="font-medium">2. Uso e Compartilhamento</h3>
              <p>Como os dados são usados, com quem podem ser compartilhados e por quê.</p>

              <h3 className="font-medium">3. Direitos do Titular</h3>
              <p>Direitos previstos na LGPD: acesso, correção, exclusão, portabilidade, etc.</p>

              <h3 className="font-medium">4. Segurança</h3>
              <p>Medidas técnicas e organizacionais para proteção de dados.</p>

              <h3 className="font-medium">5. Retenção</h3>
              <p>Prazos de armazenamento e critérios de eliminação.</p>

              <h3 className="font-medium">6. Cookies</h3>
              <p>Uso de cookies e tecnologias similares; preferências do usuário.</p>

              <h3 className="font-medium">7. Contato</h3>
              <p>Canal para dúvidas, solicitações e reclamações relacionadas à privacidade.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
