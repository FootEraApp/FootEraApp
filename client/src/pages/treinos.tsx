// client/src/pages/treinos.tsx
import { useEffect, useState } from "react";
import TreinosAtletas from "./treino/treinos-atletas.js";
import TreinosInstrutores from "./treino/treinos-instrutores.js";

type Tipo =
  | "admin"
  | "atleta"
  | "escola"
  | "escolinha"
  | "clube"
  | "professor"
  | "olheiro";

interface UsuarioLogado {
  tipo: Tipo;
  usuarioId: string;
  tipoUsuarioId: string;
}

function detectarTipo(): Tipo | null {
  try {
    const raw = localStorage.getItem("usuarioLogado");
    if (!raw) return null;
    const usuario = JSON.parse(raw) as UsuarioLogado | null;
    return usuario?.tipo ?? null;
  } catch {
    return null;
  }
}

export default function Treinos() {
  const [tipo, setTipo] = useState<Tipo | null>(null);

  useEffect(() => {
    const t = detectarTipo();
    setTipo(t);
  }, []);

  if (!tipo) {
    // Se quiser pode trocar por um skeleton bonitinho depois
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Carregando treinos...
      </div>
    );
  }

  if (tipo === "atleta") {
    return <TreinosAtletas />;
  }

  // professor / escolinha / escola / clube / admin / olheiro
  return <TreinosInstrutores tipo={tipo} />;
}
