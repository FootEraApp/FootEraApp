import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function PaginaLogin() {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const { login } = useAuth();
  const [_, navigate] = useLocation();
  const [erro, setErro] = useState("");

    if (username) {
  navigate("/"); 
  return null;
}


  const handleLogin = async () => {
    try {
      await login(username, senha);
      navigate("/"); 
    } catch (err) {
      setErro("Nome de usuário ou senha inválidos.");
    }
  };

  return (
    <div className="flex h-screen">

      <div className="w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10">
        <img src="/assets/footera-logo.png" alt="Logo" className="mb-6 w-16" />
        <h1 className="text-3xl font-bold mb-4">Bem-vindo à FootEra</h1>
        <p className="text-center text-lg max-w-md">
          Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar... aqui é o seu lugar.
FootEra. A metodologia dos profissionais, para quem vive futebol.
        </p>

        <div className="mt-10 bg-green-700 p-6 rounded-lg text-sm text-left max-w-md w-full">
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

      <div className="w-1/2 bg-cream flex flex-col justify-center items-center p-10">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-2 text-center">Entrar</h2>
          <p className="text-sm text-center text-gray-600 mb-6">
            Entre com seu nome de usuário e senha
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Nome de usuário</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Seu nome de usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}

          <button
            onClick={handleLogin}
            className="w-full bg-green-900 hover:bg-green-800 text-white font-medium py-2 rounded"
          >
            Entrar
          </button>

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
