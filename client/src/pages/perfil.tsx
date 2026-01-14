import { useEffect, useState } from "react";
import { useParams } from "wouter";
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

type TipoPerfil =
  | "Atleta"
  | "Professor"
  | "Clube"
  | "Escolinha"
  | "Admin"
  | "Olheiro";

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

  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [assinatura, setAssinatura] = useState<AssinaturaLite | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const token = Storage.token;

  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);

  useEffect(() => {
    if (!token) return;

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

  if (!tipo || !usuarioId) {
    return (
      <div className="text-center p-10 text-red-600">
        Perfil não encontrado.
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
      {tipo === "Professor" && <PerfilProfessor idDaUrl={idDaUrl} />}
      {tipo === "Clube" && <PerfilClube idDaUrl={idDaUrl} usuarioId={usuarioId} />}
      {tipo === "Escolinha" && <PerfilEscola idDaUrl={idDaUrl} />}
      {tipo === "Olheiro" && <PerfilOlheiro idDaUrl={idDaUrl} />}

      <BottomNav active="perfil" />
    </div>
  );
}