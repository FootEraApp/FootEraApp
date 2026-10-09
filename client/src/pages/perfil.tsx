//client/src/pages/perfil
import { useEffect, useState, useContext, useRef } from "react";
import { useParams, useLocation } from "wouter";
import axios from "axios";
import Storage from "../utils/storage.js";

import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";
import PerfilOlheiro from "../components/perfil/PerfilOlheiro.js";
import PerfilLearning from "@/components/perfil/PerfilLearning.js";
import PerfilMarca from "@/components/perfil/PerfilMarca.js";
import PerfilFederacao from "@/components/perfil/PerfilFederacao.js";
import PerfilResponsavel from "../components/perfil/PerfilResponsavel.js";
import { clearAuthSession } from "../utils/authSession.js";
import HealthBanner from "../components/legal/HealthBanner.js";
import SubscriptionBanner from "../components/billing/SubscriptionBanner.js";
import { http } from "../services/http.js";
import BottomNav from "@/components/layout/BottomNav.js";
import {
  UserContext,
} from "../context/UserContext.js";
import { API } from "../config.js";

type TipoPerfil =
  | "Atleta"
  | "Professor"
  | "Clube"
  | "Escolinha"
  | "Admin"
  | "Olheiro"
  | "Learning"
  | "Federacao"
  | "Marca"
  | "Responsavel";

interface PerfilMinimo {
  tipo: TipoPerfil;
  usuario: { id: string };
}

type AssinaturaLite = {
  id: string;
  usuarioId: string;
  plano: string;
  startsAt: string;
  canceledAt: string | null;
  ativo: boolean;
};

function tipoPerfilDoActiveContext(
  contexto: any
): TipoPerfil | null {
  if (!contexto) {
    return null;
  }

  const kind =
    String(
      contexto.kind ?? ""
    ).toUpperCase();

  /*
   * Contexto organizacional representa
   * a organização, independentemente
   * da função exercida nela.
   */
  if (
    kind ===
    "ORGANIZATION"
  ) {
    const tipoOrganizacao =
      String(
        contexto.organizationType ??
          ""
      ).toUpperCase();

    switch (
      tipoOrganizacao
    ) {
      case "CLUBE":
        return "Clube";

      case "ESCOLA":
      case "ESCOLINHA":
        return "Escolinha";

      case "MARCA":
        return "Marca";

      case "FEDERACAO":
        return "Federacao";

      default:
        return null;
    }
  }

  const papel =
    String(
      contexto.tipoUsuario ??
        contexto.role ??
        ""
    )
      .trim()
      .toLowerCase();

  switch (papel) {
    case "atleta":
      return "Atleta";
    
    case "responsavel":
      return "Responsavel";

    case "professor":
      return "Professor";

    case "olheiro":
      return "Olheiro";

    case "learning":
      return "Learning";

    case "clube":
      return "Clube";

    case "escola":
    case "escolinha":
      return "Escolinha";

    case "marca":
      return "Marca";

    case "federacao":
      return "Federacao";

    case "admin":
      return "Admin";

    default:
      return null;
  }
}

