import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import axios from "axios";
import Storage from "../../../server/utils/storage.js";
import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";
import PerfilOlheiro from "../components/perfil/PerfilOlheiro.js";
import HealthBanner from "../components/legal/HealthBanner.js";
import SubscriptionBanner from "../components/billing/SubscriptionBanner.js";
import { http } from "../services/http.js";
import BottomNav from "@/components/layout/BottomNav.js";
import PerfilLearning from "@/components/perfil/PerfilLearning.js";
import PerfilMarca from "@/components/perfil/PerfilMarca.js";
import PerfilFederacao from "@/components/perfil/PerfilFederacao.js";
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
  | "Marca";

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

export default function ProfilePage() {
  const { id: idDaUrl } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assinatura, setAssinatura] = useState<AssinaturaLite | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [hasCreator, setHasCreator] = useState(false);

  const token = Storage.token;

  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);

  function handleLogoutAndLogin() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    window.location.replace("/login");
  }

  useEffect(() => {
    if (!usuarioId || !token) return;

    const tipoNorm = String(tipo || "").toLowerCase();

    if (tipoNorm === "atleta" || tipoNorm === "learning") {
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
  }, [usuarioId, token, tipo]);

  useEffect(() => {
    if (!token) {
      window.location.replace("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
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
  }, [idDaUrl, token, basePerfil]);

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
  }, [token, isOwnProfile]);

  if (loading) {
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  }

  if (!tipo || !usuarioId || String(tipo).toLowerCase() === "admin") {
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

      {tipo === "Atleta" && <PerfilAtleta idDaUrl={idDaUrl} />}
      {tipo === "Professor" && (
        <PerfilProfessor idDaUrl={idDaUrl} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipo === "Clube" && (
        <PerfilClube idDaUrl={idDaUrl} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipo === "Escolinha" && (
        <PerfilEscola idDaUrl={idDaUrl} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipo === "Olheiro" && (
        <PerfilOlheiro idDaUrl={idDaUrl} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipo === "Federacao" && (
        <PerfilFederacao
          idDaUrl={idDaUrl}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipo === "Marca" && (
        <PerfilMarca
          idDaUrl={idDaUrl}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}
      {tipo === "Learning" && <PerfilLearning idDaUrl={idDaUrl} />}

      <BottomNav active="perfil" />
    </div>
  );
}