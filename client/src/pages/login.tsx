import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.7 21.7 0 0 1-3.2 4.49" />
      <line x1="1" y1="1" x2="23" y2="23" />
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
      const isAdmin =
        usuario.tipo === "Admin" || String(usuario.tipo).toLowerCase() === "admin";
      const token = data.token;

      if (!token || !usuarioId) throw new Error("Resposta inválida do servidor");

      const store = lembrarDeMim ? localStorage : sessionStorage;
      store.setItem("token", token);
      store.setItem("usuarioId", usuarioId);
      store.setItem("nomeUsuario", usuarioNome);

      const tipoPadrao =
        isAdmin ? "admin" :
        rawTipo === "escolinha" ? "escola" :
        rawTipo === "clube"     ? "clube" :
        rawTipo === "professor" ? "professor" :
        rawTipo === "olheiro"   ? "olheiro" :
        "atleta";

      store.setItem("tipoUsuario", tipoPadrao);
      store.setItem("usuarioTipoRaw", rawTipo);

      const tipoUsuarioId =
        data.tipoUsuarioId ||
        data?.olheiro?.id ||
        data?.professor?.id ||
        data?.clube?.id ||
        data?.escolinha?.id ||
        data?.atleta?.id ||
        null;

      if (tipoUsuarioId) {
        store.setItem("tipoUsuarioId", String(tipoUsuarioId));
      }

      navigate(isAdmin ? "/admin" : "/feed");
    } catch (err: any) {
      console.error("Erro no login:", err.response?.status, err.response?.data || err.message);
      setErro(err.response?.data?.message || "Nome de usuário ou senha inválidos.");
    }
  };

  useEffect(() => {
    const token =
      Storage.token || localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) return;

    const tipo =
      (localStorage.getItem("tipoUsuario") ||
        sessionStorage.getItem("tipoUsuario") ||
        "")
        .toLowerCase();

    navigate(tipo === "admin" ? "/admin" : "/feed");
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="md:w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10">
        <img src="/assets/usuarios/footera-logo.png" alt="Logo FootEra" className="w-20 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Bem-vindo à FootEra</h1>
        <p className="text-center text-lg max-w-md">
          Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar... aqui é o seu lugar.
          FootEra. A metodologia dos profissionais, para quem vive futebol.
        </p>

        <div className="mt-10 p-6 rounded-lg text-base text-left max-w-md w-full">
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

      <div className="md:w-1/2 bg-cream flex flex-col justify-center items-center p-10">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
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
              <label htmlFor="lembrarDeMim" className="text-sm">
                Lembrar de mim
              </label>
            </div>

            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}

            <button
              type="submit"
              className="w-full bg-green-900 hover:bg-green-800 text-white font-medium py-2 rounded"
            >
              Entrar
            </button>

            <a href="/esqueci-senha" className="text-green-700 underline text-right text-sm mt-2 block">
              Esqueci minha senha
            </a>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Não tem uma conta?{" "}
            <a href="/cadastro" className="text-green-700 underline">
              Cadastre-se
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
