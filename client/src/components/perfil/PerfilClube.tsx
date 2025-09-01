import { useEffect, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";

type Props = { idDaUrl?: string };

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

type PayloadClube = {
  tipo: "Clube";
  usuario: UsuarioMin | null;
  clube: {
    id: string;
    usuarioId: string;
    nome: string;
    cnpj?: string | null;
    telefone1?: string | null;
    telefone2?: string | null;
    email?: string | null;
    siteOficial?: string | null;
    sede?: string | null;
    estadio?: string | null;
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

export default function PerfilClube({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadClube | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadClube>(
          `${API.BASE_URL}/api/perfil/clube/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilClube GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.clube) return <div className="text-center p-10 text-red-600">Clube não encontrado.</div>;

  const nome = data.clube.nome || data.usuario?.nome || "Clube";
  const headerFoto: string | undefined =
    (typeof data.clube.logo === "string" && data.clube.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const time =
    data.clube.cidade
      ? `${data.clube.cidade}${data.clube.estado ? " - " + data.clube.estado : ""}`
      : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.clube.usuarioId || data.clube.id}
      />

      <section className="mt-4 grid gap-4">
        <div className="bg-white/70 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-green-900 mb-2">Informações do Clube</h3>
          <ul className="text-sm text-green-900/90 space-y-1">
            <li><b>Nome:</b> {data.clube.nome}</li>
            {data.clube.cnpj && <li><b>CNPJ:</b> {data.clube.cnpj}</li>}
            {data.clube.email && <li><b>Email:</b> {data.clube.email}</li>}
            {data.clube.siteOficial && <li><b>Site:</b> {data.clube.siteOficial}</li>}
            {(data.clube.telefone1 || data.clube.telefone2) && (
              <li><b>Telefones:</b> {[data.clube.telefone1, data.clube.telefone2].filter(Boolean).join(" / ")}</li>
            )}
            {(data.clube.logradouro || data.clube.bairro || data.clube.cidade) && (
              <li>
                <b>Endereço:</b>{" "}
                {[data.clube.logradouro, data.clube.numero, data.clube.complemento, data.clube.bairro, data.clube.cidade, data.clube.estado, data.clube.cep]
                  .filter(Boolean)
                  .join(", ")}
              </li>
            )}
            {data.clube.estadio && <li><b>Estádio:</b> {data.clube.estadio}</li>}
            {data.clube.sede && <li><b>Sede:</b> {data.clube.sede}</li>}
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
