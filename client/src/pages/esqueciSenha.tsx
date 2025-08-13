import { useState } from "react";
import axios from "axios";
import { API } from "../config";
import logo from "/assets/usuarios/footera-logo.png";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const emailValido = /\S+@\S+\.\S+/.test(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk("");

    if (!emailValido) {
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
    
    <div className="max-w-md mx-auto p-6">
      <div className="w-full lg:w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10 mb-5">
      <img src={logo} alt="Logo FootEra" className="w-20 mb-4" />
              <h1 className="text-3xl font-bold mb-4">Bem-vindo à FootEra</h1>
        </div>     
      <h1 className="text-2xl text-green-800 font-semibold mb-4">Redefinir senha</h1>
      <p className="text-green-900 mb-3 text-base"> Enviaremos um email com instruções de como redefinir sua senha. Informe o email correto.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="border w-full p-2 rounded"
          placeholder="Seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        {ok && <p className="text-green-700 text-sm">{ok}</p>}
        <button
          disabled={loading}
          className="bg-green-800 text-center text-white p-2 rounded mt-2"
        >
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </button>
        <p className="text-center text-sm mt-3">
          <a href="/login" className="text-green-700 underline">Volte à pagina de login</a>
        </p>
      </form>
    </div>
  );
}