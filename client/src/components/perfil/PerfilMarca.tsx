import { useEffect, useState } from "react";
import axios from "axios";
import ProfileHeader from "../profile/ProfileHeader.js";
import ProfilePostsSection from "./ProfilePostsSection.js";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { Link } from "wouter";
import {
  CalendarClock,
  ChevronRight,
  Plus,
} from "lucide-react";
import ProfileReplaysSection from "./ProfileReplaysSection.js";

type Props = {
  idDaUrl?: string;
  hasCreator?: boolean;
  creatorUsuarioId?: string | null;
  tipoPerfil?: "marca" | "federacao";
};

type EventoPerfilItem = {
  id: string;
  origem:
    | "EVENTO"
    | "AULA_AO_VIVO";
  acessoPago?: boolean;
  precoAcesso?: number | null;
  titulo: string;
  descricao?: string | null;
  data: string;
  tipoLabel: string;
  status: string;
  cidade?: string | null;
  estado?: string | null;
  totalParticipantes?: number | null;
};

type MetodologiaPerfilItem = {
  id: string;

  titulo: string;

  descricao?: string | null;

  capaUrl?: string | null;

  origemRegistro:
    | "LEARNING"
    | "AVULSA";

  criadorNome?:
    | string
    | null;

  totalItens?:
    number;

  totalConcluidos?:
    number;

  percentualConclusao?:
    number;

  status?:
    string | null;

  progresso?: {
    concluidos?:
      string[];
  };
};

