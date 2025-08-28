// client/src/pages/post/create.tsx
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import { criarPost } from "@/services/feedService.js";
import { API } from "../../config";
import { formatarUrlFoto } from "@/utils/formatarFoto";

// Normaliza caminhos legados e relativos para a API
function normalizeMediaUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";

  // Absoluto (http/https), data, blob -> só corrige /assets -> /uploads
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    return s.replace(/\/assets\/usuarios\//, "/uploads/").replace(/\/assets\//, "/uploads/");
  }

  // Relativo legado /assets/... -> /uploads/...
  s = s.replace(/^\/?assets\/usuarios\//, "/uploads/").replace(/^\/?assets\//, "/uploads/");

  // Prefixa a API quando for /uploads ou uploads
  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/")) return `${API.BASE_URL}/${s}`;

  // Caso tenha vindo só um nome de arquivo, coloque em /uploads/
  if (!s.startsWith("/")) s = `/${s}`;
  return `${API.BASE_URL}/uploads${s}`;
}

export default function PaginaPostagem() {
  const [, navigate] = useLocation();

  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState(""); 
  const [videoUrl, setVideoUrl] = useState(""); 
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const temUrl = useMemo(() => !!(imagemUrl.trim() || videoUrl.trim()), [imagemUrl, videoUrl]);

  async function handleEnviar() {
    setMensagem("");

    if (!descricao.trim() && !imagemUrl.trim() && !videoUrl.trim() && !arquivo) {
      setMensagem("Informe uma descrição ou uma mídia (URL ou arquivo).");
      return;
    }

    if (temUrl && arquivo) {
      setMensagem("Use URL ou arquivo, não os dois ao mesmo tempo.");
      return;
    }

    setCarregando(true);
    try {
      const img = imagemUrl.trim() ? normalizeMediaUrl(imagemUrl) : undefined;
      const vid = videoUrl.trim() ? normalizeMediaUrl(videoUrl) : undefined;

      await criarPost({
        descricao: descricao.trim(),
        imagemUrl: img,
        videoUrl: vid,
        arquivo: arquivo || undefined, // se houver arquivo, o service faz o upload
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

  // Pré-visualização
  const preview = (() => {
    if (arquivo) {
      const isVideo = arquivo.type?.startsWith("video/");
      const url = URL.createObjectURL(arquivo);
      return isVideo ? (
        <video src={url} controls className="w-full rounded-lg shadow mb-3" />
      ) : (
        <img src={url} className="w-full rounded-lg shadow mb-3 object-cover" />
      );
    }
    if (imagemUrl.trim()) {
      return <img src={formatarUrlFoto(imagemUrl)} className="w-full rounded-lg shadow mb-3 object-cover" />;
    }
    if (videoUrl.trim()) {
      return <video src={normalizeMediaUrl(videoUrl)} controls className="w-full rounded-lg shadow mb-3" />;
    }
    return null;
  })();

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
          placeholder="URL da imagem (ex.: https://... ou /uploads/minha-imagem.jpg)"
          value={imagemUrl}
          onChange={(e) => setImagemUrl(e.target.value)}
          disabled={!!arquivo}
        />

        <input
          type="text"
          className="w-full border rounded p-3 mb-4"
          placeholder="URL do vídeo (opcional)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          disabled={!!arquivo}
        />

        <div className="text-sm text-gray-600 mb-2">— ou —</div>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            disabled={temUrl}
          />
          {arquivo && (
            <button
              type="button"
              onClick={() => setArquivo(null)}
              className="text-xs text-red-600 underline"
            >
              Remover arquivo
            </button>
          )}
        </div>

        {preview}

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
