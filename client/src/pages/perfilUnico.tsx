import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import axios from "axios";
import {
  ArrowLeft,
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
} from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";
import BottomNav from "@/components/layout/BottomNav.js";

type TipoPerfil = "Atleta" | "Professor" | "Clube" | "Escolinha";

interface PerfilMinimo {
  tipo: TipoPerfil;
  usuario: { id: string };
}

export default function PerfilUnico() {
  const { id } = useParams<{ id: string }>();

  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [, navigate] = useLocation();

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/perfil");
  }

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get<PerfilMinimo>(
          `${API.BASE_URL}/api/perfil/${id}`,
          { headers }
        );

        if (cancelled) return;

        setTipo(data?.tipo ?? null);
        setUsuarioId(data?.usuario?.id ?? null);
      } catch (err) {
        console.error("Erro ao carregar tipo do perfil:", err);
        setTipo(null);
        setUsuarioId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  if (loading) {
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  }

  if (!tipo || !usuarioId) {
    return (
      <div className="text-center p-10 text-red-600">
        Perfil não encontrado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-20">
      <div className="mb-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Voltar"
          title="Voltar"
          className="inline-flex h-10 w-10 items-center justify-center
                    rounded-full border border-green-800 bg-white text-green-900
                    shadow-sm hover:bg-green-50 focus:outline-none
                    focus:ring-2 focus:ring-green-700/30 mt-6 ml-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {tipo === "Atleta" && <PerfilAtleta idDaUrl={id} />}
      {tipo === "Professor" && <PerfilProfessor idDaUrl={id} />}
      {tipo === "Clube" && <PerfilClube idDaUrl={id} />}
      {tipo === "Escolinha" && <PerfilEscola idDaUrl={id} />}

      <BottomNav />

    </div>
  );
}