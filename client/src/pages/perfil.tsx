import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import axios from "axios";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  Eye,
  Crown,
  BadgeCheck,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";
import PerfilOlheiro from "../components/perfil/PerfilOlheiro.js";
import HealthBanner from "../components/legal/HealthBanner.js";
import { http } from "../services/http.js";

type TipoPerfil = "Atleta" | "Professor" | "Clube" | "Escolinha" | "Admin" | "Olheiro";

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
  }, [idDaUrl, token]); 
  
  useEffect(() => {
    if (!token || !isOwnProfile) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingBilling(true);
        const { data } = await http.get<{ assinatura: AssinaturaLite | null }>(`/api/billing/me`);
        if (cancelled) return;
        setAssinatura(data?.assinatura ?? null);
      } catch (err) {
        console.error("Erro ao carregar assinatura:", err);
        setAssinatura(null);
      } finally {
        if (!cancelled) setLoadingBilling(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, isOwnProfile]);

  if (loading) {
    return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  }

  if (!tipo || !usuarioId) {
    return <div className="text-center p-10 text-red-600">Perfil não encontrado.</div>;
  }

  const assinaturaAtiva = Boolean(assinatura?.ativo);

  return (
    <div className="min-h-screen bg-transparent pb-20 mt-5">
      <div className="max-w-3xl px-4 pt-3">
        <HealthBanner />

        {isOwnProfile && (
          <div className="mb-3">
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border mt-5 bg-transparent shadow-sm">
              <div className="flex items-center gap-3 ">
                {assinaturaAtiva ? (
                  <BadgeCheck className="w-5 h-5 text-green-600" />
                ) : (
                  <Crown className="w-5 h-5 text-yellow-500" />
                )}
                <div className="leading-tight">
                  <div className="font-semibold ">
                    {loadingBilling
                      ? "Carregando assinatura..."
                      : assinaturaAtiva
                      ? "Assinatura ativa"
                      : "Assinatura gratuita"}
                  </div>
                  <div className="text-xs text-gray-600">
                    {assinaturaAtiva
                      ? `Plano: ${assinatura?.plano} — desde ${new Date(assinatura!.startsAt).toLocaleDateString()}`
                      : "Sem anúncios, sem limites e recursos Pro."}
                  </div>
                </div>
              </div>

              <Link href="/pagamentos">
                <div
                  className={`px-3 py-2 rounded-lg border cursor-pointer ${
                    assinaturaAtiva
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-blue-600 text-white border-blue-600"
                  }`}
                  title={assinaturaAtiva ? "Gerenciar assinatura" : "Assinar FootEra Pro"}
                >
                  {assinaturaAtiva ? "Gerenciar" : "Seja Pro"}
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {tipo === "Atleta" && <PerfilAtleta idDaUrl={idDaUrl} />}
      {tipo === "Professor" && <PerfilProfessor idDaUrl={idDaUrl} />}
      {tipo === "Clube" && <PerfilClube idDaUrl={idDaUrl} />}
      {tipo === "Escolinha" && <PerfilEscola idDaUrl={idDaUrl} />}
      {tipo === "Olheiro" && <PerfilOlheiro idDaUrl={idDaUrl} />}

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed"><House /></Link>
        <Link href="/explorar"><Search /></Link>
        <Link href="/post"><CirclePlus /></Link>
        {tipo === "Olheiro" ? (
          <Link href="/olheiros"><Eye /></Link>
        ) : (
          <Link href="/treinos"><Volleyball /></Link>
        )}
        <Link href="/perfil"><User /></Link>
      </nav>
    </div>
  );
}