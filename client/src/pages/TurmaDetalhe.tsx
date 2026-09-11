import {
  useEffect,
  useState,
} from "react";

import {
  useLocation,
  useParams,
} from "wouter";

import {
  ArrowLeft,
  Users,
} from "lucide-react";

import {
  API,
} from "../config.js";

type TurmaPublica = {
  id: string;
  nome: string;
  descricao?: string | null;
  categoria?: string[];
  membrosCount: number;
  professoresCount: number;

  organizacao?: {
    tipo: string;
    id: string;
    nome: string;
    logo?: string | null;
    nomeDeUsuario?: string | null;
  } | null;
};

export default function TurmaDetalhe() {
  const { id } =
    useParams<{ id: string }>();

  const [, navigate] =
    useLocation();

  const [turma, setTurma] =
    useState<TurmaPublica | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [erro, setErro] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let ativo = true;

    async function carregar() {
      try {
        setLoading(true);

        const response =
          await fetch(
            `${API.BASE_URL}/api/turmas/publico/${encodeURIComponent(
              id!
            )}`
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Turma não encontrada."
          );
        }

        if (ativo) {
          setTurma(data);
        }
      } catch (error: any) {
        if (ativo) {
          setErro(
            error?.message ||
              "Não foi possível carregar a turma."
          );
        }
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        Carregando turma...
      </div>
    );
  }

  if (erro || !turma) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">
          {erro ||
            "Turma não encontrada."}
        </p>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <button
        onClick={() =>
          window.history.length > 1
            ? window.history.back()
            : navigate("/feed")
        }
        className="mb-6 inline-flex items-center gap-2 text-green-800"
      >
        <ArrowLeft size={18} />
        Voltar
      </button>

      <div className="bg-white rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-green-900">
          {turma.nome}
        </h1>

        {turma.organizacao && (
          <button
            onClick={() => {
              if (
                turma.organizacao
                  ?.nomeDeUsuario
              ) {
                navigate(
                  `/organizacao/${encodeURIComponent(
                    turma.organizacao
                      .nomeDeUsuario
                  )}`
                );
              }
            }}
            className="mt-2 text-green-700 font-medium"
          >
            {turma.organizacao.nome}
          </button>
        )}

        {turma.descricao && (
          <p className="mt-4 text-gray-700 whitespace-pre-line">
            {turma.descricao}
          </p>
        )}

        {!!turma.categoria?.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            {turma.categoria.map(
              (categoria) => (
                <span
                  key={categoria}
                  className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-800"
                >
                  {categoria}
                </span>
              )
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-gray-600">
          <Users size={18} />

          <span>
            {turma.membrosCount}{" "}
            participante
            {turma.membrosCount ===
            1
              ? ""
              : "s"}
          </span>
        </div>
      </div>
    </main>
  );
}