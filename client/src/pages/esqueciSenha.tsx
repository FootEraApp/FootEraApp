import { useState } from "react";
import axios from "axios";
import { API } from "../config";
import logo from "/assets/usuarios/footera-logo.png";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

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
      <div className="md:w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10">
        <img src={logo} alt="Logo FootEra" className="w-24 mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Bem-vindo à FootEra
        </h1>
        <p className="text-center text-lg max-w-md">
          Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar...
          aqui é o seu lugar. FootEra. A metodologia dos profissionais, para quem vive futebol.
        </p>

        <ul className="mt-8 text-base max-w-md w-full list-disc list-inside space-y-1">
          <li>Treinamentos personalizados</li>
          <li>Desafios para testar suas habilidades</li>
          <li>Compartilhe seu progresso com a comunidade</li>
          <li>Conecte-se com escolinhas e clubes profissionais</li>
          <li>Acompanhe sua evolução com pontuações e rankings</li>
        </ul>
      </div>

      <div className="md:w-1/2 flex items-center justify-center p-10">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
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
