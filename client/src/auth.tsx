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

  const [, navigate] =
    useLocation();

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
        status === "valid"
          ? "/perfil"
          : "/login"
      }
    />
  );
}