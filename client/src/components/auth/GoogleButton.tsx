import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

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
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

function getGoogleAndroidClientId() {
  return import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID || "";
}

function loadGoogleScript(): Promise<void> {
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;

    if (existing) {
      if ((window as any).google?.accounts?.id) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar script Google")), { once: true });
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

  const isNative = Capacitor.isNativePlatform();

  async function handleNativeGoogleLogin() {
    try {
      setErro("");

      const webClientId = getGoogleClientId();
      const androidClientId = getGoogleAndroidClientId();

      if (!androidClientId) {
        setErro("VITE_GOOGLE_ANDROID_CLIENT_ID não configurado.");
        return;
      }

      console.log("[GOOGLE NATIVE IDS]", { webClientId, androidClientId });

      if (!webClientId) {
        setErro("VITE_GOOGLE_CLIENT_ID não configurado.");
        return;
      }

      console.log("[GOOGLE IDS]", JSON.stringify({
        webClientId,
        androidClientId,
        isNative,
      }));

      await GoogleSignIn.initialize({
        clientId: webClientId,
      });

      const result: any = await GoogleSignIn.signIn();

      const credential = result?.idToken;

      if (!credential) {
        console.log("[GOOGLE NATIVE RESULT]", result);
        setErro("Google não retornou idToken.");
        return;
      }

      await onCredential(credential);
    } catch (e: any) {
      console.error("Erro no Google nativo:", e);

      const msg = String(e?.message || e || "").toLowerCase();

      // Quando o usuário fecha/cancela o popup do Google, não mostra erro na tela.
      if (
        msg.includes("cancel") ||
        msg.includes("canceled") ||
        msg.includes("cancelled") ||
        msg.includes("user canceled")
      ) {
        setErro("");
        return;
      }

      setErro(e?.message || "Não foi possível entrar com Google.");
    }
  }

  useEffect(() => {
    if (isNative) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const GOOGLE_BUTTON_WIDTH = 320;
    const GOOGLE_BUTTON_HEIGHT = 44;

    function ajustarEscala() {
      if (!divRef.current) return;

      const outer = divRef.current.parentElement;
      if (!outer) return;

      const availableWidth = Math.floor(outer.getBoundingClientRect().width);
      const scale = Math.min(1, availableWidth / GOOGLE_BUTTON_WIDTH);

      divRef.current.style.transform = `scale(${scale})`;
      divRef.current.style.transformOrigin = "top center";
      divRef.current.style.width = `${GOOGLE_BUTTON_WIDTH}px`;
      divRef.current.style.height = `${GOOGLE_BUTTON_HEIGHT}px`;

      outer.style.height = `${GOOGLE_BUTTON_HEIGHT * scale}px`;
    }

    async function initGoogleWeb() {
      try {
        setErro("");

        const clientId = getGoogleClientId();

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

        if (!initializedRef.current) {
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

          window.google.accounts.id.renderButton(divRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text,
            shape: "rectangular",
            logo_alignment: "left",
            width: GOOGLE_BUTTON_WIDTH,
          });

          initializedRef.current = true;
        }

        ajustarEscala();

        const outer = divRef.current.parentElement;

        if (outer) {
          resizeObserver = new ResizeObserver(() => {
            if (!cancelled) ajustarEscala();
          });

          resizeObserver.observe(outer);
        }

        window.addEventListener("resize", ajustarEscala);
      } catch (e: any) {
        console.error("Erro ao iniciar Google Button:", e);
        setErro(e?.message || "Não foi possível carregar o botão do Google.");
      }
    }

    initGoogleWeb();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", ajustarEscala);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [text, onCredential, isNative]);

  return (
    <div className="w-full min-w-0 overflow-hidden">
      {isNative ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleNativeGoogleLogin}
          className="flex min-h-[44px] w-full min-w-0 items-center justify-center rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
        >
          Continuar com Google
        </button>
      ) : (
        <div
          className={[
            "relative mx-auto w-full min-w-0 overflow-hidden",
            disabled ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <div
            ref={divRef}
            className="mx-auto flex min-h-[44px] items-center justify-center"
          />
        </div>
      )}

      {erro ? (
        <p className="mt-2 text-center text-xs text-red-600">{erro}</p>
      ) : null}
    </div>
  );
}