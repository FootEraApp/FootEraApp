import { useState, type ComponentPropsWithoutRef } from "react";
import axios from "axios";
import { API } from "../config.js";

type SvgProps = ComponentPropsWithoutRef<"svg">;

function ChevronDown(props: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUp(props: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoAberto, setInfoAberto] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk("");

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErro("Informe um e-mail válido.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API.BASE_URL}/api/auth/forgot`, { email });
      setOk("Se este e-mail estiver cadastrado, enviaremos as instruções.");
    } catch {
      setOk("Se este e-mail estiver cadastrado, enviaremos as instruções.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-cream">
      <div className="w-full bg-[#14532d] text-white flex flex-col items-center px-5 py-6 sm:px-8 md:w-1/2 md:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-3 md:flex-col md:gap-2">
            <a href="/" className="cursor-pointer" aria-label="Voltar para Home">
              <img
                src="/assets/usuarios/footera-logo.png"
                alt="Logo FootEra"
                className="
                  shrink-0 object-contain transform-gpu
                  w-14 h-14 sm:w-16 sm:h-16 md:w-[130px] md:h-[130px]
                  origin-left md:origin-center mr-1
                "
              />
            </a>

            <h1 className="flex-1 md:flex-none text-center text-xl md:text-3xl font-bold leading-tight">
              Bem-vindo à FootEra
            </h1>

            <button
              type="button"
              className="md:hidden shrink-0 p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
              aria-expanded={infoAberto}
              aria-controls="esqueci-info"
              onClick={() => setInfoAberto((v) => !v)}
              title={infoAberto ? "Recolher" : "Expandir"}
            >
              {infoAberto ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div
            id="esqueci-info"
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
              infoAberto
                ? "max-h-[720px] opacity-100"
                : "max-h-0 opacity-0 md:max-h-[720px] md:opacity-100"
            }`}
          >
            <p className="text-center text-base md:text-2xl font-semibold mt-4">
              Treine. Aprenda. Se conecte. Evolua.
            </p>

            <p className="text-center text-sm md:text-lg mt-4 text-white/95">
              O ecossistema digital do futebol, feito para quem vive o jogo.
            </p>

            <div className="mt-6 p-5 md:p-6 rounded-2xl text-sm md:text-base text-left w-full bg-white/10 border border-white/10 shadow-lg">
              <h2 className="font-semibold text-xl md:text-2xl mb-4">
                O Que você encontra FootEra
              </h2>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-xl">🏋️</span>
                  <span>
                    <span className="font-semibold">Treinos e rotina</span> — exercícios, histórico e progresso.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="text-xl">🎓</span>
                  <span>
                    <span className="font-semibold">Learning</span> — metodologias, trilhas e cursos.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="text-xl">👥</span>
                  <span>
                    <span className="font-semibold">Rede social</span> — feed, conquistas e comunidade.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="text-xl">🏆</span>
                  <span>
                    <span className="font-semibold">Métricas & badges</span> — visualização e reputação no esporte.
                  </span>
                </li>
              </ul>

              <div className="mt-5 flex items-center gap-3 text-white/90">
                <div className="h-px flex-1 bg-white/30" />
                <span className="italic font-semibold whitespace-nowrap">
                  Para quem vive futebol.
                </span>
                <div className="h-px flex-1 bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="md:w-1/2 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold mb-2 text-center">Redefinir senha</h2>
          <p className="text-sm text-center text-gray-600 mb-6">
            Enviaremos um e-mail com instruções de como redefinir sua senha.
            Informe o e-mail correto.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Seu e-mail</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {ok && <p className="text-sm text-green-700">{ok}</p>}

            <button
              disabled={loading}
              className="w-full bg-green-900 hover:bg-green-800 text-white font-medium py-2 rounded disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>

            <p className="text-center text-sm mt-3">
              <a href="/login" className="text-green-700 underline">
                Volte à página de login
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
