// client/src/pages/treinos.tsx
import React, { useEffect, useState } from "react";
import TreinosAtletas from "./treino/treinos-atletas.js";
import TreinosInstrutores from "./treino/treinos-instrutores.js";
import Storage from "../../../server/utils/storage.js";

type Tipo =
  | "admin"
  | "atleta"
  | "escola"
  | "escolinha"
  | "clube"
  | "professor"
  | "olheiro"
  | "";

function detectarTipo(): Tipo {
  const raw =
    (Storage as any).tipoSalvo ??
    (Storage as any).tipoUsuario ??
    (Storage as any).tipo ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    "";
  return String(raw || "").toLowerCase() as Tipo;
}

export default function PaginaTreinos() {
  const [tipo, setTipo] = useState<Tipo>("");

  useEffect(() => {
    setTipo(detectarTipo());
  }, []);

  if (!tipo) return <p className="text-center p-4">Carregando...</p>;

  if (tipo === "atleta") {
    return <TreinosAtletas />;
  }

  // olheiro tem tela própria
  if (tipo === "olheiro") {
    if (typeof window !== "undefined") window.location.replace("/olheiros");
    return null;
  }

  return <TreinosInstrutores tipo={tipo} />;
}
