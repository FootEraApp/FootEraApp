import {
  useCallback,
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
  UserPlus,
  Share2,
  CheckCircle2,
} from "lucide-react";

import {
  API,
} from "../config.js";

import {
  useAuthGate,
} from "../context/AuthGateContext.js";

import {
  lerAcaoPendenteAuth,
  limparAcaoPendenteAuth,
} from "../utils/authSession.js";

import {
  toast,
} from "@/lib/toast";

import PublicShareModal from "../components/share/PublicShareModal.js";

import {
  PUBLIC_PATHS,
} from "../utils/publicRoutes.js";

type TurmaPublica = {
  id: string;
  nome: string;
  descricao?: string | null;
  categoria?: string[];
  membrosCount: number;
  professoresCount: number;
  vagas?: number | null;
  vagasDisponiveis?: number | null;
  lotada?: boolean;

  participando?: boolean;
  podeParticipar?: boolean;
  
  organizacao?: {
    tipo: string;
    id: string;
    nome: string;
    logo?: string | null;
    nomeDeUsuario?: string | null;
  } | null;
  responsavel?: {
    tipo: string;
    id: string;
    nome: string;
    foto?: string | null;
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

  const {
    requireAuth,
  } = useAuthGate();

  const [
    participandoLoading,
    setParticipandoLoading,
  ] = useState(false);

  const [
    shareOpen,
    setShareOpen,
  ] =
    useState(false);

  const participar =
  useCallback(
    async (
      retomandoAposAuth = false
    ) => {
      if (!id) return;

      const retorno =
        `/turma/${encodeURIComponent(
          id
        )}`;

      const authOptions = {
        message:
          "Entre na FootEra para participar desta turma.",

        returnTo:
          retorno,

        action: {
          type:
            "JOIN_TURMA" as const,

          turmaId:
            String(id),
        },
      };

      if (
        !retomandoAposAuth &&
        !requireAuth(
          authOptions
        )
      ) {
        return;
      }

      const token =
        localStorage.getItem(
          "token"
        ) ||
        sessionStorage.getItem(
          "token"
        );

      if (!token) {
        requireAuth(
          authOptions
        );

        return;
      }

      try {
        setParticipandoLoading(
          true
        );

        const response =
          await fetch(
            `${API.BASE_URL}/api/turmas/${encodeURIComponent(
              id
            )}/participar`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Não foi possível participar da turma."
          );
        }

        limparAcaoPendenteAuth();

        setTurma((atual) => {
          if (!atual) {
            return atual;
          }

          const novasVagasDisponiveis =
            data.vagasDisponiveis ??
            atual.vagasDisponiveis;

          return {
            ...atual,

            participando: true,

            membrosCount:
              Number(
                data.membrosCount ??
                  atual.membrosCount
              ),

            vagasDisponiveis:
              novasVagasDisponiveis,

            lotada:
              atual.vagas != null &&
              novasVagasDisponiveis ===
                0,
          };
        });

        toast.success(
          "Você entrou na turma."
        );
      } catch (error: any) {
        limparAcaoPendenteAuth();

        toast.error(
          error?.message ||
            "Não foi possível participar da turma."
        );
      } finally {
        setParticipandoLoading(
          false
        );
      }
    },
    [
      id,
      requireAuth,
    ]
  );

  useEffect(() => {
    if (!id) return;

    const token =
      localStorage.getItem(
        "token"
      ) ||
      sessionStorage.getItem(
        "token"
      );

    if (!token) return;

    const action =
      lerAcaoPendenteAuth();

    if (
      action?.type !==
        "JOIN_TURMA" ||
      action.turmaId !==
        String(id)
    ) {
      return;
    }

    void participar(true);
  }, [
    id,
    participar,
  ]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let ativo = true;

    async function carregar() {
      try {
        setLoading(true);
        setErro(null);

        const tokenAtual =
        localStorage.getItem(
          "token"
        ) ||
        sessionStorage.getItem(
          "token"
        );
        
        const response =
          await fetch(
            `${API.BASE_URL}/api/turmas/publico/${encodeURIComponent(
              id!
            )}`,
            {
              headers:
                tokenAtual
                  ? {
                      Authorization:
                        `Bearer ${tokenAtual}`,
                    }
                  : undefined,
            }
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

        {turma.responsavel && (
          <button
            type="button"
            onClick={() => {
              const ref =
                turma.responsavel
                  ?.nomeDeUsuario ||
                turma.responsavel?.id;

              if (!ref) {
                return;
              }

              const tipo =
                String(
                  turma.responsavel
                    ?.tipo || ""
                ).toLowerCase();

              if (
                tipo === "clube" ||
                tipo === "escolinha"
              ) {
                navigate(
                  `/organizacao/${encodeURIComponent(
                    ref
                  )}`
                );

                return;
              }

              navigate(
                `/profile/${encodeURIComponent(
                  ref
                )}`
              );
            }}
            className="mt-3 flex items-center gap-3 text-left"
          >
            {turma.responsavel.foto ? (
              <img
                src={
                  turma.responsavel.foto
                }
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-green-100" />
            )}

            <div>
              <div className="text-xs text-gray-500">
                Responsável pela turma
              </div>

              <div className="font-semibold text-green-800">
                {
                  turma.responsavel
                    .nome
                }
              </div>
            </div>
          </button>
        )}

        {turma.descricao && (
          <p className="mt-4 text-gray-700 whitespace-pre-line">
            {turma.descricao}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-4 text-gray-600">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <span>
              {turma.vagas != null
                ? `${turma.membrosCount} / ${turma.vagas} participantes`
                : `${turma.membrosCount} participante${
                    turma.membrosCount === 1
                      ? ""
                      : "s"
                  }`}
            </span>

            {turma.vagasDisponiveis != null && (
              <span>
                {turma.vagasDisponiveis === 0
                  ? "Turma lotada"
                  : `${turma.vagasDisponiveis} vaga${
                      turma.vagasDisponiveis === 1
                        ? ""
                        : "s"
                    } disponível${
                      turma.vagasDisponiveis === 1
                        ? ""
                        : "is"
                    }`}
              </span>
            )}
          </div>

          <div>
            {turma.professoresCount} professor
            {turma.professoresCount === 1 ? "" : "es"}
          </div>
        </div>

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

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() =>
              setShareOpen(
                true
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-700 px-4 py-3 font-semibold text-green-800 hover:bg-green-50"
          >
            <Share2 size={18} />
            Compartilhar
          </button>

          {turma && (
            <PublicShareModal
              open={shareOpen}
              onClose={() =>
                setShareOpen(
                  false
                )
              }
              titulo={
                turma.nome
              }
              path={PUBLIC_PATHS.turma(
                turma.id
              )}
              destinatarioPapel="Atleta"
            />
          )}

          {turma.participando ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-100 px-4 py-3 font-semibold text-green-800"
            >
              <CheckCircle2
                size={18}
              />

              Participando
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                void participar(false)
              }
              disabled={
                participandoLoading ||
                turma.lotada === true
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-4 py-3 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
            >
              <UserPlus size={18} />

              {participandoLoading
                ? "Entrando..."
                : turma.lotada
                ? "Turma lotada"
                : "Participar"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}