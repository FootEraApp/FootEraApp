// client/src/pages/treinos
import {
  useContext,
  useMemo,
} from "react";
import {
  UserContext,
} from "../context/UserContext.js";
import TreinosAtletas from "./treino/treinos-atletas.js";
import TreinosInstrutores from "./treino/treinos-instrutores.js";

type Tipo =
  | "admin"
  | "atleta"
  | "escola"
  | "escolinha"
  | "clube"
  | "professor"
  | "olheiro"
  | "federacao"
  | "marca"
  | "learning"
  ;

export default function Treinos() {
  const authContext =
    useContext(
      UserContext
    );

  const activeContext =
    authContext
      ?.activeContext ??
    null;

  const tipo =
    useMemo<Tipo | null>(
      () => {
        if (!activeContext) {
          return null;
        }

        /*
        * Em organização,
        * a tela é de instrutor/gestão.
        */
        if (
          activeContext.kind ===
          "ORGANIZATION"
        ) {
          const orgTipo =
            String(
              activeContext
                .organizationType ??
              ""
            ).toUpperCase();

          if (
            orgTipo === "CLUBE"
          ) {
            return "clube";
          }

          if (
            orgTipo === "ESCOLA"
          ) {
            return "escolinha";
          }

          return null;
        }

        const raw =
          String(
            authContext
              ?.activeTipoUsuario ??
            ""
          )
            .trim()
            .toLowerCase();

        const map:
          Record<string, Tipo> =
          {
            admin:
              "admin",

            atleta:
              "atleta",

            professor:
              "professor",

            clube:
              "clube",

            escolinha:
              "escolinha",

            escola:
              "escola",

            olheiro:
              "olheiro",

            federacao:
              "federacao",

            marca:
              "marca",

            learning:
              "learning",
          };

        return (
          map[raw] ??
          null
        );
      },
      [
        activeContext?.key,
        activeContext?.kind,
        activeContext
          ?.organizationType,
        authContext
          ?.activeTipoUsuario,
      ]
    );

    if (!tipo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Carregando treinos...
      </div>
    );
  }

  if (tipo === "learning") {
    return (
      <div className="min-h-screen bg-[#f5f2e8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-6 max-w-md text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-green-900">
            Treinos disponíveis para perfis esportivos
          </h1>

          <p className="text-green-900/70 mt-2">
            Sua conta Learning foi criada para acessar cursos, lives e metodologias.
            Para usar treinos, escolha um perfil como atleta, professor, clube ou escolinha.
          </p>

          <button
            onClick={() => (window.location.href = "/perfil/mudar-tipo")}
            className="mt-5 w-full rounded-xl bg-green-700 px-4 py-3 text-white font-bold"
          >
            Mudar tipo de perfil
          </button>

          <button
            onClick={() => (window.location.href = "/perfil")}
            className="mt-3 w-full rounded-xl border border-green-700 px-4 py-3 text-green-800 font-bold"
          >
            Voltar ao perfil
          </button>
        </div>
      </div>
    );
  }

  if (tipo === "marca" || tipo === "federacao") {
    return (
      <div className="min-h-screen bg-[#f5f2e8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-6 max-w-md text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-green-900">
            Treinos indisponíveis para este tipo de perfil
          </h1>

          <p className="text-green-900/70 mt-2">
            Perfis do tipo{" "}
            <strong>{tipo === "marca" ? "Marca" : "Federação"}</strong>{" "}
            não têm acesso à página de treinos. Essa área é voltada para atletas,
            professores, clubes e escolinhas.
          </p>

          <p className="text-green-900/70 mt-3">
            Para acompanhar conteúdos, eventos, métricas e informações do seu perfil,
            acesse o painel Creator.
          </p>

          <button
            onClick={() => (window.location.href = "/creator/dashboard")}
            className="mt-5 w-full rounded-xl bg-green-700 px-4 py-3 text-white font-bold"
          >
            Ir para o painel Creator
          </button>

          <button
            onClick={() => (window.location.href = "/perfil")}
            className="mt-3 w-full rounded-xl border border-green-700 px-4 py-3 text-green-800 font-bold"
          >
            Voltar ao perfil
          </button>
        </div>
      </div>
    );
  }

  if (
    activeContext?.kind ===
      "PERSONAL" &&
    tipo === "atleta"
  ) {
    return (
      <TreinosAtletas />
    );
  }

  return <TreinosInstrutores tipo={tipo} />;
}