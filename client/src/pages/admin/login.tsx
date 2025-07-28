import { useState } from "react";

export default function AdminLogin() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    try {
      const response = await fetch("http://localhost:3001/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: usuario, senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErro(data.message || "Erro ao fazer login.");
        return;
      }

      if (data.usuario.tipo === "Admin") {
        localStorage.setItem("user", JSON.stringify(data.usuario));
        localStorage.setItem("token", data.token);
        alert("Seu login como admin foi feito com sucesso!");
        window.location.href = "/admin";
      } else {
        setErro("Você não é um administrador.");
      }

    } catch (err) {
      setErro("Erro de conexão com o servidor.");
    }
  };

  return (
    <div style={{
      background: "linear-gradient(to right, #00c6ff, #7be495)",
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{
        backgroundColor: "white",
        padding: "40px",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0px 0px 12px rgba(0,0,0,0.15)",
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "12px" }}>
          Login Administrativo
        </h2>

        <div style= {{ display: "flex", justifyContent: "center", marginBottom: "10px", textAlign: "center" }}>
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
              border: "1px solid #ccc"
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
              border: "1px solid #ccc"
            }}
          />
          <button type="submit" style={{
            backgroundColor: "#0A4D0F",
            color: "white",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            width: "100%",
            fontWeight: "bold",
            cursor: "pointer"
          }}>
            Entrar
          </button>
          {erro && <p style={{ color: "red", marginTop: "10px" }}>{erro}</p>}
        </form>
      </div>
    </div>
  );
}
