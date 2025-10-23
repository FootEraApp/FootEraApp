import { useState, useEffect, type ComponentPropsWithoutRef } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

type SvgProps = ComponentPropsWithoutRef<"svg">;

function EyeIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.7 21.7 0 0 1-3.2 4.49" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function ChevronDown(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ChevronUp(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default function PaginaLogin() {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrarDeMim, setLembrarDeMim] = useState(false);
  const [erro, setErro] = useState("");
  const [, navigate] = useLocation();
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [infoAberto, setInfoAberto] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!nomeDeUsuario || !senha) {
      setErro("Por favor, preencha todos os campos.");
      return;
    }
    try {
      const url = `${API.BASE_URL}/api/auth/login`;
      const resp = await axios.post(url, { nomeDeUsuario, senha });
      const data = resp.data ?? {};
      const usuario = data.usuario ?? {};
      const usuarioId = usuario.id ?? data.id ?? "";
      const usuarioNome = usuario.nomeDeUsuario ?? data.nomeDeUsuario ?? "";
      const rawTipo = String(usuario.tipo ?? data.tipo ?? "").toLowerCase();
      const isAdmin = usuario.tipo === "Admin" || String(usuario.tipo).toLowerCase() === "admin";
      const token = data.token;
      if (!token || !usuarioId) throw new Error("Resposta inválida do servidor");

      const store = lembrarDeMim ? localStorage : sessionStorage;
      ["token","usuarioId","nomeUsuario","tipoUsuario","usuarioTipoRaw","tipoUsuarioId"].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });

      store.setItem("token", token);
      store.setItem("usuarioId", usuarioId);
      store.setItem("nomeUsuario", usuarioNome);

      const map: Record<string, string> = { admin:"admin", atleta:"atleta", professor:"professor", clube:"clube", escolinha:"escolinha", escola:"escola", olheiro:"olheiro" };
      const tipoPadrao = isAdmin ? "admin" : map[rawTipo] ?? "atleta";
      store.setItem("tipoUsuario", tipoPadrao);
      store.setItem("usuarioTipoRaw", rawTipo);

      const tipoUsuarioId =
        data.tipoUsuarioId || data?.olheiro?.id || data?.professor?.id || data?.clube?.id || data?.escolinha?.id || data?.atleta?.id || null;
      if (tipoUsuarioId) store.setItem("tipoUsuarioId", String(tipoUsuarioId));

      navigate(isAdmin ? "/admin" : "/feed");
    } catch (err: any) {
      console.error("Erro no login:", err.response?.status, err.response?.data || err.message);
      setErro(err.response?.data?.message || "Nome de usuário ou senha inválidos.");
    }
  };

  useEffect(() => {
    const token = Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return;
    const tipo = (localStorage.getItem("tipoUsuario") || sessionStorage.getItem("tipoUsuario") || "").toLowerCase();
    navigate(tipo === "admin" ? "/admin" : "/feed");
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="md:w-1/2 bg-green-800 text-white flex flex-col items-center p-5 md:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-3 md:flex-col md:gap-2">
            <img src="/assets/usuarios/footera-logo.png" alt="Logo FootEra" className="w-10 h-10 md:w-14 md:h-14" />
            <h1 className="flex-1 md:flex-none text-center text-xl md:text-3xl font-bold">
              Bem-vindo à FootEra
            </h1>
            <button
              type="button"
              className="md:hidden p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
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
              ${infoAberto ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 md:max-h-[520px] md:opacity-100"}`}
          >
            <p className="text-center text-base md:text-lg mt-4">
              Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar...
              aqui é o seu lugar. FootEra. A metodologia dos profissionais, para quem vive futebol.
            </p>

            <div className="mt-6 p-5 md:p-6 rounded-xl text-sm md:text-base text-left w-full bg-white/10">
              <h2 className="font-semibold mb-2">O que a FootEra oferece:</h2>
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
      </div>

      <div className="relative md:w-1/2 bg-cream flex justify-center items-center p-6 md:p-10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0">
          <div
            aria-hidden
            className="w-[420px] h-[420px] opacity-[0.06] md:opacity-[0.08] rounded-full overflow-hidden"
            style={{
              backgroundImage: "url('/assets/usuarios/footera-logo.png')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center 20%",
              backgroundSize: "85% auto",
              filter: "grayscale(100%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-md bg-white shadow-lg rounded-2xl p-7 md:p-8 mx-auto">
          <h2 className="text-xl font-semibold mb-2 text-center">Entrar</h2>
          <p className="text-sm text-center text-gray-600 mb-6">
            Entre com seu nome de usuário e senha
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Nome de usuário</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Seu nome de usuário"
                value={nomeDeUsuario}
                onChange={(e) => setNomeDeUsuario(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                  onClick={() => setMostrarSenha((v) => !v)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="lembrarDeMim"
                checked={lembrarDeMim}
                onChange={(e) => setLembrarDeMim(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="lembrarDeMim" className="text-sm">Lembrar de mim</label>
            </div>

            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}

            <button
              type="submit"
              className="w-full bg-green-900 hover:bg-green-800 text-white font-medium py-2 rounded transition active:scale-[0.98]"
            >
              Entrar
            </button>

            <a href="/esqueci-senha" className="text-green-700 underline text-right text-sm mt-2 block">
              Esqueci minha senha
            </a>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Não tem uma conta?{" "}
            <a href="/cadastro" className="text-green-700 underline">Cadastre-se</a>
          </p>
        </div>
      </div>
    </div>
  );
}
