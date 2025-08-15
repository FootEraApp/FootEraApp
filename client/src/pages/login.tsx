import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import logo from "/assets/usuarios/footera-logo.png";
import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

export default function PaginaLogin() {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrarDeMim, setLembrarDeMim] = useState(false);
  const [erro, setErro] = useState("");
  const [_, navigate] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    if (!nomeDeUsuario || !senha) {
      setErro("Por favor, preencha todos os campos.");
      return;
    }

    try {
      const resp = await axios.post(`${API.BASE_URL}/api/auth/login`, {
        nomeDeUsuario,
        senha,
      });

      const data = resp.data ?? {};
      const token: string | undefined = data.token;

      const usuario = data.usuario ?? {};
      const usuarioId = usuario.id ?? data.id ?? "";
      const usuarioNome = usuario.nomeDeUsuario ?? data.nomeDeUsuario ?? "";
      const tipoOriginal: string | undefined = usuario.tipo ?? data.tipo;

      if (!token || !usuarioId) {
        throw new Error("Resposta inválida do servidor");
      }

      const storage = lembrarDeMim ? localStorage : sessionStorage;
      storage.setItem("token", token);
      storage.setItem("usuarioId", usuarioId);
      storage.setItem("nomeUsuario", usuarioNome);

      const t = (tipoOriginal ?? "").toLowerCase();
      const tipoPadrao =
        t === "atleta" ? "atleta" :
        t === "escolinha" ? "escola" :
        t === "clube" ? "clube" :
        t === "professor" ? "professor" : null;

      if (tipoPadrao) storage.setItem("tipoUsuario", tipoPadrao);
      if (data.tipoUsuarioId) storage.setItem("tipoUsuarioId", String(data.tipoUsuarioId));

      navigate("/feed");
    } catch (err) {
      console.error("Erro no login:", err);
      setErro("Nome de usuário ou senha inválidos.");
    }
  };

  useEffect(() => {
    const token = Storage.token;
    if (token) {
      navigate("/feed");
    }
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="md:w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10">
        <img src={logo} alt="Logo FootEra" className="w-20 mb-4" />
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
              <input
                type="password"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
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