function formatarDataEvento(
  valor?: string | null
) {
  if (!valor) {
    return "Data não informada";
  }

  const data = new Date(valor);

  if (
    Number.isNaN(data.getTime())
  ) {
    return "Data não informada";
  }

  return data.toLocaleString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatarStatusEvento(
  status?: string | null
) {
  const valor = String(
    status || ""
  ).toUpperCase();

  if (valor === "AO_VIVO") {
    return "Ao vivo";
  }

  if (valor === "AGENDADA") {
    return "Agendada";
  }

  if (valor === "ABERTO") {
    return "Aberto";
  }

  if (valor === "FINALIZADA") {
    return "Finalizada";
  }

  if (valor === "ENCERRADO") {
    return "Encerrado";
  }

  if (valor === "CANCELADA") {
    return "Cancelada";
  }

  if (valor === "CANCELADO") {
    return "Cancelado";
  }

  return status || "Evento";
}

export default function PerfilMarca({
  idDaUrl,
  hasCreator = false,
  creatorUsuarioId = null,
  tipoPerfil = "marca",
}: Props) {
  const [data, setData] = useState<any>(null);
    const [
    eventos,
    setEventos,
  ] = useState<
    EventoPerfilItem[]
  >([]);
  const [
    eventosLoading,
    setEventosLoading,
  ] = useState(false);
  const [
    eventosErro,
    setEventosErro,
  ] = useState("");
  const [
    mostrarTodosEventos,
    setMostrarTodosEventos,
  ] = useState(false);
  const [
    metodologiasAssinadas,
    setMetodologiasAssinadas,
  ] =
    useState<
      MetodologiaPerfilItem[]
    >([]);

  const [
    metodologiasLoading,
    setMetodologiasLoading,
  ] = useState(false);
  const [
    metodologiasErro,
    setMetodologiasErro,
  ] = useState("");
  const [aba, setAba] = useState<"perfil" | "eventos" | "conteudos" | "postagens">("perfil");
  const token = Storage.token;
  const usuarioLogadoId =
    String(
      Storage.usuarioId || ""
    ).trim();

  const isOwnPelaRota =
    !idDaUrl ||
    String(idDaUrl) ===
      usuarioLogadoId;

  const id =
    isOwnPelaRota
      ? "me"
    : idDaUrl;

  const usuarioCreatorDoPerfil =
    String(
      creatorUsuarioId ||
        data?.usuario?.id ||
        data?.marca?.usuarioId ||
        data?.federacao
          ?.usuarioId ||
        (
          isOwnPelaRota
            ? usuarioLogadoId
            : ""
        ) ||
        ""
    ).trim();
      
  useEffect(() => {
    if (!token || !id) return;

    axios
      .get(`${API.BASE_URL}/api/perfil/${tipoPerfil}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [id, token, tipoPerfil]);

  useEffect(() => {
    if (
      aba !== "conteudos" ||
      !isOwnPelaRota ||
      !token
    ) {
      return;
    }

    let cancelado =
      false;

    async function carregarMetodologias() {
      try {
        setMetodologiasLoading(
          true
        );

        setMetodologiasErro(
          ""
        );

        const resposta =
          await axios.get(
            `${API.BASE_URL}/api/metodologias/assinadas`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (cancelado) {
          return;
        }

        const items =
          Array.isArray(
            resposta.data
              ?.items
          )
            ? resposta.data
                .items
            : [];

        setMetodologiasAssinadas(
          items
        );
      } catch (error) {
        console.error(
          "Erro ao carregar metodologias assinadas:",
          error
        );

        if (!cancelado) {
          setMetodologiasAssinadas(
            []
          );

          setMetodologiasErro(
            "Não foi possível carregar suas metodologias."
          );
        }
      } finally {
        if (!cancelado) {
          setMetodologiasLoading(
            false
          );
        }
      }
    }

    void carregarMetodologias();

    return () => {
      cancelado = true;
    };
  }, [
    aba,
    isOwnPelaRota,
    token,
  ]);

  useEffect(() => {
    if (
      aba !== "eventos" ||
      !usuarioCreatorDoPerfil
    ) {
      return;
    }

    let cancelado = false;

    async function carregarEventos() {
      try {
        setEventosLoading(true);
        setEventosErro("");

        const [
          eventosResultado,
          livesResultado,
        ] =
          await Promise.allSettled([
            axios.get(
              `${API.BASE_URL}/api/eventos`,
              {
                params: {
                  creatorUsuarioId:
                    usuarioCreatorDoPerfil,
                },
              }
            ),

            axios.get(
              `${API.BASE_URL}/api/creator/profile/${encodeURIComponent(
                usuarioCreatorDoPerfil
              )}`
            ),
          ]);

        if (cancelado) {
          return;
        }

        const eventosNormais =
          eventosResultado.status ===
            "fulfilled" &&
          Array.isArray(
            eventosResultado.value.data
          )
            ? eventosResultado.value.data
            : [];

        const aulasAoVivo =
          livesResultado.status ===
            "fulfilled" &&
          Array.isArray(
            livesResultado.value
              .data?.eventosAoVivo
          )
            ? livesResultado.value
                .data.eventosAoVivo
            : [];

        const aulasAoVivoComDetalhes =
          await Promise.all(
            aulasAoVivo.map(
              async (aula: any) => {
                const aulaId =
                  String(
                    aula?.id ?? ""
                  ).trim();

                if (!aulaId) {
                  return aula;
                }

                try {
                  const detalheResposta =
                    await axios.get(
                      `${API.BASE_URL}/api/learning/eventos/aulas/${encodeURIComponent(
                        aulaId
                      )}`,
                      {
                        headers: token
                          ? {
                              Authorization:
                                `Bearer ${token}`,
                            }
                          : undefined,
                      }
                    );

                  const detalhe =
                    detalheResposta
                      .data?.item ??
                    detalheResposta
                      .data?.evento ??
                    null;

                  if (!detalhe) {
                    return aula;
                  }

                  return {
                    ...aula,
                    ...detalhe,

                    acesso:
                      detalhe.acesso ??
                      aula.acesso ??
                      null,
                  };
                } catch (error) {
                  console.warn(
                    `[PerfilMarca] Não foi possível carregar os detalhes da aula ${aulaId}:`,
                    error
                  );

                  return aula;
                }
              }
            )
          );

        const normaisNormalizados:
          EventoPerfilItem[] =
          eventosNormais.map(
            (evento: any) => ({
              id:
                String(evento.id),

              origem:
                "EVENTO",

              titulo:
                String(
                  evento.titulo ||
                    "Evento"
                ),

              descricao:
                evento.descricao ??
                null,

              data:
                String(
                  evento.dataEvento ||
                    ""
                ),

              tipoLabel:
                String(
                  evento.tipoLabel ||
                    evento.tipo ||
                    "Evento"
                ),

              status:
                String(
                  evento.status ||
                    "ABERTO"
                ),

              cidade:
                evento.cidade ??
                null,

              estado:
                evento.estado ??
                null,

              totalParticipantes:
                null,
            })
          );

        const livesNormalizadas:
          EventoPerfilItem[] =
          aulasAoVivoComDetalhes.map(
            (aula: any) => {
              const precoNumerico =
                Number(
                  aula?.precoAcesso ??
                    aula?.acesso
                      ?.preco ??
                    0
                );

              const possuiPreco =
                Number.isFinite(
                  precoNumerico
                ) &&
                precoNumerico > 0;

              const eventoPago =
                aula?.acessoPago ===
                  true ||
                possuiPreco;

              return {
                id:
                  String(aula.id),

                origem:
                  "AULA_AO_VIVO",

                titulo:
                  String(
                    aula.titulo ||
                      "Aula ao vivo"
                  ),

                descricao:
                  aula.descricao ??
                  null,

                data:
                  String(
                    aula.dataInicio ||
                      ""
                  ),

                tipoLabel:
                  aula.metodologia
                    ?.titulo
                    ? "Aula ao vivo"
                    : aula
                        .metodologiaAvulsa
                        ?.titulo
                    ? "Aula ao vivo avulsa"
                    : "Evento ao vivo",

                status:
                  String(
                    aula.status ||
                      "AGENDADA"
                  ),

                cidade: null,
                estado: null,

                totalParticipantes:
                  typeof aula
                    .totalParticipantes ===
                  "number"
                    ? aula
                        .totalParticipantes
                    : 0,

                acessoPago:
                  eventoPago,

                precoAcesso:
                  possuiPreco
                    ? precoNumerico
                    : null,
              };
            }
          );

        const agora =
          Date.now();

        const proximos = [
          ...normaisNormalizados,
          ...livesNormalizadas,
        ]
          .filter((evento) => {
            const status =
              evento.status
                .toUpperCase();

            if (
              status ===
              "AO_VIVO"
            ) {
              return true;
            }

            if (
              [
                "FINALIZADA",
                "FINALIZADO",
                "ENCERRADO",
                "CANCELADA",
                "CANCELADO",
              ].includes(status)
            ) {
              return false;
            }

            const timestamp =
              new Date(
                evento.data
              ).getTime();

            return (
              Number.isFinite(
                timestamp
              ) &&
              timestamp >= agora
            );
          })
          .sort((eventoA, eventoB) => {
            const dataA =
              new Date(
                eventoA.data
              ).getTime();

            const dataB =
              new Date(
                eventoB.data
              ).getTime();

            return dataA - dataB;
          });

        setEventos(proximos);
      } catch (error) {
        console.error(
          "Erro ao carregar eventos do perfil:",
          error
        );

        if (!cancelado) {
          setEventos([]);
          setEventosErro(
            "Não foi possível carregar os eventos."
          );
        }
      } finally {
        if (!cancelado) {
          setEventosLoading(false);
        }
      }
    }

    void carregarEventos();

    return () => {
      cancelado = true;
    };
  }, [
    aba,
    usuarioCreatorDoPerfil,
    token,
  ]);

  useEffect(() => {
    setMostrarTodosEventos(false);
  }, [
    usuarioCreatorDoPerfil,
  ]);

  if (!data) {
    return <div className="p-10 text-center text-red-600">Marca não encontrada.</div>;
  }

  const entidade = tipoPerfil === "federacao"
    ? data.federacao ?? data
    : data.marca ?? data;

  const usuario = data.usuario ?? entidade.usuario ?? {};
  const usuarioId = usuario.id ?? entidade.usuarioId;
  const isOwn =
    !idDaUrl ||
    String(usuarioId || "") ===
      usuarioLogadoId;
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
  const eventosPreview =
    mostrarTodosEventos
      ? eventos
      : eventos.slice(0, 5);

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
            <div className="mt-4 grid gap-5">
              <section className="mt-4 rounded-xl border bg-transparent p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="mb-2 text-xl font-semibold text-green-900">
                      {isFederacao
                        ? "Eventos oficiais"
                        : "Eventos e ativações"}
                    </h2>

                    <p className="text-sm text-green-900/80">
                      {isFederacao
                        ? "Confira os próximos eventos, seletivas, webinars e ativações oficiais da federação."
                        : "Confira os próximos eventos, webinars e campanhas patrocinadas da marca."}
                    </p>
                  </div>

                  {isOwn && (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/creator/eventos"
                        className="
                          inline-flex items-center
                          justify-center rounded-lg
                          border border-green-200
                          bg-white px-3 py-2
                          text-xs font-semibold
                          text-green-900
                          hover:bg-green-50
                        "
                      >
                        Ver todos os eventos
                      </Link>

                      <Link
                        href="/creator/eventos/novo"
                        className="
                          inline-flex items-center
                          justify-center gap-1
                          rounded-lg bg-green-800
                          px-3 py-2
                          text-xs font-semibold
                          text-white
                          hover:bg-green-900
                        "
                      >
                        <Plus className="h-4 w-4" />
                        Criar evento
                      </Link>
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  {eventosLoading ? (
                    <div className="text-sm text-green-900/70">
                      Carregando eventos…
                    </div>
                  ) : eventosErro ? (
                    <div className="text-sm text-red-600">
                      {eventosErro}
                    </div>
                  ) : eventosPreview.length >
                    0 ? (
                    <ul className="grid grid-cols-1 gap-3">
                      {eventosPreview.map(
                        (evento) => {
                          const local = [
                            evento.cidade,
                            evento.estado,
                          ]
                            .filter(Boolean)
                            .join(" - ");

                          const participantes =
                            evento.origem ===
                              "AULA_AO_VIVO" &&
                            typeof evento
                              .totalParticipantes ===
                              "number"
                              ? `${evento.totalParticipantes} participante(s)`
                              : "";

                          const href =
                            evento.origem ===
                            "AULA_AO_VIVO"
                              ? `/learning/evento/${evento.id}`
                              : `/eventos/${evento.id}`;

                          return (
                            <li key={`${evento.origem}_${evento.id}`}>
                              <Link
                                href={href}
                                className="
                                  flex flex-col gap-3
                                  rounded-xl
                                  border border-green-100
                                  bg-white/70 p-3
                                  hover:bg-white
                                  sm:flex-row
                                  sm:items-center
                                "
                              >
                                <div
                                  className="
                                    flex h-10 w-10
                                    shrink-0 items-center
                                    justify-center
                                    rounded-full
                                    bg-green-100
                                    text-green-800
                                  "
                                >
                                  <CalendarClock className="h-5 w-5" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold text-green-900">
                                    {evento.titulo}
                                  </div>

                                  <div className="mt-0.5 text-xs text-green-900/70">
                                    {[
                                      evento.tipoLabel,
                                      formatarDataEvento(
                                        evento.data
                                      ),
                                      local,
                                      participantes,
                                    ]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </div>

                                  {evento.descricao && (
                                    <p className="mt-1 line-clamp-2 text-xs text-green-900/70">
                                      {evento.descricao}
                                    </p>
                                  )}
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                                  {evento.origem ===
                                    "AULA_AO_VIVO" && (
                                    <span
                                      className="
                                        rounded-full
                                        border border-green-200
                                        bg-white
                                        px-2 py-1
                                        text-[11px]
                                        font-medium
                                        text-green-800
                                      "
                                    >
                                      {evento.acessoPago
                                        ? evento.precoAcesso != null &&
                                          evento.precoAcesso > 0
                                          ? evento.precoAcesso.toLocaleString(
                                              "pt-BR",
                                              {
                                                style: "currency",
                                                currency: "BRL",
                                              }
                                            )
                                          : "Evento pago"
                                        : "Gratuito"}
                                    </span>
                                  )}

                                  <span
                                    className="
                                      rounded-full
                                      border border-green-200
                                      bg-green-50
                                      px-2 py-1
                                      text-[11px]
                                      font-medium
                                      text-green-800
                                    "
                                  >
                                    {formatarStatusEvento(
                                      evento.status
                                    )}
                                  </span>

                                  <ChevronRight className="h-4 w-4 text-green-700" />
                                </div>
                              </Link>
                            </li>
                          );
                        }
                      )}
                    </ul>
                  ) : (
                    <div
                      className="
                        rounded-xl
                        border border-dashed
                        border-green-200
                        bg-white/40
                        px-4 py-6
                        text-center
                        text-sm
                        text-green-900/70
                      "
                    >
                      Nenhum evento futuro cadastrado.
                    </div>
                  )}
                </div>

                {eventos.length > 5 && (
                  <div className="mt-4 flex justify-center">
                    {isOwn ? (
                      <Link
                        href="/creator/eventos"
                        className="
                          rounded-lg
                          border border-green-200
                          px-4 py-2
                          text-sm font-semibold
                          text-green-900
                          hover:bg-green-50
                        "
                      >
                        Ver todos ({eventos.length})
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setMostrarTodosEventos(
                            (anterior) =>
                              !anterior
                          )
                        }
                        className="
                          rounded-lg
                          border border-green-200
                          px-4 py-2
                          text-sm font-semibold
                          text-green-900
                          hover:bg-green-50
                        "
                      >
                        {mostrarTodosEventos
                          ? "Mostrar menos"
                          : `Ver todos (${eventos.length})`}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <ProfileReplaysSection
                  creatorUsuarioId={
                    usuarioCreatorDoPerfil
                  }
              />
            </div>
          )}

          {aba === "conteudos" && (
            <div className="mt-4 space-y-4">
              <section className="bg-transparent border rounded-xl shadow-sm p-4">
                <div
                  className="
                    flex flex-col
                    gap-4
                    sm:flex-row
                    sm:items-start
                    sm:justify-between
                  "
                >
                  <div>
                    <h2 className="text-green-900 text-xl font-semibold mb-2">
                      {isFederacao
                        ? "Conteúdos oficiais"
                        : "Conteúdos"}
                    </h2>

                    <p className="text-sm text-green-900/80">
                      {isFederacao
                        ? "Acesse metodologias e publique conteúdos oficiais da federação no Learning."
                        : "Acesse metodologias e publique conteúdos da marca no Learning."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/learning"
                      className="
                        inline-flex
                        items-center
                        justify-center
                        rounded-lg
                        border
                        border-green-200
                        bg-white
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-green-900
                        hover:bg-green-50
                      "
                    >
                      Ver todas as metodologias
                    </Link>

                    {isOwn && (
                      <Link
                        href="/learning/create"
                        className="
                          inline-flex
                          items-center
                          justify-center
                          gap-1
                          rounded-lg
                          bg-green-800
                          px-3
                          py-2
                          text-xs
                          font-semibold
                          text-white
                          hover:bg-green-900
                        "
                      >
                        <Plus className="h-4 w-4" />
                        Criar conteúdo
                      </Link>
                    )}
                  </div>
                </div>
              </section>

              {isOwn && (
                <section className="bg-transparent border rounded-xl shadow-sm p-4">
                  <h3 className="text-lg font-semibold text-green-900">
                    Minhas metodologias
                  </h3>

                  <p className="mt-1 text-sm text-green-900/70">
                    Metodologias Learning e avulsas que você possui acesso.
                  </p>

                  {metodologiasLoading ? (
                    <div className="mt-4 text-sm text-green-900/70">
                      Carregando metodologias...
                    </div>
                  ) : metodologiasErro ? (
                    <div className="mt-4 text-sm text-red-600">
                      {metodologiasErro}
                    </div>
                  ) : metodologiasAssinadas.length === 0 ? (
                    <div
                      className="
                        mt-4
                        rounded-xl
                        border
                        border-dashed
                        border-green-200
                        bg-white/40
                        p-5
                        text-sm
                        text-green-900/70
                      "
                    >
                      Você ainda não possui nenhuma metodologia ativa.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {metodologiasAssinadas.map(
                        (metodologia) => {
                          const percentual =
                            Math.max(
                              0,
                              Math.min(
                                100,
                                Number(
                                  metodologia
                                    .percentualConclusao ??
                                    0
                                )
                              )
                            );

                          const href =
                            metodologia
                              .origemRegistro ===
                            "AVULSA"
                              ? `/learning/${metodologia.id}?origem=avulsa`
                              : `/learning/${metodologia.id}`;

                          return (
                            <Link
                              key={`${metodologia.origemRegistro}-${metodologia.id}`}
                              href={href}
                              className="
                                block
                                rounded-xl
                                border
                                border-green-100
                                bg-white/70
                                p-3
                                transition
                                hover:border-green-300
                                hover:bg-white
                              "
                            >
                              <div className="flex gap-3">
                                <img
                                  src={
                                    metodologia.capaUrl ||
                                    "/assets/usuarios/footera-logo-fundo-verde.png"
                                  }
                                  alt={
                                    metodologia.titulo
                                  }
                                  onError={(e) => {
                                    e.currentTarget.onerror =
                                      null;

                                    e.currentTarget.src =
                                      "/assets/usuarios/footera-logo-fundo-verde.png";
                                  }}
                                  className="
                                    h-20
                                    w-28
                                    shrink-0
                                    rounded-lg
                                    border
                                    object-cover
                                    bg-white
                                  "
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-green-950 break-words">
                                        {
                                          metodologia.titulo
                                        }
                                      </div>

                                      <div className="mt-1 text-xs text-green-900/60">
                                        {metodologia.origemRegistro ===
                                        "AVULSA"
                                          ? "Metodologia avulsa"
                                          : "Learning"}
                                      </div>
                                    </div>

                                    <ChevronRight className="h-5 w-5 shrink-0 text-green-700" />
                                  </div>

                                  {metodologia.criadorNome ? (
                                    <div className="mt-1 text-xs text-green-900/70">
                                      Criado por:{" "}
                                      <b>
                                        {
                                          metodologia.criadorNome
                                        }
                                      </b>
                                    </div>
                                  ) : null}

                                  <div className="mt-3">
                                    <div className="flex items-center justify-between gap-3 text-xs text-green-900/70">
                                      <span>
                                        {Number(
                                          metodologia.totalConcluidos ??
                                            0
                                        )}
                                        /
                                        {Number(
                                          metodologia.totalItens ??
                                            0
                                        )}{" "}
                                        concluídos
                                      </span>

                                      <span>
                                        {percentual}%
                                      </span>
                                    </div>

                                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-green-100">
                                      <div
                                        className="h-full bg-green-700 transition-all"
                                        style={{
                                          width:
                                            `${percentual}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        }
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {aba === "postagens" && (
            <ProfilePostsSection usuarioId={usuarioId} />
          )}
        </div>
      </div>
    </div>
  );
}