export default function ProfilePage() {
  const { id: idDaUrl } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assinatura, setAssinatura] = useState<AssinaturaLite | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [hasCreator, setHasCreator] = useState(false);

  const userContext =
    useContext(
      UserContext
    );

  const activeContext =
    userContext
      ?.activeContext ??
    null;
  
  const papelSolicitado = (() => {
    const papel = new URLSearchParams(
      window.location.search
    ).get("papel")?.toLowerCase();

    if (papel === "atleta") {
      return "Atleta" as const;
    }

    if (papel === "responsavel") {
      return "Responsavel" as const;
    }

    return null;
  })();

  const [erroTrocaPapel, setErroTrocaPapel] =
    useState<string | null>(null);

  const [atualizandoPapel, setAtualizandoPapel] =
    useState(false);

  const tentouCarregarContextos = useRef(false);
  const [consultaContextosConcluida, setConsultaContextosConcluida] =
    useState(false);

  const loggedUsuarioId =
    String(
      userContext
        ?.user
        ?.id ??
      ""
    );

  const token = Storage.token;

  const isOwnProfile = !idDaUrl || idDaUrl === loggedUsuarioId;
  
  useEffect(() => {
    if (!papelSolicitado || !isOwnProfile || !userContext) {
      return;
    }

    const papelAtual = String(
      userContext.activeContext?.tipoUsuario ?? ""
    ).toLowerCase();

    const contextoCorreto =
      userContext.activeContext?.kind === "PERSONAL" &&
      papelAtual === papelSolicitado.toLowerCase();

    if (contextoCorreto) {
      setErroTrocaPapel(null);
      setAtualizandoPapel(false);
      return;
    }

    if (
      userContext.contextsLoading ||
      atualizandoPapel ||
      erroTrocaPapel
    ) {
      return;
    }

    if (
      userContext.contexts.length === 0 &&
      !consultaContextosConcluida
    ) {
      if (!tentouCarregarContextos.current) {
        tentouCarregarContextos.current = true;

        void userContext.refreshActiveContexts()
          .finally(() => {
            setConsultaContextosConcluida(true);
          });
      }

      return;
    }

    const destino = userContext.contexts.find(
      (contexto) =>
        contexto.kind === "PERSONAL" &&
        String(
          contexto.tipoUsuario ?? ""
        ).toLowerCase() === papelSolicitado.toLowerCase()
    );

    if (!destino) {
      setErroTrocaPapel(
        `O perfil de ${papelSolicitado} não está disponível nesta conta.`
      );
      return;
    }

    setAtualizandoPapel(true);

    void userContext
      .switchActiveContext(destino.key)
      .then(() => {
        setErroTrocaPapel(null);
      })
      .catch((error) => {
        console.error(
          "[Perfil] Falha ao trocar contexto:",
          error
        );

        setErroTrocaPapel(
          "Não foi possível selecionar o perfil solicitado."
        );
      })
      .finally(() => {
        setAtualizandoPapel(false);
      });
  }, [
    papelSolicitado,
    isOwnProfile,
    userContext?.activeContext?.key,
    userContext?.contexts,
    userContext?.contextsLoading,
    userContext?.refreshActiveContexts,
    userContext?.switchActiveContext,
    atualizandoPapel,
    erroTrocaPapel,
  ]);

  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);
  const tipoContextoAtivo =
    isOwnProfile
      ? tipoPerfilDoActiveContext(
          activeContext
        )
      : null;

  const tipoRender =
    tipoContextoAtivo ??
    tipo;

  const activeProfileKey =
    isOwnProfile
      ? (
          activeContext?.key ??
          `${tipoRender ?? "perfil"}:me`
        )
      : `${
          tipoRender ??
          "perfil"
        }:${idDaUrl ?? ""}`;

  function handleLogoutAndLogin() {
    clearAuthSession();

    window.location.replace(
      "/login"
    );
  }

  useEffect(() => {
    if (!usuarioId || !token) return;

    const tipoNorm =
      String(
        tipoRender || ""
      ).toLowerCase();

    if (
      tipoNorm ===
        "atleta" ||
      tipoNorm ===
        "learning" ||
      tipoNorm ===
        "responsavel"
    ) {
      setHasCreator(false);
      return;
    }

    let cancelled = false;

    fetch(`${API.BASE_URL}/api/creator/profile/${usuarioId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!cancelled) setHasCreator(r.ok);
      })
      .catch(() => {
        if (!cancelled) setHasCreator(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usuarioId, token, tipoRender]);

  useEffect(() => {
    if (!token) {
      window.location.replace("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const ehResponsavel =
        isOwnProfile &&
        activeContext?.kind ===
          "PERSONAL" &&
        String(
          activeContext
            ?.tipoUsuario ??
            activeContext?.role ??
            ""
        )
          .trim()
          .toLowerCase() ===
          "responsavel";

      if (ehResponsavel) {
        setTipo(
          "Responsavel"
        );

        setUsuarioId(
          loggedUsuarioId
        );

        setLoading(false);

        return;
      }
      try {
        const { data } = await http.get<PerfilMinimo>(`/api/perfil/${basePerfil}`);
        if (cancelled) return;

        setTipo(data?.tipo ?? null);
        setUsuarioId(data?.usuario?.id ?? null);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          console.warn("Token ausente/ inválido. Redirecionando para login.");
          window.location.href = "/login";
          return;
        }
        console.error("Erro ao carregar tipo do perfil:", err);
        setTipo(null);
        setUsuarioId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [idDaUrl, token, basePerfil, activeContext?.key]);

  useEffect(() => {
    if (!token || !isOwnProfile) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingBilling(true);
        const { data } = await http.get<{ assinatura: AssinaturaLite | null }>(
          `/api/billing/me`
        );
        if (cancelled) return;
        setAssinatura(data?.assinatura ?? null);
      } catch (err) {
        console.error("Erro ao carregar assinatura:", err);
        setAssinatura(null);
      } finally {
        if (!cancelled) setLoadingBilling(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    isOwnProfile,
    activeContext?.key,
  ]);
    
  const aguardandoPapel =
    Boolean(papelSolicitado) &&
    isOwnProfile &&
    (
      activeContext?.kind !== "PERSONAL" ||
      String(
        activeContext?.tipoUsuario ?? ""
      ).toLowerCase() !==
        papelSolicitado?.toLowerCase()
    );

  if (erroTrocaPapel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-700 font-semibold">
          {erroTrocaPapel}
        </p>

        <button
          type="button"
          onClick={() => {
            setErroTrocaPapel(null);
            tentouCarregarContextos.current = false;
            navigate("/perfil");
          }}
          className="rounded-xl bg-green-800 px-5 py-3 text-white"
        >
          Abrir meu perfil atual
        </button>
      </div>
    );
  }

  if (aguardandoPapel) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-800">
        Preparando perfil...
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  }

  if (
    !tipoRender ||
    !usuarioId ||
    String(
      tipoRender
    ).toLowerCase() ===
      "admin"
  ) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f7f4ea] px-5">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg border border-red-100">
          <h1 className="text-lg font-bold text-red-600 mb-2">
            Perfil não encontrado
          </h1>

          <p className="text-sm text-gray-600 mb-5">
            Esta conta não possui um perfil público disponível. Saia para entrar
            com outro usuário e continuar testando o app.
          </p>

          <button
            type="button"
            onClick={handleLogoutAndLogin}
            className="w-full rounded-xl bg-green-700 px-4 py-3 text-white font-semibold shadow-sm active:scale-[0.99]"
          >
            Sair e entrar com outro usuário
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-700 font-semibold"
          >
            Voltar para o início
          </button>
        </div>
      </div>
    );
  }

  const assinaturaAtiva = Boolean(assinatura?.ativo);

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-3">
        <HealthBanner />
        {isOwnProfile && <SubscriptionBanner />}
      </div>

      {tipoRender ===
        "Atleta" && (
        <PerfilAtleta
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
        />
      )}

      {tipoRender ===
        "Professor" && (
        <PerfilProfessor
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
          hasCreator={
            hasCreator
          }
          creatorUsuarioId={
            usuarioId
          }
        />
      )}

      {tipoRender ===
        "Clube" && (
        <PerfilClube
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
          hasCreator={
            hasCreator
          }
          creatorUsuarioId={
            usuarioId
          }
        />
      )}

      {tipoRender ===
        "Escolinha" && (
        <PerfilEscola
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
          hasCreator={
            hasCreator
          }
          creatorUsuarioId={
            usuarioId
          }
        />
      )}

      {tipoRender ===
        "Olheiro" && (
        <PerfilOlheiro
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
          hasCreator={
            hasCreator
          }
          creatorUsuarioId={
            usuarioId
          }
        />
      )}

      {tipoRender ===
        "Federacao" && (
        <PerfilFederacao
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
          hasCreator={
            hasCreator
          }
          creatorUsuarioId={
            usuarioId
          }
        />
      )}

      {tipoRender ===
        "Marca" && (
        <PerfilMarca
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
          hasCreator={
            hasCreator
          }
          creatorUsuarioId={
            usuarioId
          }
        />
      )}

      {tipoRender ===
        "Learning" && (
        <PerfilLearning
          key={
            activeProfileKey
          }
          idDaUrl={
            idDaUrl
          }
        />
      )}

      {tipoRender ===
        "Responsavel" && (
        <PerfilResponsavel
          key={
            activeProfileKey
          }
        />
      )}

      <BottomNav active="perfil" />
    </div>
  );
}