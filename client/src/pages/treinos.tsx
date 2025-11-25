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

interface UsuarioLogadoLegacy {
  tipo: Tipo;
  usuarioId: string;
  tipoUsuarioId: string;
}

function detectarTipo(): Tipo | null {
  try {
    // 🔹 NOVO FORMATO — o login salva "tipoUsuario" em localStorage/sessionStorage
    const fromStore =
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario");

    if (fromStore) {
      const raw = fromStore.toLowerCase();
      const map: Record<string, Tipo> = {
        admin: "admin",
        atleta: "atleta",
        professor: "professor",
        clube: "clube",
        escolinha: "escolinha",
        escola: "escola",
        olheiro: "olheiro",
      };
      if (map[raw]) return map[raw];
    }

    // 🔹 FORMATO ANTIGO — ainda tenta ler "usuarioLogado" se existir
    const rawLegacy = localStorage.getItem("usuarioLogado");
    if (!rawLegacy) return null;

    const usuario = JSON.parse(rawLegacy) as UsuarioLogadoLegacy | null;
    return usuario?.tipo ?? null;
  } catch (e) {
    console.error("Erro ao detectar tipo do usuário em /treinos:", e);
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
    // Se não detectou tipo, pode ser usuário não logado
    // Aqui por enquanto só mostra o loading simples
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
