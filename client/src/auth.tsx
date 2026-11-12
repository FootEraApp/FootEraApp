// client/src/auth.tsx
import {
  ReactNode,
  useEffect,
  useState,
} from "react";
import { Redirect, useLocation } from "wouter";
import { readToken } from "./utils/auth.js";
import { API } from "./config.js";
import {
  clearAuthSession,
  consumirRetornoAuth,
  salvarRetornoAuth,
} from "./utils/authSession.js";

type SessionStatus =
  | "checking"
  | "valid"
  | "restricted"
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
      .then(async (response) => {
        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();

          if (cancelled) return;

          const restricted = data?.somenteGestaoConta === true;

          const store = localStorage.getItem("token")
            ? localStorage
            : sessionStorage;

          store.setItem(
            "somenteGestaoConta",
            restricted ? "true" : "false",
          );

          setStatus(restricted ? "restricted" : "valid");
          return;
        }

        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404
        ) {
          clearAuthSession();
          setStatus("invalid");
          return;
        }

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

function AuthenticatedReturnRedirect() {
  const [destino] =
    useState(() =>
      consumirRetornoAuth(
        "/perfil"
      )
    );

  return (
    <Redirect to={destino} />
  );
}

export function Private({
  children,
}: {
  children: ReactNode;
}) {
  const token =
    readToken();

  const [location, navigate] = useLocation();

  const somenteGestaoConta =
    localStorage.getItem("somenteGestaoConta") === "true" ||
    sessionStorage.getItem("somenteGestaoConta") === "true";

  const rotaDeGestao =
    location === "/configuracoes" ||
    location.startsWith("/configuracoes/") ||
    location === "/perfil/recuperar";

  useEffect(() => {
    if (token) {
      return;
    }
    salvarRetornoAuth();

    navigate("/login");
  }, [token, navigate]);

  if (!token) {
    return (
      <SessionChecking />
    );
  }

  if (token && somenteGestaoConta && !rotaDeGestao) {
    return <Redirect to="/configuracoes" />;
  }

  return <>{children}</>;
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

  if (status === "restricted") {
    return <Redirect to="/configuracoes" />;
  }

  return status === "valid"
    ? <AuthenticatedReturnRedirect />
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
        status === "restricted"
          ? "/configuracoes"
          : status === "valid"
            ? "/perfil"
            : "/login"
      }
    />
  );
}