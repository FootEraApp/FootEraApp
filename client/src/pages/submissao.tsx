import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";

export default function PaginaSubmissao() {
  const [observacao, setObservacao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [treinoAgendadoId, setTreinoAgendadoId] = useState<string | null>(null);
  const [atletaId, setAtletaId] = useState<string | null>(null);

  const [location] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("treinoAgendadoId");
    setTreinoAgendadoId(treinoId);

    const tipoId = localStorage.getItem("tipoUsuarioId");
    if (tipoId) setAtletaId(tipoId);
  }, [location]);

  const handleArquivoChange = (file: File | null) => {
    setArquivo(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleEnviar = async () => {
    if (!treinoAgendadoId || !atletaId || !arquivo) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const formData = new FormData();
    formData.append("observacao", observacao);
    formData.append("arquivo", arquivo);
    formData.append("treinoAgendadoId", treinoAgendadoId);
    formData.append("atletaId", atletaId);

    try {
      const res = await fetch("http://localhost:3001/api/submissoes/treino", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        },
      });

      if (res.ok) {
        alert("Submissão enviada com sucesso!");
      } else {
        const erro = await res.json();
        console.error("Erro:", erro);
        alert("Erro ao enviar submissão.");
      }
    } catch (err) {
      console.error("Erro no envio:", err);
      alert("Erro de conexão ao enviar submissão.");
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 pb-24 px-4 pt-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-green-800 text-center">Enviar Submissão</h1>

        <label className="block text-sm font-medium mb-1 text-gray-700">Observação</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="w-full border p-3 mb-4 rounded-md shadow-sm"
          rows={4}
          placeholder="Digite uma observação sobre seu treino..."
        />

        <label className="block text-sm font-medium mb-1 text-gray-700">Imagem ou Vídeo</label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => handleArquivoChange(e.target.files?.[0] || null)}
          className="mb-4"
        />

        {preview && (
          <div className="mb-4">
            {arquivo?.type.startsWith("image") ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-auto rounded border object-contain"
              />
            ) : (
              <video controls className="w-full rounded border">
                <source src={preview} type={arquivo?.type} />
                Seu navegador não suporta visualização de vídeo.
              </video>
            )}
          </div>
        )}

        <button
          onClick={handleEnviar}
          className="w-full bg-green-800 hover:bg-green-700 text-white py-2 rounded font-semibold"
        >
          Enviar Submissão
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