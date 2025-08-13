import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { API } from "../config";

export default function ResetarSenha() {
  const [, navigate] = useLocation();
  const search = new URLSearchParams(window.location.search);
  const uid = search.get("uid") || "";
  const token = search.get("token") || "";

  const [senha, setSenha] = useState("");
  const [confirm, setConfirm] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !token) {
      setErro("Link inválido. Solicite uma nova redefinição de senha.");
    }
  }, [uid, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk("");

    if (!uid || !token) return;
    if (senha.length < 8) return setErro("A senha deve ter pelo menos 8 caracteres.");
    if (senha !== confirm) return setErro("As senhas não coincidem.");

    setLoading(true);
    try {
      await axios.post(`${API.BASE_URL}/api/auth/reset`, { uid, token, senha });
      setOk("Senha alterada com sucesso! Redirecionando para o login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setErro(err?.response?.data?.message || "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Definir nova senha</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          className="border w-full p-2 rounded"
          placeholder="Nova senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <input
          type="password"
          className="border w-full p-2 rounded"
          placeholder="Confirmar senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {erro && <p className="text-red-600 text-sm">{erro}</p>}
        {ok && <p className="text-green-700 text-sm">{ok}</p>}
        <button
          disabled={loading || !uid || !token}
          className="bg-green-800 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}