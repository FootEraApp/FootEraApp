// client/src/pages/admin/login.tsx
import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import logo from "/assets/usuarios/footera-logo.png";

type SvgProps = ComponentPropsWithoutRef<"svg">;

const ChevronDown = (p: SvgProps) => (
  <svg
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ChevronUp = (p: SvgProps) => (
  <svg
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);

const Eye = (p: SvgProps) => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = (p: SvgProps) => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.78 20.78 0 0 1 5.06-6.94" />
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.82 20.82 0 0 1-4.87 6.82" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const isE2E = typeof window !== "undefined" && (window as any).Cypress;

export default function AdminLogin() {
  const [usuario, setUsuario] = useState(""); // pode ser email OU nomeDeUsuario
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrarDeMim, setLembrarDeMim] = useState(true);
  const [erro, setErro] = useState("");
  const [, navigate] = useLocation();
  const [infoAberto, setInfoAberto] = useState(false);

  function clearAuth() {
    try {
      ["token", "usuarioId", "nomeUsuario", "tipoUsuario", "usuarioTipoRaw", "tipoUsuarioId", "plano"].forEach(
        (k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        }
      );
      if ((window as any)?.Storage) (window as any).Storage = {};
    } catch {}
  }

  useEffect(() => {
    if (isE2E) return;

    const token =
      Storage.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (!token) return;

    const tipo = (
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario") ||
      ""
    ).toLowerCase();

    // se já está logado e for admin -> vai direto pro admin
    if (tipo === "admin") navigate("/admin");
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!usuario || !senha) {
      setErro("Por favor, preencha todos os campos.");
      return;
    }

    clearAuth();

    try {
      // ✅ mesma rota do login normal
      const url = `${API.BASE_URL}/api/auth/login`;

      // ✅ mesma ideia do login normal: manda nomeDeUsuario
      // (se você estiver digitando email aqui, o backend precisa aceitar email como login,
      //  senão use o nomeDeUsuario do admin)
      const resp = await axios.post(url, { nomeDeUsuario: usuario, senha });
      const data = resp.data ?? {};

      const user = data.usuario ?? {};
      const token = data.token;
      const usuarioId = user.id ?? data.id ?? "";
      const usuarioNome = user.nomeDeUsuario ?? user.nome ?? data.nomeDeUsuario ?? "Administrador";
      const rawTipo = String(user.tipo ?? data.tipo ?? "").toLowerCase();

      const isAdmin =
        rawTipo === "admin" ||
        user.isAdmin === true ||
        data.isAdmin === true ||
        String(user.tipo ?? "").toLowerCase() === "admin";

      if (!token || !usuarioId) {
        setErro("Resposta inválida do servidor (sem token/usuarioId).");
        return;
      }

      if (!isAdmin) {
        setErro("Você não é um administrador.");
        return;
      }

      const plano = user.plano ?? data.plano ?? "FREE";

      const store = lembrarDeMim ? localStorage : sessionStorage;

      // ✅ igual ao login normal: grava em ambos para evitar “sumir” em telas
      sessionStorage.setItem("token", token);
      localStorage.setItem("token", token);

      sessionStorage.setItem("usuarioId", usuarioId);
      localStorage.setItem("usuarioId", usuarioId);

      sessionStorage.setItem("nomeUsuario", usuarioNome);
      localStorage.setItem("nomeUsuario", usuarioNome);

      // tipo vindo do servidor (normalizado)
      const tipoServer = String(user.tipo || data.tipo || "admin").toLowerCase();
      sessionStorage.setItem("tipoUsuario", tipoServer);
      localStorage.setItem("tipoUsuario", tipoServer);

      // força tipo admin no store “principal”
      store.setItem("tipoUsuario", "admin");
      store.setItem("usuarioTipoRaw", rawTipo);

      const tipoUsuarioId =
        data.tipoUsuarioId ||
        data?.administrador?.id ||
        null;
      if (tipoUsuarioId) store.setItem("tipoUsuarioId", String(tipoUsuarioId));

      store.setItem("plano", String(plano));
      sessionStorage.setItem("plano", String(plano));
      localStorage.setItem("plano", String(plano));

      // mantém compat com código que lê Storage.token
      try {
        (window as any).Storage = (window as any).Storage || {};
        (window as any).Storage.token = token;
      } catch {}

      navigate("/admin");
    } catch (err: any) {
      console.error("Erro no login admin:", err?.response?.status, err?.response?.data || err?.message);
      const data = err?.response?.data;
      setErro(data?.message || "Nome de usuário ou senha inválidos.");
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="hidden lg:flex w-full bg-green-900 text-white">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 py-4">
          <img src={logo} alt="FootEra" className="w-6 h-6" />
          <h1 className="text-2xl font-bold text-center flex-1">
            Bem-vindo à FootEra
          </h1>
          <button
            type="button"
            className="p-1 text-white/90 hover:text-white"
            aria-expanded={infoAberto}
            aria-controls="cadastro-info"
            onClick={() => setInfoAberto((v) => !v)}
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
              <h2 className="flex-1 text-center text-xl font-bold">
                Bem-vindo à FootEra
              </h2>
              <button
                type="button"
                className="p-2 text-white/90 hover:text-white rounded-full"
                aria-expanded={infoAberto}
                aria-controls="cadastro-info"
                onClick={() => setInfoAberto((v) => !v)}
                title={infoAberto ? "Recolher" : "Expandir"}
              >
                {infoAberto ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>

            <div
              id="cadastro-info"
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                infoAberto
                  ? "max-h-[520px] opacity-100"
                  : "max-h-0 opacity-0 lg:max-h-[520px] lg:opacity-100"
              }`}
            >
              <p className="text-center max-w-md text-base lg:text-lg mt-4">
                Se você sonha em conquistar uma oportunidade, joga por amor ou
                quer se superar... aqui é o seu lugar. FootEra. A metodologia
                dos profissionais, para quem vive futebol.
              </p>
              <div className="mt-6 p-5 lg:p-6 rounded-xl text-sm lg:text-base text-left w-full bg-white/10">
                <h3 className="font-semibold mb-2">
                  O que a FootEra oferece:
                </h3>
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
            <img
              src="/assets/usuarios/footera-logo.png"
              alt="Logo FootEra"
              className="w-[70px] h-[70px] mx-auto mb-3"
            />

            <form onSubmit={handleLogin} className="mt-2 text-left">
              <input
                type="text"
                placeholder="Nome de usuário do Admin"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                autoComplete="username"
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              />

              <div className="relative mb-4">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="Senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-2 flex items-center px-2 text-gray-500 hover:text-gray-700"
                >
                  {mostrarSenha ? <EyeOff /> : <Eye />}
                </button>
              </div>

              <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={lembrarDeMim}
                  onChange={(e) => setLembrarDeMim(e.target.checked)}
                />
                Lembrar de mim
              </label>

              <button
                type="submit"
                className="w-full bg-green-900 hover:bg-green-800 text-white font-semibold py-2 rounded"
              >
                Entrar
              </button>

              {erro && (
                <p className="text-red-600 text-sm mt-3 text-center">{erro}</p>
              )}

              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-green-900 hover:underline font-medium"
                >
                  Você não é admin? Vá para o login principal
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}