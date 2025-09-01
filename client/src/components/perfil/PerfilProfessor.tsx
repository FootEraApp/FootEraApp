import { useEffect, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";

type Props = { idDaUrl?: string };

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

type PayloadProfessor = {
  tipo: "Professor";
  usuario: UsuarioMin | null;
  professor: {
    id: string;
    usuarioId?: string | null;
    nome: string;
    codigo?: string | null;
    cref?: string | null;
    areaFormacao: string;
    escola?: string | null;
    qualificacoes: string[];
    certificacoes: string[];
    fotoUrl?: string | null;
    statusCref?: string | null;
  };
  metrics: { treinosProgramados: number; alunosRelacionados: number };
};

export default function PerfilProfessor({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  // Prioriza o id da TABELA quando é meu perfil; senão usa "me"; senão, idDaUrl
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadProfessor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancel = false;

    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadProfessor>(
          `${API.BASE_URL}/api/perfil/professor/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilProfessor GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, [targetId, token]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.professor) return <div className="text-center p-10 text-red-600">Professor não encontrado.</div>;

  const nome = data.usuario?.nome || data.professor.nome;
  const headerFoto: string | undefined =
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    (typeof data.professor.fotoUrl === "string" && data.professor.fotoUrl) ||
    undefined;
  const time = data.professor.escola || undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.professor.usuarioId || data.professor.id}
      />

      <section className="mt-4 space-y-3">
        <div className="bg-white/70 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-green-900 mb-2">Informações do Professor</h3>
          <ul className="text-sm text-green-900/90 space-y-1">
            <li><b>Nome:</b> {data.professor.nome}</li>
            {data.professor.codigo && <li><b>Código:</b> {data.professor.codigo}</li>}
            {data.professor.cref && <li><b>CREF:</b> {data.professor.cref}</li>}
            <li><b>Área de formação:</b> {data.professor.areaFormacao}</li>
            {data.professor.escola && <li><b>Escola:</b> {data.professor.escola}</li>}
            {data.professor.statusCref && <li><b>Status do CREF:</b> {data.professor.statusCref}</li>}
          </ul>
        </div>

        {!!(data.professor.qualificacoes?.length) && (
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Qualificações</h3>
            <div className="flex flex-wrap gap-2">
              {data.professor.qualificacoes.map((q, i) => (
                <span key={i} className="px-2 py-1 rounded-full bg-green-100 text-green-900 text-xs">{q}</span>
              ))}
            </div>
          </div>
        )}

        {!!(data.professor.certificacoes?.length) && (
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Certificações</h3>
            <div className="flex flex-wrap gap-2">
              {data.professor.certificacoes.map((c, i) => (
                <span key={i} className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs">{c}</span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white/70 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-green-900 mb-2">Resumo</h3>
          <ul className="text-sm text-green-900/90 space-y-1">
            <li><b>Treinos programados:</b> {data.metrics.treinosProgramados}</li>
            <li><b>Alunos relacionados:</b> {data.metrics.alunosRelacionados}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
