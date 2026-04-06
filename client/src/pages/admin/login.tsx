// client/src/pages/admin/login
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
  const [usuario, setUsuario] = useState("");
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
      const url = `${API.BASE_URL}/api/auth/login`;
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

      sessionStorage.setItem("token", token);
      localStorage.setItem("token", token);
      sessionStorage.setItem("usuarioId", usuarioId);
      localStorage.setItem("usuarioId", usuarioId);
      sessionStorage.setItem("nomeUsuario", usuarioNome);
      localStorage.setItem("nomeUsuario", usuarioNome);

      const tipoServer = String(user.tipo || data.tipo || "admin").toLowerCase();
      sessionStorage.setItem("tipoUsuario", tipoServer);
      localStorage.setItem("tipoUsuario", tipoServer);

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
    <div className="min-h-screen bg-cream flex flex-col xl:flex-row">
      <div className="w-full xl:w-1/2 bg-[#14532d] text-white flex flex-col items-center p-5 md:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-3 xl:flex-col xl:gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer"
              aria-label="Voltar para Home"
            >
              <img
                src="/assets/usuarios/footera-logo.png"
                alt="Logo FootEra"
                className="
                  shrink-0 object-contain transform-gpu
                  w-14 h-14 sm:w-16 sm:h-16 md:w-[110px] md:h-[110px] lg:w-[130px] lg:h-[130px]
                  origin-left md:origin-center mr-1
                "
              />
            </button>

            <h1 className="flex-1 md:flex-none text-center text-xl md:text-3xl font-bold">
              Bem-vindo à FootEra
            </h1>

            <button
              type="button"
              className="xl:hidden p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
              aria-expanded={infoAberto}
              aria-controls="info-footera"
              onClick={() => setInfoAberto((v) => !v)}
              title={infoAberto ? "Recolher" : "Expandir"}
            >
              {infoAberto ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div
            id="info-footera"
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out
              ${
                infoAberto
                  ? "max-h-[720px] opacity-100"
                  : "max-h-0 opacity-0 xl:max-h-[720px] xl:opacity-100"
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

      <main className="flex flex-1 w-full xl:w-1/2 justify-center">
        <div className="relative w-full bg-cream flex justify-center items-center p-6 md:p-10 xl:p-14 min-h-screen">
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

          <div className="relative z-10 w-full max-w-[520px] bg-[#f8f8f8] shadow-xl rounded-[28px] p-7 md:p-10 text-center mx-auto">
            <img
              src="/assets/usuarios/footera-logo-fundo-verde.png"
              alt="Logo FootEra"
              className="w-[86px] h-[86px] mx-auto mb-4 rounded-2xl"
            />

            <h2 className="text-[26px] md:text-[28px] font-bold mb-4 leading-tight">
              Login Administrativo
            </h2>

            <p className="text-sm text-red-600 font-medium mb-6 leading-7">
              Acesso restrito. Área exclusiva para administradores autorizados.
              Tentativas de acesso indevido poderão ser registradas e tratadas conforme a legislação vigente.
            </p>

            <form onSubmit={handleLogin} className="mt-2 text-left">
              <input
                type="text"
                placeholder="Nome de usuário do Admin"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                autoComplete="username"
                className="w-full border border-gray-300 rounded px-4 py-3 mb-4 text-lg"
              />

              <div className="relative mb-4">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="Senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded px-4 py-3 pr-12 text-lg"
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
                className="w-full bg-green-900 hover:bg-green-800 text-white font-semibold py-3 rounded text-lg"
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
        </div>
      </main>
    </div>
  );
}