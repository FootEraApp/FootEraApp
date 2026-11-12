import {
  useEffect,
  useState,
} from "react";
import {
  useLocation,
} from "wouter";
import {
  API,
} from "../../config.js";
import TreinosAtletas from "./treinos-atletas.js";

type AtletaResponsavel = {
  atletaId: string;

  status:
    | "PENDENTE"
    | "ATIVO"
    | "REVOGADO";

  principal:
    boolean;

  podeGerenciarTreinos:
    boolean;

  atleta: {
    id: string;
    usuarioId: string;
    nome: string;
    nomeDeUsuario?: string;
    foto?: string | null;
    idade?: number | null;
  };
};

function getToken() {
  return (
    localStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    ""
  );
}

export default function TreinosResponsavel() {
  const [, navigate] =
  useLocation();
  const [
    atletas,
    setAtletas,
  ] =
    useState<
      AtletaResponsavel[]
    >([]);

  const [
    atletaId,
    setAtletaId,
  ] =
    useState("");

  const [
    carregando,
    setCarregando,
  ] =
    useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const token =
          getToken();

        if (!token) {
          return;
        }

        const resposta =
          await fetch(
            `${API.BASE_URL}/api/responsaveis/me/atletas`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await resposta
            .json()
            .catch(() => ({
              items: [],
            }));

        if (!resposta.ok) {
          throw new Error(
            data?.message ||
              "Erro ao carregar atletas."
          );
        }

        const permitidos =
          (
            Array.isArray(
              data?.items
            )
              ? data.items
              : []
          ).filter(
            (
              item:
                AtletaResponsavel
            ) =>
              item.status ===
                "ATIVO" &&
              (
                item.principal ===
                  true ||
                item
                  .podeGerenciarTreinos ===
                  true
              )
          );

        setAtletas(
          permitidos
        );

        if (
          permitidos.length
        ) {
          setAtletaId(
            permitidos[0]
              .atletaId
          );
        }
      } catch (error) {
        console.error(
          "[TreinosResponsavel]",
          error
        );

        setAtletas([]);
      } finally {
        setCarregando(
          false
        );
      }
    }

    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando atletas...
      </div>
    );
  }

  if (!atletas.length) {
    return (
      <div className="min-h-screen bg-[#f5f2e8] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-green-900">
            Nenhum atleta disponível
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Você ainda não possui um atleta ativo com permissão para gerenciar treinos.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/perfil"
                )
              }
              className="flex-1 rounded-xl border border-green-700 bg-white px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50"
            >
              Voltar para meu perfil
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/explorar"
                )
              }
              className="flex-1 rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900"
            >
              Procurar atletas
            </button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            No Explorar você pode encontrar atletas disponíveis e solicitar um vínculo como responsável.
          </p>
        </div>
      </div>
    );
  }

  const selecionado =
    atletas.find(
      (item) =>
        item.atletaId ===
        atletaId
    ) ??
    atletas[0];

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Gerenciando treinos de
          </p>

          {atletas.length ===
          1 ? (
            <div className="mt-2">
              <p className="font-bold text-green-900">
                {
                  selecionado
                    .atleta.nome
                }
              </p>

              {typeof selecionado
                .atleta
                .idade ===
                "number" && (
                <p className="text-sm text-gray-500">
                  {
                    selecionado
                      .atleta.idade
                  }{" "}
                  anos
                </p>
              )}
            </div>
          ) : (
            <select
              value={
                atletaId
              }
              onChange={(e) =>
                setAtletaId(
                  e.target
                    .value
                )
              }
              className="mt-2 w-full rounded-xl border bg-white px-3 py-3"
            >
              {atletas.map(
                (item) => (
                  <option
                    key={
                      item.atletaId
                    }
                    value={
                      item.atletaId
                    }
                  >
                    {
                      item.atleta
                        .nome
                    }
                  </option>
                )
              )}
            </select>
          )}
        </div>
      </div>

      <TreinosAtletas
        key={
            selecionado.atletaId
        }

        atletaGerenciadoId={
            selecionado.atletaId
        }

        atletaGerenciadoUsuarioId={
            selecionado.atleta.usuarioId
        }

        atletaGerenciadoNome={
            selecionado.atleta.nome
        }
        />
    </div>
  );
}