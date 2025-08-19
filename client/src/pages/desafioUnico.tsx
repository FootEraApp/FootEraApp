import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Volleyball, ArrowLeft } from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  imagemUrl?: string | null;
  nivel?: string | null;
  pontos?: number | null;
  categoria?: string[];
  createdAt: string;
}

export default function DesafioUnico() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [desafio, setDesafio] = useState<Desafio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchDesafio() {
      setLoading(true);
      setErro(null);
      try {
        const res = await fetch(`${API.BASE_URL}/api/desafios/${id}`, {
          headers: { Authorization: `Bearer ${Storage.token}` },
        });

        if (!res.ok) {
          if (res.status === 404) setErro("Desafio não encontrado.");
          else setErro("Erro ao carregar desafio.");
          setDesafio(null);
          setLoading(false);
          return;
        }

        const data: Desafio = await res.json();
        setDesafio(data);
      } catch (e) {
        setErro("Erro ao carregar desafio.");
        setDesafio(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDesafio();
  }, [id]);

  if (loading)
    return (
      <div className="p-6 text-center text-gray-600">Carregando desafio...</div>
    );

  if (erro)
    return (
      <div className="p-6 text-center text-red-600">
        {erro}
        <button
          onClick={() => setLocation("/treinos")}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>
    );

  if (!desafio) return null;

  const imagemSrc =
    desafio.imagemUrl && desafio.imagemUrl.startsWith("http")
      ? desafio.imagemUrl
      : desafio.imagemUrl
      ? `${API.BASE_URL}${desafio.imagemUrl}`
      : null;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => setLocation("/treinos")}
        className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800"
      >
        <ArrowLeft size={18} />
        Voltar à lista
      </button>

      <h1 className="text-3xl font-bold mb-4 text-gray-800">{desafio.titulo}</h1>

      {imagemSrc && (
        <img
          src={imagemSrc}
          alt={desafio.titulo}
          className="w-full max-h-96 object-cover rounded mb-6"
        />
      )}

      <div className="mb-4">
        <span className="inline-block bg-yellow-100 text-yellow-800 font-semibold px-3 py-1 rounded">
          {desafio.nivel ?? "Nível não informado"}
        </span>
      </div>

      <p className="text-gray-700 mb-6 whitespace-pre-line">{desafio.descricao}</p>

      <div className="flex flex-wrap gap-4 text-gray-600 text-sm mb-6">
        <div>
          <strong>Pontos:</strong> {desafio.pontos ?? "-"}
        </div>
        {desafio.categoria && desafio.categoria.length > 0 && (
          <div>
            <strong>Categoria:</strong> {desafio.categoria.join(", ")}
          </div>
        )}
        <div>
          <strong>Criado em:</strong>{" "}
          {new Date(desafio.createdAt).toLocaleDateString("pt-BR")}
        </div>
      </div>
    </main>
  );
}