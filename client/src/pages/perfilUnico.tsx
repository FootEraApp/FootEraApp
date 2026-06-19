import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import axios from "axios";
import {
  ArrowLeft
} from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";
import BottomNav from "@/components/layout/BottomNav.js";
import PerfilFederacao from "../components/perfil/PerfilFederacao.js";
import PerfilMarca from "../components/perfil/PerfilMarca.js";
import PerfilLearning from "../components/perfil/PerfilLearning.js";
import PerfilOlheiro from "../components/perfil/PerfilOlheiro.js";

type TipoPerfil =
  | "Atleta"
  | "Admin"
  | "Professor"
  | "Olheiro"
  | "Clube"
  | "Escolinha"
  | "Escola"
  | "Federacao"
  | "Marca"
  | "Learning";

interface PerfilMinimo {
  tipo: TipoPerfil;
  usuario: { id: string };
}

export default function PerfilUnico() {
  const { id } = useParams<{ id: string }>();

  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCreator, setHasCreator] = useState(false);

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [, navigate] = useLocation();

  function handleLogoutAndLogin() {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    window.location.replace("/login");
  }

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/perfil");
  }

  async function resolverUsuarioIdDeOrganizacao(idRecebido: string): Promise<string | null> {
    const endpoints = [
      `${API.BASE_URL}/api/clubes`,
      `${API.BASE_URL}/api/escolinhas`,
    ];

    for (const endpoint of endpoints) {
      try {
        const r = await axios.get(endpoint, { headers });

        const lista = Array.isArray(r.data)
          ? r.data
          : r.data?.items ?? r.data?.data ?? [];

        const encontrado = lista.find((item: any) => String(item?.id) === String(idRecebido));

        if (encontrado) {
          return (
            encontrado.usuarioId ??
            encontrado.usuario?.id ??
            encontrado.userId ??
            encontrado.usuario_id ??
            null
          );
        }
      } catch {
      }
    }

    return null;
  }

  useEffect(() => {
    if (!token) {
      window.location.replace("/login");
      return;
    }

    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);

      try {
        let perfilData: PerfilMinimo | null = null;

        try {
          const r = await axios.get<PerfilMinimo>(
            `${API.BASE_URL}/api/perfil/${encodeURIComponent(id)}`,
            { headers }
          );

          perfilData = r.data;
        } catch (errPrimeiro) {
          const usuarioIdResolvido = await resolverUsuarioIdDeOrganizacao(id);

          if (!usuarioIdResolvido) {
            throw errPrimeiro;
          }

          const r2 = await axios.get<PerfilMinimo>(
            `${API.BASE_URL}/api/perfil/${encodeURIComponent(usuarioIdResolvido)}`,
            { headers }
          );

          perfilData = r2.data;

          if (usuarioIdResolvido !== id) {
            window.history.replaceState(null, "", `/perfil/${usuarioIdResolvido}`);
          }
        }

        if (cancelled) return;

        setTipo(perfilData?.tipo ?? null);
        setUsuarioId(perfilData?.usuario?.id ?? null);
      } catch (err) {
        console.error("Erro ao carregar tipo do perfil:", err);

        if (!cancelled) {
          setTipo(null);
          setUsuarioId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    if (!usuarioId || !token) return;

    let cancelled = false;

    fetch(`${API.BASE_URL}/api/creator/profile/${usuarioId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!cancelled) setHasCreator(r.ok);
      })
      .catch(() => {
        if (!cancelled) setHasCreator(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usuarioId, token]);

  if (loading) {
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  }

  if (!tipo || !usuarioId || String(tipo).toLowerCase() === "admin") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f7f4ea] px-5">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg border border-red-100">
          <h1 className="text-lg font-bold text-red-600 mb-2">
            Perfil não encontrado
          </h1>

          <p className="text-sm text-gray-600 mb-5">
            Esta conta não possui um perfil público disponível. Saia para entrar
            com outro usuário e continuar testando o app.
          </p>

          <button
            type="button"
            onClick={handleLogoutAndLogin}
            className="w-full rounded-xl bg-green-700 px-4 py-3 text-white font-semibold shadow-sm active:scale-[0.99]"
          >
            Sair e entrar com outro usuário
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-700 font-semibold"
          >
            Voltar para o início
          </button>
        </div>
      </div>
    );
  }

  const tipoNormalizado = String(tipo).toLowerCase();

  return (
    <div className="min-h-[100dvh] bg-transparent pb-32">
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

      {tipoNormalizado === "atleta" && (
        <PerfilAtleta idDaUrl={id} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipoNormalizado === "professor" && (
        <PerfilProfessor idDaUrl={id} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipoNormalizado === "olheiro" && (
        <PerfilOlheiro
          idDaUrl={id}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
          mostrarBotaoVoltar={false}
        />
      )}
      {tipoNormalizado === "clube" && (
        <PerfilClube idDaUrl={id} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {["escolinha", "escola"].includes(tipoNormalizado) && (
        <PerfilEscola idDaUrl={id} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipoNormalizado === "federacao" && (
        <PerfilFederacao idDaUrl={id} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipoNormalizado === "marca" && (
        <PerfilMarca idDaUrl={id} hasCreator={hasCreator} creatorUsuarioId={usuarioId} />
      )}
      {tipoNormalizado === "learning" && (
        <PerfilLearning idDaUrl={id} />
      )}

      <div className="h-16" aria-hidden="true" />

      <BottomNav />
    </div>
  );
}