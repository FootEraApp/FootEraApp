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
  const isFederacao = tipoPerfil === "federacao";
  const nomeInfo = entidade.nome || usuario.nome || "Não informado";
  const emailInfo = entidade.email || usuario.email || "";
  const cnpjInfo = entidade.cnpj || "";
  const telefone1Info = entidade.telefone1 || "";
  const telefone2Info = entidade.telefone2 || "";
  const siteInfo = entidade.siteOficial || "";
  const sedeInfo = entidade.sede || "";
  const cepInfo = entidade.cep || usuario.cep || "";
  const logradouroInfo = entidade.logradouro || usuario.logradouro || "";
  const cidadeInfo = entidade.cidade || usuario.cidade || "";
  const estadoInfo = entidade.estado || usuario.estado || "";
  const paisInfo = entidade.pais || usuario.pais || "";
  const descricaoInfo = entidade.descricao || "";

  const localizacaoInfo = [cidadeInfo, estadoInfo, paisInfo]
    .filter(Boolean)
    .join(" - ");

  const enderecoInfo = [
    logradouroInfo,
    localizacaoInfo,
  ]
  .filter(Boolean)
  .join(" • ");

  const subtituloPerfil =
    entidade.cidade && entidade.estado
      ? `${entidade.cidade} - ${entidade.estado}`
      : isFederacao
      ? "Federação oficial"
      : "Marca parceira";

  const tipoPerfilHeader = isFederacao ? "Federacao" : "Marca";

  return (
    <div className="pb-24">
      <div className="w-full max-w-2xl mx-auto">
        <ProfileHeader
          perfilId={usuarioId}
          nome={entidade.nome ?? usuario.nome ?? (isFederacao ? "Federação" : "Marca")}
          time={subtituloPerfil}
          avatar={entidade.logo ?? usuario.foto}
          foto={entidade.logo ?? usuario.foto}
          isOwnProfile={isOwn}
          perfilTipoProp={tipoPerfilHeader}
          perfilTipoIdProp={entidade.id}
          isVerified={usuario.verified ?? false}
          hasCreator={hasCreator}
          creatorUsuarioId={creatorUsuarioId}
          kpis={[
            { label: "Eventos", value: Number(data.metricas?.eventos ?? 0) },
            { label: "Conteúdos", value: Number(data.metricas?.conteudos ?? 0) },
            {
              label: "Conquistas",
              value: Number(
                data.metricas?.conquistasCertificados ??
                  data.metricas?.conquistas ??
                  0
              ),
            },
          ]}
        />

        <div className="max-w-3xl mx-auto px-4 mt-5">
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              ["perfil", "Perfil"],
              ["eventos", "Eventos"],
              ["conteudos", "Conteúdos"],
              ["postagens", "Postagens"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setAba(key as any)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  aba === key
                    ? "bg-green-100 text-green-900"
                    : "bg-white/70 text-green-900 hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {aba === "perfil" && (
            <section className="bg-transparent border rounded-xl shadow-sm p-4 mt-4">
              <h2 className="text-green-900 text-xl font-semibold mb-3">
                {isFederacao ? "Informações da Federação" : "Informações da Marca"}
              </h2>

              <ul className="text-sm text-green-900/90 space-y-2">
                <li>
                  <b>Nome:</b> {nomeInfo}
                </li>

                {emailInfo ? (
                  <li>
                    <b>Email:</b> {emailInfo}
                  </li>
                ) : null}

                {cnpjInfo ? (
                  <li>
                    <b>CNPJ:</b> {cnpjInfo}
                  </li>
                ) : null}

                {telefone1Info ? (
                  <li>
                    <b>Telefone 1:</b> {telefone1Info}
                  </li>
                ) : null}

                {telefone2Info ? (
                  <li>
                    <b>Telefone 2:</b> {telefone2Info}
                  </li>
                ) : null}

                {siteInfo ? (
                  <li>
                    <b>Site oficial:</b>{" "}
                    <a
                      href={
                        String(siteInfo).startsWith("http")
                          ? siteInfo
                          : `https://${siteInfo}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-800 underline"
                    >
                      {siteInfo}
                    </a>
                  </li>
                ) : null}

                {sedeInfo ? (
                  <li>
                    <b>Sede:</b> {sedeInfo}
                  </li>
                ) : null}

                {enderecoInfo ? (
                  <li>
                    <b>Endereço:</b> {enderecoInfo}
                  </li>
                ) : null}

                {descricaoInfo ? (
                  <li>
                    <b>Descrição:</b> {descricaoInfo}
                  </li>
                ) : null}
              </ul>
            </section>
          )}

          {aba === "eventos" && (
            <section className="bg-transparent border rounded-xl shadow-sm p-4 mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-green-900 text-xl font-semibold mb-2">
                    {isFederacao ? "Eventos oficiais" : "Eventos e ativações"}
                  </h2>

                  <p className="text-sm text-green-900/80">
                    {isFederacao
                      ? "Crie eventos, seletivas, webinars e ativações oficiais da federação."
                      : "Crie eventos, webinars e campanhas patrocinadas da marca."}
                  </p>
                </div>

                {isOwn && (
                  <a
                    href="/creator/eventos"
                    className="shrink-0 rounded-lg bg-green-800 px-3 py-2 text-xs font-semibold text-white hover:bg-green-900"
                  >
                    Criar evento
                  </a>
                )}
              </div>
            </section>
          )}

          {aba === "conteudos" && (
            <section className="bg-transparent border rounded-xl shadow-sm p-4 mt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-green-900 text-xl font-semibold mb-2">
                    {isFederacao ? "Conteúdos oficiais" : "Conteúdos"}
                  </h2>

                  <p className="text-sm text-green-900/80">
                    {isFederacao
                      ? "Publique cursos, metodologias e materiais oficiais da federação no Learning."
                      : "Publique conteúdos, cursos e metodologias da marca no Learning."}
                  </p>
                </div>

                {isOwn && (
                  <a
                    href="/learning"
                    className="shrink-0 rounded-lg bg-green-800 px-3 py-2 text-xs font-semibold text-white hover:bg-green-900"
                  >
                    Criar conteúdo
                  </a>
                )}
              </div>
            </section>
          )}

          {aba === "postagens" && (
            <ProfilePostsSection usuarioId={usuarioId} />
          )}
        </div>
      </div>
    </div>
  );
}