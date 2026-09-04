import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { X } from "lucide-react";
import GoogleButton from "../components/auth/GoogleButton.js";
import { API } from "../config.js";
import {
  applyAuthSession,
  consumirRetornoAuth,
  salvarRetornoAuth,
} from "../utils/authSession.js";
import {
  syncSocketAuth,
} from "../services/socket.js";

type AuthGateOptions = {
  title?: string;
  message?: string;
  returnTo?: string;
};

type AuthGateContextValue = {
  requireAuth: (options?: AuthGateOptions) => boolean;
  handleAuthError: (error: any, options?: AuthGateOptions) => boolean;
  openAuthGate: (options?: AuthGateOptions) => void;
  closeAuthGate: () => void;
};

const AuthGateContext =
  createContext<AuthGateContextValue | null>(null);

const AUTH_KEYS = [
  "token",
  "usuarioId",
  "nomeUsuario",
  "tipoUsuario",
  "usuarioTipoRaw",
  "tipoUsuarioId",
  "plano",
] as const;

function readAuthState() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const usuarioId =
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    "";

  return {
    token: token.trim(),
    usuarioId: usuarioId.trim(),
  };
}

function clearStoredAuth() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

function currentReturnTo() {
  return (
    `${window.location.pathname}` +
    `${window.location.search}` +
    `${window.location.hash}`
  );
}

export function AuthGateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [title, setTitle] =
    useState("Entre para continuar");
  const [message, setMessage] =
    useState(
      "Crie sua conta ou entre para realizar esta ação."
    );
  const [googleError, setGoogleError] =
    useState("");
  const [googleLoading, setGoogleLoading] =
    useState(false);

  const openAuthGate = useCallback(
    (options: AuthGateOptions = {}) => {
      salvarRetornoAuth(
        options.returnTo ||
          currentReturnTo()
      );

      setTitle(
        options.title ||
          "Entre para continuar"
      );

      setMessage(
        options.message ||
          "Crie sua conta ou entre para realizar esta ação."
      );

      setGoogleError("");
      setOpen(true);
    },
    []
  );

  const closeAuthGate =
    useCallback(() => {
      setOpen(false);
      setGoogleError("");
    }, []);

  const requireAuth = useCallback(
    (options: AuthGateOptions = {}) => {
      const { token, usuarioId } =
        readAuthState();

      if (token && usuarioId) {
        return true;
      }

      openAuthGate(options);
      return false;
    },
    [openAuthGate]
  );

  const handleAuthError = useCallback(
    (
      error: any,
      options: AuthGateOptions = {}
    ) => {
      const status = Number(
        error?.status ??
          error?.response?.status ??
          0
      );

      const code = String(
        error?.code ??
          error?.response?.data?.code ??
          ""
      ).toUpperCase();

      const messageText = String(
        error?.message ??
          error?.response?.data?.message ??
          ""
      ).toLowerCase();

      const isAuthError =
        status === 401 ||
        code === "AUTH_REQUIRED" ||
        code === "TOKEN_VERSION_MISMATCH" ||
        messageText.includes("missing token") ||
        messageText.includes("invalid/expired token") ||
        messageText.includes("sessão expirada") ||
        messageText.includes("faça login");

      if (!isAuthError) {
        return false;
      }

      clearStoredAuth();

      /*
       * A sessão armazenada foi invalidada.
       * Desconecta o Socket que ainda poderia
       * estar usando o JWT antigo.
       */
      syncSocketAuth(null);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("footera:auth-changed", {
            detail: {
              authenticated: false,
            },
          })
        );
      }

      openAuthGate(options);
      return true;
    },
    [openAuthGate]
  );

  const handleGoogleCredential =
    useCallback(
      async (credential: string) => {
        try {
          setGoogleLoading(true);
          setGoogleError("");

          const resp =
            await axios.post(
              `${API.BASE_URL}/api/auth/google`,
              { credential }
            );

          const data =
            resp.data ?? {};

          if (data?.needsCompletion) {
            sessionStorage.setItem(
              "google_pre_cadastro",
              JSON.stringify({
                preCadastroToken:
                  data.preCadastroToken,
                googleProfile:
                  data.googleProfile,
              })
            );

            setOpen(false);

            navigate(
              "/cadastro/google/complementar"
            );

            return;
          }

          const { isAdmin } =
            applyAuthSession(
              data,
              {
                lembrar: false,
              }
            );

          setOpen(false);

          navigate(
            isAdmin
              ? "/admin"
              : consumirRetornoAuth(
                  "/perfil"
                )
          );
        } catch (error: any) {
          console.error(
            "Erro no Google pelo Auth Gate:",
            error?.response?.data ||
              error?.message
          );

          setGoogleError(
            error?.response?.data?.message ||
              "Não foi possível entrar com Google agora."
          );
        } finally {
          setGoogleLoading(false);
        }
      },
      [navigate]
    );

  const value =
    useMemo<AuthGateContextValue>(
      () => ({
        requireAuth,
        handleAuthError,
        openAuthGate,
        closeAuthGate,
      }),
      [
        requireAuth,
        handleAuthError,
        openAuthGate,
        closeAuthGate,
      ]
    );

  return (
    <AuthGateContext.Provider
      value={value}
    >
      {children}

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeAuthGate}
            aria-label="Fechar autenticação"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-gate-title"
            className="relative z-[201] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={closeAuthGate}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            <h2
              id="auth-gate-title"
              className="pr-10 text-xl font-extrabold text-green-900"
            >
              {title}
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              {message}
            </p>

            <div className="mt-5 space-y-3">
              <div
                className={
                  googleLoading
                    ? "pointer-events-none opacity-60"
                    : ""
                }
              >
                <GoogleButton
                  text="continue_with"
                  disabled={googleLoading}
                  onCredential={
                    handleGoogleCredential
                  }
                />
              </div>

              {googleError && (
                <p className="text-sm text-red-600">
                  {googleError}
                </p>
              )}

              {/*
                Apple ainda não foi implementado.
                Não exponha um botão funcional falso.
              */}

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/cadastro");
                }}
                className="w-full rounded-xl border border-green-700 px-4 py-3 font-semibold text-green-800 hover:bg-green-50"
              >
                Criar conta normalmente
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/login");
                }}
                className="w-full rounded-xl px-4 py-3 font-semibold text-gray-700 hover:bg-gray-100"
              >
                Já tenho conta
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Depois de entrar, você volta para onde estava.
            </p>
          </div>
        </div>
      )}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const context =
    useContext(AuthGateContext);

  if (!context) {
    throw new Error(
      "useAuthGate precisa estar dentro de AuthGateProvider."
    );
  }

  return context;
}