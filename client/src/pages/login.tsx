import { useState } from "react";
import { useLocation } from "wouter";
import logo from "/assets/usuarios/footera-logo.png"; 
import axios from "axios";

export default function PaginaLogin() {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [_, navigate] = useLocation();
  const [erro, setErro] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    setErro(""); 
    e.preventDefault();

    if (!nomeDeUsuario || !senha) {
      return setErro("Por favor, preencha todos os campos.");
    }

    try {
      const resposta = await axios.post("http://localhost:3001/api/auth/login", {
        nomeDeUsuario,
        senha,
      });

      localStorage.setItem("token", resposta.data.token);

      localStorage.setItem("nomeUsuario", resposta.data.nome);
      localStorage.setItem("usuarioId", resposta.data.id);

      const tipoOriginal = resposta.data.tipo;
      const tipoFormatado = tipoOriginal.toLowerCase();

      let tipoPadrao: 'atleta' | 'escola' | 'clube' | 'professor' | null = null;

      if (tipoFormatado === 'atleta') tipoPadrao = 'atleta';
      if (tipoFormatado === 'escolinha') tipoPadrao = 'escola';
      if (tipoFormatado === 'clube') tipoPadrao = 'clube';
      if (tipoFormatado === 'professor') tipoPadrao = 'professor';

      if (tipoPadrao) {
        localStorage.setItem("tipoUsuario", tipoPadrao);
      } else {
        console.warn("Tipo de usuário não reconhecido:", tipoOriginal);
      }

      if (resposta.data.tipoUsuarioId) {
        localStorage.setItem("tipoUsuarioId", resposta.data.tipoUsuarioId);
      }
      
      navigate("/feed");
    } catch (err: any) {
      console.error(err);
      setErro("Nome de usuário ou senha inválidos.");
    }
  };

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