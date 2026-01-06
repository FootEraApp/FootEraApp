import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
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
import {
  ALL_ACHIEVEMENTS,
  type AchievementLite,
  type Tier,
} from "../lib/achievementsCatalog.js";
import BottomNav from "@/components/layout/BottomNav.js";

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

type ParsedAchievement = {
  ach?: AchievementLite;
  headTitle?: string;
  headDesc?: string;
  userMsg?: string;
};

function parseAchievement(conteudo: string): ParsedAchievement | null {
  if (!conteudo) return null;

  const lines = conteudo.split(/\n+/);
  const head = (lines[0] || "").trim();
  const rest = lines.slice(1).join("\n").trim();

  const isHeadAchievement = /^🏆\s*Conquista:/i.test(head);

  const idMatch = rest.match(/\[([^\]]+)\]/);
  const achId = idMatch?.[1]?.trim();
  const ach: AchievementLite | undefined = achId
    ? (ALL_ACHIEVEMENTS as AchievementLite[]).find((a: AchievementLite) => a.id === achId)
    : undefined;

  if (!isHeadAchievement && !achId) return null;

  let headTitle: string | undefined;
  let headDesc: string | undefined;
  const m = head.match(/^🏆\s*Conquista:\s*(.+?)\s+—\s+(.+)$/);
  if (m) {
    headTitle = m[1];
    headDesc = m[2];
  }

  const userMsg = achId ? rest.replace(/\[[^\]]+\]\s*/, "").trim() : rest;
  return { ach, headTitle, headDesc, userMsg };
}

function TierPill({ tier }: { tier?: Tier }) {
  if (!tier) return null;
  const map: Record<Tier, string> = {
    bronze: "bg-amber-100 text-amber-800 border-amber-200",
    prata: "bg-gray-100 text-gray-700 border-gray-300",
    ouro: "bg-yellow-100 text-yellow-800 border-yellow-200",
    platina: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${map[tier] || ""}`}>
      {tier[0].toUpperCase() + tier.slice(1)}
    </span>
  );
}

function AchievementShareCard({ parsed }: { parsed: ParsedAchievement }) {
  const icon = parsed.ach?.icon || "🏆";
  const title = parsed.ach?.title || parsed.headTitle || "Conquista";
  const desc = parsed.ach?.description || parsed.headDesc || "";
  const tier = parsed.ach?.tier;

  return (
    <div className="mt-1 rounded-xl border border-yellow-200 bg-yellow-50/60 p-3">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center text-xl">
          <span aria-hidden>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-yellow-900 truncate">Conquista: {title}</h4>
            <TierPill tier={tier} />
          </div>
          {!!desc && <p className="text-sm text-yellow-900/90 mt-0.5">{desc}</p>}
          {!!parsed.userMsg && (
            <p className="text-sm text-gray-700 mt-2 italic">“{parsed.userMsg}”</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
    return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  }

  if (!tipo || !usuarioId) {
    return <div className="text-center p-10 text-red-600">Perfil não encontrado.</div>;
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
      {tipo === "Clube" && <PerfilClube idDaUrl={idDaUrl} usuarioId={usuarioId}/>}
      {tipo === "Escolinha" && <PerfilEscola idDaUrl={idDaUrl} />}
      {tipo === "Olheiro" && <PerfilOlheiro idDaUrl={idDaUrl} />}

      <BottomNav active="perfil" />

    </div>
  );
}