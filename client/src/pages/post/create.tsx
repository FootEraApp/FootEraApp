import { useState } from "react";
import { Link } from "wouter";

export default function PaginaPostagem() {
  const [descricao, setDescricao] = useState("");
  const [mídia, setMídia] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const handleEnviar = async () => {
    if (!descricao || !mídia) {
      setMensagem("Preencha todos os campos.");
      return;
    }

    setCarregando(true);
    const formData = new FormData();
    formData.append("descricao", descricao);
    formData.append("arquivo", mídia);


    try {
      const res = await fetch("http://localhost:3001/api/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          conteudo: descricao,
          tipoMidia: mídia?.type.startsWith("video") ? "Video" : "Imagem",
          imagemUrl: mídia?.name || "", 
          videoUrl: mídia?.name || "",  
        }),
      });

      if (!res.ok) throw new Error("Erro ao enviar");

      setMensagem("Postagem enviada com sucesso!");
      setDescricao("");
      setMídia(null);
    } catch (err) {
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
          onChange={(e) => setMídia(e.target.files?.[0] || null)}
          className="mb-4"
        />

        {mensagem && <p className="mb-4 text-sm text-center text-red-600">{mensagem}</p>}

        <button
          onClick={handleEnviar}
          disabled={carregando}
          className="w-full bg-green-800 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {carregando ? "Enviando..." : "Publicar"}
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">Feed</Link>
        <Link href="/search" className="hover:underline">Explorar</Link>
        <Link href="/post" className="hover:underline">Publicar</Link>
        <Link href="/treinos" className="hover:underline">Treinos</Link>
        <Link href="/perfil" className="hover:underline">Perfil</Link>
      </nav>
    </div>
  );
}