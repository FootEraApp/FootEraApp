import { useEffect, useState } from "react";
import axios from "axios";
import ProfileHeader from "../profile/ProfileHeader.js";
import ProfilePostsSection from "./ProfilePostsSection.js";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

type Props = {
  idDaUrl?: string;
  hasCreator?: boolean;
  creatorUsuarioId?: string | null;
  tipoPerfil?: "marca" | "federacao";
};

export default function PerfilMarca({
  idDaUrl,
  hasCreator = false,
  creatorUsuarioId = null,
  tipoPerfil = "marca",
}: Props) {
  const [data, setData] = useState<any>(null);
  const [aba, setAba] = useState<"perfil" | "eventos" | "conteudos" | "postagens">("perfil");
  const token = Storage.token;
  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const id = isOwn ? "me" : idDaUrl;

  useEffect(() => {
    if (!token || !id) return;

    axios
      .get(`${API.BASE_URL}/api/perfil/${tipoPerfil}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [id, token, tipoPerfil]);

  if (!data) {
    return <div className="p-10 text-center text-red-600">Marca não encontrada.</div>;
  }

  const entidade = tipoPerfil === "federacao"
    ? data.federacao ?? data
    : data.marca ?? data;

  const usuario = data.usuario ?? entidade.usuario ?? {};
  const usuarioId = usuario.id ?? entidade.usuarioId;

  return (
    <div className="pb-24">
      <ProfileHeader
        perfilId={usuarioId}
        nome={entidade.nome ?? usuario.nome ?? "Marca"}
        time={entidade.cidade && entidade.estado ? `${entidade.cidade} - ${entidade.estado}` : "Marca parceira"}
        avatar={entidade.logo ?? usuario.foto}
        foto={entidade.logo ?? usuario.foto}
        isOwnProfile={isOwn}
        perfilTipoProp="Marca"
        perfilTipoIdProp={entidade.id}
        isVerified={usuario.verified ?? false}
        hasCreator={hasCreator}
        creatorUsuarioId={creatorUsuarioId}
        kpis={[
          { label: "Eventos", value: Number(data.metricas?.eventos ?? 0) },
          { label: "Conteúdos", value: Number(data.metricas?.conteudos ?? 0) },
          { label: "Campanhas", value: Number(data.metricas?.campanhas ?? 0) },
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 mt-5">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            ["perfil", "Perfil"],
            ["eventos", "Eventos"],
            ["conteudos", "Conteúdos"],
            ["postagens", "Postagens"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAba(key as any)}
              className={`rounded-xl py-3 font-bold ${
                aba === key ? "bg-green-100 text-green-900" : "bg-white text-green-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "perfil" && (
          <section className="bg-white rounded-2xl border p-5">
            <h2 className="text-xl font-bold text-green-900 mb-4">
                {tipoPerfil === "federacao" ? "Informações da Federação" : "Informações da Marca"}
            </h2>

            <p><b>Nome:</b> {entidade.nome}</p>
            {entidade.cnpj && <p><b>CNPJ:</b> {entidade.cnpj}</p>}
            {entidade.email && <p><b>Email:</b> {entidade.email}</p>}
            {entidade.siteOficial && <p><b>Site:</b> {entidade.siteOficial}</p>}
            {(entidade.cidade || entidade.estado) && (
            <p><b>Localização:</b> {entidade.cidade} {entidade.estado}</p>
            )}
            {entidade.descricao && <p className="mt-3">{entidade.descricao}</p>}
          </section>
        )}

        {aba === "eventos" && (
          <section className="bg-white rounded-2xl border p-5">
            <h2 className="text-xl font-bold text-green-900 mb-2">Eventos e ativações</h2>
            <p className="text-green-900/70">Eventos, webinars e campanhas patrocinadas da marca.</p>
          </section>
        )}

        {aba === "conteudos" && (
          <section className="bg-white rounded-2xl border p-5">
            <h2 className="text-xl font-bold text-green-900 mb-2">Conteúdos</h2>
            <p className="text-green-900/70">Conteúdos publicados pela marca no Learning.</p>
          </section>
        )}

        {aba === "postagens" && <ProfilePostsSection usuarioId={usuarioId} />}
      </div>
    </div>
  );
}