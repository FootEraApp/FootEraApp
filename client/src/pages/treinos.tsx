// client/src/pages/treinos
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
  | "olheiro"
  | "federacao"
  | "marca"
  | "learning"
   ;

interface UsuarioLogadoLegacy {
  tipo: Tipo;
  usuarioId: string;
  tipoUsuarioId: string;
}

function detectarTipo(): Tipo | null {
  try {
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
        federacao: "federacao",
        marca: "marca",
        learning: "learning",
      };
      if (map[raw]) return map[raw];
    }

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
        Carregando treinos...
      </div>
    );
  }

  if (tipo === "learning") {
    return (
      <div className="min-h-screen bg-[#f5f2e8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-6 max-w-md text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-green-900">
            Treinos disponíveis para perfis esportivos
          </h1>

          <p className="text-green-900/70 mt-2">
            Sua conta Learning foi criada para acessar cursos, lives e metodologias.
            Para usar treinos, escolha um perfil como atleta, professor, clube ou escolinha.
          </p>

          <button
            onClick={() => (window.location.href = "/perfil/mudar-tipo")}
            className="mt-5 rounded-xl bg-green-700 px-4 py-3 text-white font-bold"
          >
            Mudar tipo de perfil
          </button>
        </div>
      </div>
    );
  }

  if (tipo === "atleta") {
    return <TreinosAtletas />;
  }

  return <TreinosInstrutores tipo={tipo} />;
}