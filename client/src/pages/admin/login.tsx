import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { useLocation } from "wouter";
import { API } from "../../config.js";
import logo from "/assets/usuarios/footera-logo.png";

type SvgProps = ComponentPropsWithoutRef<"svg">;
const ChevronDown = (p: SvgProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ChevronUp = (p: SvgProps) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m18 15-6-6-6 6" />
  </svg>
);

const toLower = (v: any) => (v ?? "").toString().trim().toLowerCase();

export default function AdminLogin() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [, navigate] = useLocation();
  const [infoAberto, setInfoAberto] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const tipo = toLower(localStorage.getItem("tipoUsuario") || sessionStorage.getItem("tipoUsuario"));
    if (token && tipo === "admin") navigate("/admin");
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      const res = await fetch(`${API.BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: usuario, senha }),
      });
      const data = await res.json();
      if (!res.ok) return setErro(data?.message || "Erro ao fazer login.");

      const token: string | undefined = data.token;
      const user = data.usuario ?? data.user ?? {};
      const tipo = toLower(user.tipo ?? data.tipo);
      const isAdmin = tipo === "admin" || user.isAdmin === true || data.isAdmin === true;
      if (!token) return setErro("Resposta inválida do servidor (sem token).");
      if (!isAdmin) return setErro("Você não é um administrador.");

      localStorage.setItem("token", token);
      localStorage.setItem("tipoUsuario", "admin");
      localStorage.setItem("usuarioId", user.id ?? data.id ?? "");
      localStorage.setItem("nomeUsuario", user.nomeDeUsuario ?? user.nome ?? user.email ?? "");
      navigate("/admin");
    } catch {
      setErro("Erro de conexão com o servidor.");
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="hidden lg:flex w-full bg-green-900 text-white">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 py-4">
          <img src={logo} alt="FootEra" className="w-6 h-6" />
          <h1 className="text-2xl font-bold text-center flex-1">Bem-vindo à FootEra</h1>
          <button
            type="button"
            className="p-1 text-white/90 hover:text-white"
            aria-expanded={infoAberto}
            aria-controls="cadastro-info"
            onClick={() => setInfoAberto(v => !v)}
            title={infoAberto ? "Recolher" : "Expandir"}
          >
            {infoAberto ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col lg:flex-row">
        <section className="w-full lg:w-1/2 bg-green-800 text-white flex flex-col items-center p-5 lg:p-10">
          <div className="w-full max-w-[680px]">
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <img src={logo} className="w-10 h-10" alt="FootEra" />
              <h2 className="flex-1 text-center text-xl font-bold">Bem-vindo à FootEra</h2>
              <button
                type="button"
                className="p-2 text-white/90 hover:text-white rounded-full"
                aria-expanded={infoAberto}
                aria-controls="cadastro-info"
                onClick={() => setInfoAberto(v => !v)}
                title={infoAberto ? "Recolher" : "Expandir"}
              >
                {infoAberto ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>

            <div
              id="cadastro-info"
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                infoAberto ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 lg:max-h-[520px] lg:opacity-100"
              }`}
            >
              <p className="text-center max-w-md text-base lg:text-lg mt-4">
                Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar...
                aqui é o seu lugar. FootEra. A metodologia dos profissionais, para quem vive futebol.
              </p>
              <div className="mt-6 p-5 lg:p-6 rounded-xl text-sm lg:text-base text-left w-full bg-white/10">
                <h3 className="font-semibold mb-2">O que a FootEra oferece:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Treinamentos personalizados</li>
                  <li>Desafios para testar suas habilidades</li>
                  <li>Compartilhe seu progresso com a comunidade</li>
                  <li>Conecte-se com escolinhas e clubes profissionais</li>
                  <li>Acompanhe sua evolução com pontuações e rankings</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="relative w-full lg:w-1/2 flex justify-center items-center p-6 lg:p-10">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0">
            <div
              aria-hidden
              className="w-[420px] h-[420px] opacity-[0.06] lg:opacity-[0.08] rounded-full overflow-hidden"
              style={{
                backgroundImage: `url(${logo})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center 20%",
                backgroundSize: "85% auto",
                filter: "grayscale(100%)",
              }}
            />
          </div>

          <div className="relative z-10 w-full max-w-md bg-white shadow-lg rounded-2xl p-8 text-center">
            <h2 className="text-[22px] font-bold mb-3">Login Administrativo</h2>
            <img src="/assets/usuarios/footera-logo.png" alt="Logo FootEra" className="w-[70px] h-[70px] mx-auto mb-3" />

            <form onSubmit={handleLogin} className="mt-2 text-left">
              <input
                type="email"
                placeholder="Email do Usuário"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              />
              <input
                type="password"
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              />
              <button
                type="submit"
                className="w-full bg-green-900 hover:bg-green-800 text-white font-semibold py-2 rounded"
              >
                Entrar
              </button>
              {erro && <p className="text-red-600 text-sm mt-3 text-center">{erro}</p>}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}