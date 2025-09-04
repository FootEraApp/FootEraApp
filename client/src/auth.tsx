import { ReactNode } from "react";
import { Redirect } from "wouter";
import { readToken } from "@/utils/auth.js";

export function Private({ children }: { children: ReactNode }) {
  const token = readToken();
  return token ? <>{children}</> : <Redirect to="/login" />;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const token = readToken();
  return token ? <Redirect to="/feed" /> : <>{children}</>;
}

export function HomeRedirect() {
  const token = readToken();
  return <Redirect to={token ? "/feed" : "/login"} />;
}