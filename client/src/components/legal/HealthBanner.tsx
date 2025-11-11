import React from "react";
import { X } from "lucide-react";

type Props = {
  /** Mostra o botão X e permite fechar o aviso */
  dismissible?: boolean;
  /** Chave usada para lembrar que o usuário fechou */
  storageKey?: string;
  /** Estado inicial caso não haja registro salvo */
  defaultOpen?: boolean;
  /** Classes extras */
  className?: string;
  /** Tipografia/espacamento mais compacto */
  compact?: boolean;
  /** Usa sessionStorage em vez de localStorage */
  useSession?: boolean;
  /** Conteúdo customizado (opcional) */
  children?: React.ReactNode;
};

function getStore(useSession?: boolean) {
  try {
    if (typeof window === "undefined") return null;
    return useSession ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export default function HealthBanner({
  dismissible = true,                // padrão: já vem com X
  storageKey = "healthbanner:v1",
  defaultOpen = true,
  className = "",
  compact = false,
  useSession = false,
  children,
}: Props) {
  const store = getStore(useSession);
  const [open, setOpen] = React.useState<boolean>(defaultOpen);

  // Lê do storage se já foi fechado antes
  React.useEffect(() => {
    if (!dismissible || !store) return;
    const v = store.getItem(storageKey);
    if (v === "dismissed") setOpen(false);
  }, [dismissible, storageKey, store]);

  const onClose = () => {
    setOpen(false);
    if (dismissible && store) {
      store.setItem(storageKey, "dismissed");
    }
  };

  if (!open) return null;

  return (
    <div
      role="note"
      className={`relative text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 ${className}`}
    >
      <p className={`${compact ? "" : "leading-relaxed"}`}>
        {children ??
          "Conteúdo educacional. Não substitui avaliação médica/profissional. Você (e/ou o responsável) decide se está apto a executar. Exercite-se com segurança."}
      </p>

      {dismissible && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          title="Fechar aviso"
          className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center
                     rounded-md text-amber-900/80 hover:text-amber-900 hover:bg-amber-100
                     focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
