import { useState } from "react";
import { Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import { withAuth } from "@/components/ProtectedRoute";

function PaginaPostagem() {
  const [descricao, setDescricao] = useState("");
  const [midia, setMidia] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const handleEnviar = async () => {
    if (!descricao.trim() && !midia) {
      setMensagem("É necessário pelo menos uma descrição ou uma mídia.");
      return;
    }

    const usuarioId = localStorage.getItem("usuarioId");
    const nomeUsuario = localStorage.getItem("nomeUsuario");
    const token = localStorage.getItem("token");

    if (!usuarioId || !token) {
      setMensagem("Usuário não autenticado.");
      return;
    }

    const formData = new FormData();
    formData.append("descricao", descricao);
    formData.append("usuarioId", usuarioId); 
    formData.append("nomeUsuario", nomeUsuario || "");

    if (midia) {
      formData.append("arquivo", midia);
      formData.append("tipoMidia", midia.type.startsWith("video") ? "Video" : "Imagem");
    }

    setCarregando(true);


    try {
      const res = await fetch("http://localhost:3001/api/post/postar", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const erroTexto = await res.text();
      console.error("❌ Erro do backend:", erroTexto); 
      throw new Error("Erro ao enviar");
    }

      setMensagem("Postagem enviada com sucesso!");
      setDescricao("");
      setMidia(null);
    } catch (err) {
      console.error("❌ Erro completo no frontend:", err);
      setMensagem("Erro ao enviar a postagem.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-green-900">Nova Postagem</h1>

        <textarea
          className="w-full border rounded p-3 mb-4"
          rows={4}
          placeholder="Escreva algo sobre sua postagem..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setMidia(e.target.files?.[0] || null)}
          className="mb-4"
        />

        {mensagem && <p className="mb-4 text-sm text-center text-red-600">{mensagem}</p>}

        <button
          onClick={handleEnviar}
          disabled={carregando}
          className="w-full bg-green-800 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {carregando ? "Enviando..." : "Publicar "}
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          <House /> 
        </Link>
        <Link href="/explorar" className="hover:underline">
          <Search /> 
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus /> 
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball /> 
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User /> 
        </Link>
      </nav>
    </div>
  );
}

export default withAuth(PaginaPostagem);