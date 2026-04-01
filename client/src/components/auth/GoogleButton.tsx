import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

type GoogleButtonProps = {
  text?: "signin_with" | "signup_with" | "continue_with";
  onCredential: (credential: string) => Promise<void> | void;
  disabled?: boolean;
};

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let googleScriptPromise: Promise<void> | null = null;

function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID_2 || "";
}

function loadGoogleScript(): Promise<void> {
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;

    if (existing) {
      if ((window as any).google?.accounts?.id) {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar script Google")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar script Google"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export default function GoogleButton({
  text = "continue_with",
  onCredential,
  disabled = false,
}: GoogleButtonProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const [erro, setErro] = useState("");
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function initGoogle() {
      try {
        setErro("");

        const clientId = getGoogleClientId();

        console.log("[GOOGLE] clientId usado:", clientId);
        console.log("[GOOGLE] VITE_GOOGLE_CLIENT_ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);
        console.log("[GOOGLE] VITE_GOOGLE_CLIENT_ID_2:", import.meta.env.VITE_GOOGLE_CLIENT_ID_2);
        console.log("[GOOGLE] window origin:", window.location.origin);
        
        if (!clientId) {
          setErro("VITE_GOOGLE_CLIENT_ID não configurado no frontend.");
          return;
        }

        await loadGoogleScript();

        if (cancelled) return;

        if (!window.google?.accounts?.id) {
          setErro("Google Identity não disponível em window.google.");
          return;
        }

        if (!divRef.current) {
          setErro("Elemento do botão Google não encontrado.");
          return;
        }

        if (initializedRef.current) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            const credential = response?.credential;
            if (!credential) return;
            await onCredential(credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: "popup",
        });

        divRef.current.innerHTML = "";

        const width = Math.min(divRef.current.clientWidth || 360, 520);

        window.google.accounts.id.renderButton(divRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "left",
          width,
        });

        initializedRef.current = true;
      } catch (e: any) {
        console.error("Erro ao iniciar Google Button:", e);
        setErro(e?.message || "Não foi possível carregar o botão do Google.");
      }
    }

    initGoogle();

    return () => {
      cancelled = true;
    };
  }, [text, onCredential]);

  return (
    <div className="w-full">
      <div className={disabled ? "pointer-events-none opacity-60 w-full" : "w-full"}>
        <div ref={divRef} className="w-full min-h-[44px] flex justify-center" />
      </div>

      {erro ? (
        <p className="text-xs text-red-600 mt-2 text-center">{erro}</p>
      ) : null}
    </div>
  );
}