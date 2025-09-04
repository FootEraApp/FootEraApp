// client/src/pages/perfil.tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import axios from "axios";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";

import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";

type TipoPerfil = "Atleta" | "Professor" | "Clube" | "Escolinha";

interface PerfilMinimo {
  tipo: TipoPerfil;
  usuario: { id: string };
}

export default function ProfilePage() {
  const { id: idDaUrl } = useParams<{ id?: string }>();

  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  // Se não tiver id na URL, exibe o próprio perfil
  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
     setLoading(true);
      try {
        // Busca mínima: só o tipo e o id do usuário
        const { data } = await axios.get<PerfilMinimo>(
          `${API.BASE_URL}/api/perfil/${basePerfil}`,
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
  }, [idDaUrl, token]);

  if (loading) {
    return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  }

  if (!tipo || !usuarioId) {
    return <div className="text-center p-10 text-red-600">Perfil não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-transparent pb-20">
      {/* Conteúdo específico por tipo */}
      {tipo === "Atleta" && <PerfilAtleta idDaUrl={idDaUrl} />}
      {tipo === "Professor" && <PerfilProfessor idDaUrl={idDaUrl} />}
      {tipo === "Clube" && <PerfilClube idDaUrl={idDaUrl} />}
      {tipo === "Escolinha" && <PerfilEscola idDaUrl={idDaUrl} />}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed"><House /></Link>
        <Link href="/explorar"><Search /></Link>
        <Link href="/post"><CirclePlus /></Link>
        <Link href="/treinos"><Volleyball /></Link>
        <Link href="/perfil"><User /></Link>
      </nav>
    </div>
  );
}
