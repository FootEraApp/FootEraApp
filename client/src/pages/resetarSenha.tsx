import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { API } from "../config.js";

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

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);

  const senhaValida = useMemo(() => {
    const temMinimo = senha.length >= 8;
    const temLetra = /[A-Za-z]/.test(senha);
    const temNumero = /\d/.test(senha);
    return temMinimo && temLetra && temNumero;
  }, [senha]);

  const confirmPreenchido = confirm.length > 0;
  const senhasCoincidem = confirmPreenchido && senha === confirm;

  useEffect(() => {
    if (!uid || !token) {
      setErro("Link inválido. Solicite uma nova redefinição de senha.");
    }
  }, [uid, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");

    if (!uid || !token) return;

    if (!senhaValida) {
      return setErro("A senha deve ter no mínimo 8 caracteres, com letra e número.");
    }

    if (senha !== confirm) {
      return setErro("As senhas não coincidem.");
    }

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
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl text-green-900 text-center font-semibold mb-6">Definir nova senha</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-green-800 text-sm font-semibold text-[#0f3b2e] mb-2">
              Senha*
            </label>

            <div
              className={`flex items-center rounded-lg border bg-white px-3 ${
                senha.length > 0 && !senhaValida
                  ? "border-red-400"
                  : "border-slate-300"
              }`}
            >
              <input
                type={mostrarSenha ? "text" : "password"}
                className="w-full py-3 outline-none bg-transparent"
                placeholder="Digite sua nova senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="text-slate-500 hover:text-slate-700"
              >
                {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {senha.length > 0 && !senhaValida && (
              <p className="text-red-500 text-sm mt-2">
                Mín. 8 caracteres com letra e número.
              </p>
            )}
          </div>

          <div>
            <label className="block text-green-800 text-sm font-semibold text-[#0f3b2e] mb-2">
              Confirmar Senha*
            </label>

            <div
              className={`flex items-center rounded-lg border bg-white px-3 ${
                confirmPreenchido && !senhasCoincidem
                  ? "border-red-400"
                  : "border-slate-300"
              }`}
            >
              <input
                type={mostrarConfirm ? "text" : "password"}
                className="w-full py-3 outline-none bg-transparent"
                placeholder="Confirme sua nova senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setMostrarConfirm((v) => !v)}
                className="text-slate-500 hover:text-slate-700"
              >
                {mostrarConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {confirmPreenchido && !senhasCoincidem && (
              <p className="text-red-500 text-sm mt-2">
                Senhas não coincidem.
              </p>
            )}
          </div>
        </div>

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