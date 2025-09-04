import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "../../config.js";

function toLower(v: any) {
  return (v ?? "").toString().trim().toLowerCase();
}

export default function AdminLogin() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [, navigate] = useLocation();

  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    const tipo = toLower(
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario")
    );
    if (token && tipo === "admin") navigate("/admin");
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    try {
      const res = await fetch(`${API.BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: usuario, senha }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data?.message || "Erro ao fazer login.");
        return;
      }

      const token: string | undefined = data.token;
      const user = data.usuario ?? data.user ?? {};
      const tipo = toLower(user.tipo ?? data.tipo);
      const isAdmin = tipo === "admin" || user.isAdmin === true || data.isAdmin === true;

      if (!token) {
        setErro("Resposta inválida do servidor (sem token).");
        return;
      }
      if (!isAdmin) {
        setErro("Você não é um administrador.");
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("tipoUsuario", "admin");
      localStorage.setItem("usuarioId", user.id ?? data.id ?? "");
      localStorage.setItem(
        "nomeUsuario",
        user.nomeDeUsuario ?? user.nome ?? user.email ?? ""
      );
      navigate("/admin");
    } catch (err) {
      setErro("Erro de conexão com o servidor.");
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(to right, #00c6ff, #7be495)",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0px 0px 12px rgba(0,0,0,0.15)",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "12px" }}>
          Login Administrativo
        </h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "10px",
            textAlign: "center",
          }}
        >
          <img
            src="/assets/usuarios/footera-logo.png"
            alt="Logo FootEra"
            width={70}
            height={70}
          />
        </div>

        <form onSubmit={handleLogin} style={{ marginTop: "20px" }}>
          <input
            type="email"
            placeholder="Email do Usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: "#0A4D0F",
              color: "white",
              padding: "10px",
              borderRadius: "6px",
              border: "none",
              width: "100%",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
          {erro && <p style={{ color: "red", marginTop: "10px" }}>{erro}</p>}
        </form>
      </div>
    </div>
  );
}