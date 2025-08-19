import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export default function SubmissaoDesafioEmGrupo() {
  const { grupoId, desafioId } = useParams<{ grupoId: string; desafioId: string }>();
  const [, setLocation] = useLocation();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setErrorMsg("Selecione um vídeo para enviar.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      const formData = new FormData();
      formData.append("arquivo", videoFile);

      const uploadRes = await fetch(`${API.BASE_URL}/api/desafios/upload/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ Storage.token || ""}`,
        },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Erro ao enviar o vídeo");

      const uploadData = await uploadRes.json();
      const videoUrl = uploadData.url;

      const res = await fetch(`${API.BASE_URL}/api/desafios/submissoes-grupo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          desafioId,        
          desafioEmGrupoId: grupoId, 
          videoUrl,
          observacao,
        }),
      });

      if (!res.ok) throw new Error("Erro ao criar submissão");

      setSuccessMsg("Submissão enviada com sucesso!");
      setTimeout(() => setLocation(`/desafios/${desafioId}`), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Submeter desafio em grupo</h1>

      {errorMsg && <p className="text-red-500 mb-2">{errorMsg}</p>}
      {successMsg && <p className="text-green-500 mb-2">{successMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Vídeo</label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Escreva uma observação (opcional)"
            className="border p-2 rounded w-full"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar Submissão"}
        </button>
      </form>
    </div>
  );
}