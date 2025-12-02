import React from "react";
import { Crown, BadgeCheck, X } from "lucide-react";
import { Link } from "wouter";
import { http } from "../../services/http.js";

type AssinaturaLite = {
  id: string;
  usuarioId: string;
  plano: string;
  startsAt: string;
  canceledAt: string | null;
  ativo: boolean;
};

type Props = {
  dismissible?: boolean;
  storageKey?: string;
  defaultOpen?: boolean;
  className?: string;
  useSession?: boolean;
};

function getStore(useSession?: boolean) {
  try {
    if (typeof window === "undefined") return null;
    return useSession ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export default function SubscriptionBanner({
  dismissible = true,
  storageKey = "subscriptionbanner:v1",
  defaultOpen = true,
  className = "",
  useSession = false,
}: Props) {
  const store = getStore(useSession);

  const [open, setOpen] = React.useState<boolean>(defaultOpen);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [assinatura, setAssinatura] = React.useState<AssinaturaLite | null>(
    null
  );


  React.useEffect(() => {
    if (!dismissible || !store) return;
    const v = store.getItem(storageKey);
    if (v === "dismissed") setOpen(false);
  }, [dismissible, storageKey, store]);


  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data } = await http.get<{ assinatura: AssinaturaLite | null }>(
          "/api/billing/me"
        );
        if (cancelled) return;
        setAssinatura(data?.assinatura ?? null);
      } catch (err) {
        console.error("Erro ao carregar assinatura (SubscriptionBanner):", err);
        if (!cancelled) setAssinatura(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onClose = () => {
    setOpen(false);
    if (dismissible && store) {
      store.setItem(storageKey, "dismissed");
    }
  };

  if (!open) return null;

  const assinaturaAtiva = Boolean(assinatura?.ativo);

  return (
    <div className={`mb-3 ${className}`}>
      <div className="flex items-center gap-3 p-3 rounded-xl border mt-4 bg-transparent shadow-sm">
        {/* Lado esquerdo: ícone + textos */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {assinaturaAtiva ? (
            <BadgeCheck className="w-5 h-5 text-green-600" />
          ) : (
            <Crown className="w-5 h-5 text-yellow-500" />
          )}

          <div className="leading-tight">
            <div className="font-semibold">
              {loading
                ? "Carregando assinatura..."
                : assinaturaAtiva
                ? "Assinatura ativa"
                : "Assinatura gratuita"}
            </div>

            <div className="text-xs text-gray-600">
              {assinaturaAtiva && assinatura
                ? `Plano: ${assinatura.plano} — desde ${new Date(
                    assinatura.startsAt
                  ).toLocaleDateString()}`
                : "Sem anúncios, sem limites e recursos Pro."}
            </div>
          </div>
        </div>

        {/* Lado direito: botão + X alinhados */}
        <div className="flex items-center gap-2">
          <Link href="/pagamentos">
            <div
              className={`px-3 py-2 rounded-lg border cursor-pointer text-sm font-semibold ${
                assinaturaAtiva
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-blue-600 text-white border-blue-600"
              }`}
              title={
                assinaturaAtiva
                  ? "Gerenciar assinatura"
                  : "Assinar FootEra Pro"
              }
            >
              {assinaturaAtiva ? "Gerenciar" : "Seja Pro"}
            </div>
          </Link>

          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar aviso"
              title="Fechar aviso"
              className="inline-flex h-7 w-7 items-center justify-center
                         rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100
                         focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
