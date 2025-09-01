import { useEffect, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";

type Props = { idDaUrl?: string };

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

type PayloadEscola = {
  tipo: "Escolinha";
  usuario: UsuarioMin | null;
  escolinha: {
    id: string;
    usuarioId?: string | null;
    nome: string;
    cnpj?: string | null;
    telefone1?: string | null;
    telefone2?: string | null;
    email?: string | null;
    siteOficial?: string | null;
    sede?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    pais?: string | null;
    cep?: string | null;
    logo?: string | null;
    dataCriacao: string;
  };
  metrics: { atletas: number; treinosProgramados: number; postagens: number };
};

export default function PerfilEscola({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadEscola | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadEscola>(
          `${API.BASE_URL}/api/perfil/escola/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilEscola GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.escolinha) return <div className="text-center p-10 text-red-600">Escolinha não encontrada.</div>;

  const nome = data.escolinha.nome || data.usuario?.nome || "Escola";
  const headerFoto: string | undefined =
    (typeof data.escolinha.logo === "string" && data.escolinha.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const time =
    data.escolinha.cidade
      ? `${data.escolinha.cidade}${data.escolinha.estado ? " - " + data.escolinha.estado : ""}`
      : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.escolinha.usuarioId || data.escolinha.id}
      />

      <section className="mt-4 grid gap-4">
        <div className="bg-white/70 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-green-900 mb-2">Informações da Escolinha</h3>
          <ul className="text-sm text-green-900/90 space-y-1">
            <li><b>Nome:</b> {data.escolinha.nome}</li>
            {data.escolinha.cnpj && <li><b>CNPJ:</b> {data.escolinha.cnpj}</li>}
            {data.escolinha.email && <li><b>Email:</b> {data.escolinha.email}</li>}
            {data.escolinha.siteOficial && <li><b>Site:</b> {data.escolinha.siteOficial}</li>}
            {(data.escolinha.telefone1 || data.escolinha.telefone2) && (
              <li><b>Telefones:</b> {[data.escolinha.telefone1, data.escolinha.telefone2].filter(Boolean).join(" / ")}</li>
            )}
            {(data.escolinha.logradouro || data.escolinha.bairro || data.escolinha.cidade) && (
              <li>
                <b>Endereço:</b>{" "}
                {[data.escolinha.logradouro, data.escolinha.numero, data.escolinha.complemento, data.escolinha.bairro, data.escolinha.cidade, data.escolinha.estado, data.escolinha.cep]
                  .filter(Boolean)
                  .join(", ")}
              </li>
            )}
            {data.escolinha.sede && <li><b>Sede:</b> {data.escolinha.sede}</li>}
          </ul>
        </div>

        <div className="bg-white/70 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-green-900 mb-2">Resumo</h3>
          <ul className="text-sm text-green-900/90 space-y-1">
            <li><b>Atletas:</b> {data.metrics.atletas}</li>
            <li><b>Treinos programados:</b> {data.metrics.treinosProgramados}</li>
            <li><b>Postagens:</b> {data.metrics.postagens}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
