import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import { criarPost } from "@/services/feedService.js";

export default function PaginaPostagem() {
  const [, navigate] = useLocation();

  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState(""); 
  const [videoUrl, setVideoUrl] = useState(""); 
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function handleEnviar() {
    setMensagem("");

    if (!descricao.trim() && !imagemUrl.trim() && !videoUrl.trim() && !arquivo) {
      setMensagem("Informe uma descrição ou uma mídia (URL ou arquivo).");
      return;
    }

   const temUrl = !!(imagemUrl.trim() || videoUrl.trim());
    if (temUrl && arquivo) {
      setMensagem("Use URL ou arquivo, não os dois ao mesmo tempo.");
      return;
    }

    setCarregando(true);
    try {
      await criarPost({
        descricao: descricao.trim(),
        imagemUrl: imagemUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        arquivo: arquivo || undefined,
      });

      setMensagem("Postagem enviada com sucesso!");
      setDescricao("");
      setImagemUrl("");
      setVideoUrl("");
      setArquivo(null);

      navigate("/feed");
    } catch (err: any) {
      console.error(err);
      setMensagem(err?.message || "Erro ao enviar a postagem.");
    } finally {
      setCarregando(false);
    }
  }

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
          type="text"
          className="w-full border rounded p-3 mb-2"
          placeholder="URL da imagem (ex.: https://... ou /assets/minha-imagem.jpg)"
          value={imagemUrl}
          onChange={(e) => setImagemUrl(e.target.value)}
        />

        <input
          type="text"
          className="w-full border rounded p-3 mb-4"
          placeholder="URL do vídeo (opcional)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />

        <div className="text-sm text-gray-600 mb-2">— ou —</div>

        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setArquivo(e.target.files?.[0] || null)}
          className="mb-4"
        />

        {mensagem && (
          <p className={`mb-4 text-sm text-center ${mensagem.includes("sucesso") ? "text-green-700" : "text-red-600"}`}>
            {mensagem}
          </p>
        )}

        <button
          onClick={handleEnviar}
          disabled={carregando}
          className="w-full bg-green-800 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {carregando ? "Enviando..." : "Publicar"}
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline"><House /></Link>
        <Link href="/explorar" className="hover:underline"><Search /></Link>
        <Link href="/post" className="hover:underline"><CirclePlus /></Link>
        <Link href="/treinos" className="hover:underline"><Volleyball /></Link>
        <Link href="/perfil" className="hover:underline"><User /></Link>
      </nav>
    </div>
  );
}