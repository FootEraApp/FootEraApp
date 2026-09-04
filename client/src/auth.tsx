import {
  ReactNode,
  useEffect,
  useState,
} from "react";
import { Redirect } from "wouter";
import { readToken } from "./utils/auth.js";
import { API } from "./config.js";
import {
  clearAuthSession,
} from "./utils/authSession.js";

type SessionStatus =
  | "checking"
  | "valid"
  | "invalid";

function useSessionStatus(): SessionStatus {
  const [status, setStatus] =
    useState<SessionStatus>("checking");

  useEffect(() => {
    const token = readToken();

    if (!token) {
      setStatus("invalid");
      return;
    }

    let cancelled = false;

    void fetch(
      `${API.BASE_URL}/api/auth/me`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    )
      .then((response) => {
        if (cancelled) return;

        if (response.ok) {
          setStatus("valid");
          return;
        }

        /*
         * O token existe no navegador,
         * mas o backend não aceita mais
         * a sessão.
         */
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404
        ) {
          clearAuthSession();
          setStatus("invalid");
          return;
        }

        /*
         * Não derruba uma sessão somente
         * porque houve uma falha temporária
         * do backend.
         */
        setStatus("valid");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("valid");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

function SessionChecking() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f7f4ea] text-green-900">
      Carregando...
    </div>
  );
}

export function Private({
  children,
}: {
  children: ReactNode;
}) {
  const token = readToken();

  return token
    ? <>{children}</>
    : <Redirect to="/login" />;
}

export function PublicOnly({
  children,
}: {
  children: ReactNode;
}) {
  const status =
    useSessionStatus();

  if (status === "checking") {
    return <SessionChecking />;
  }

  return status === "valid"
    ? <Redirect to="/perfil" />
    : <>{children}</>;
}

export function HomeRedirect() {
  const status =
    useSessionStatus();

  if (status === "checking") {
    return <SessionChecking />;
  }

  return (
    <Redirect
      to={
        status === "valid"
          ? "/perfil"
          : "/login"
      }
    />
  );
}