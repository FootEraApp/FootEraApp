import { useEffect, useState } from "react";
import axios from "axios";
import {
  Pencil,
} from "lucide-react";
import { Link } from "wouter";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import ProfilePostsSection from "./ProfilePostsSection.js";

type AulaLearningPerfil = {
  id: string;
  titulo: string;

  descricao?:
    | string
    | null;

  status:
    | "AGENDADA"
    | "AO_VIVO"
    | "FINALIZADA"
    | "CANCELADA"
    | string;

  dataInicio?:
    | string
    | null;

  iniciouEm?:
    | string
    | null;

  finalizouEm?:
    | string
    | null;

  replayDisponivel?:
    boolean;

  replayExpiraEm?:
    | string
    | null;

  replayExpirado?:
    boolean;

  precoAcesso?:
    number | null;

  acessoPago?:
    boolean;

  origemAcesso?:
    | "COMPRA"
    | "GRATUITO"
    | "PRESENCA"
    | "ASSINATURA"
    | "CONVITE"
    | string
    | null;

  criadorUsuario?: {
    id?: string | null;
    nome?: string | null;
    nomeDeUsuario?: string | null;
    foto?: string | null;
  } | null;
};

export default function PerfilLearning({ idDaUrl }: { idDaUrl?: string }) {
  const [data, setData] = useState<any>(null);
  const [aba, setAba] = useState<"perfil" | "cursos" | "conquistas" | "postagens">("perfil");
  const [earnedBadges, setEarnedBadges] = useState<any[]>([]);
  const [certificados, setCertificados] = useState<any[]>([]);
  const [progressoCursos, setProgressoCursos] = useState<Record<string, number>>({});
  const [
    aulasLearning,
    setAulasLearning,
  ] = useState<
    AulaLearningPerfil[]
  >([]);

  const [
    aulasLearningLoading,
    setAulasLearningLoading,
  ] = useState(false);

  const [
    aulasLearningErro,
    setAulasLearningErro,
  ] = useState("");

  const token =
    Storage.token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const meuId =
    Storage.usuarioId ||
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    "";

  const isOwnPelaRota =
    !idDaUrl ||
    idDaUrl === meuId;

  const id =
    isOwnPelaRota
      ? "me"
      : idDaUrl;

  const usuarioIdDoPerfil =
    String(
      data?.usuario?.id ||
        data?.learning?.usuarioId ||
        ""
    );

  const isOwn =
    isOwnPelaRota ||
    (
      !!meuId &&
      usuarioIdDoPerfil ===
        meuId
    );

  useEffect(() => {
    if (!token || !id) return;

    axios
      .get(`${API.BASE_URL}/api/perfil/learning/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [id, token]);

  
  const usuarioIdParaConquistas =
    data?.usuario?.id ??
    data?.learning?.usuarioId ??
    idDaUrl ??
    meuId;

  useEffect(() => {
    if (
      !data ||
      !isOwn ||
      !token
    ) {
      setAulasLearning([]);
      setAulasLearningErro("");
      return;
    }

    let cancelado = false;

    async function carregarAulasLearning() {
      try {
        setAulasLearningLoading(true);
        setAulasLearningErro("");

        const resposta =
          await axios.get(
            `${API.BASE_URL}/api/learning/eventos/minhas-aulas`,
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
            resposta.data?.items
          )
            ? resposta.data.items
            : [];

        setAulasLearning(items);
      } catch (error: any) {
        const status =
          error?.response?.status;

        const mensagemBackend =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Não foi possível carregar suas aulas ao vivo.";

        console.error(
          "Erro ao carregar aulas Learning:",
          {
            status,
            mensagem:
              mensagemBackend,
            resposta:
              error?.response?.data,
            url:
              `${API.BASE_URL}/api/learning/eventos/minhas-aulas`,
          }
        );

        if (!cancelado) {
          setAulasLearning([]);

          if (status === 401) {
            setAulasLearningErro(
              "Sua sessão expirou. Entre novamente para carregar seus conteúdos."
            );
          } else if (status === 404) {
            setAulasLearningErro(
              "A rota de aulas do Learning ainda não foi registrada no servidor."
            );
          } else {
            setAulasLearningErro(
              mensagemBackend
            );
          }
        }
      } finally {
        if (!cancelado) {
          setAulasLearningLoading(false);
        }
      }
    }

    void carregarAulasLearning();

    return () => {
      cancelado = true;
    };
  }, [
    data,
    isOwn,
    token,
  ]);

  useEffect(() => {
    if (!token || !usuarioIdParaConquistas) return;

    let cancel = false;

    async function carregarConquistas() {
      try {
        const [conqRes, certRes] = await Promise.allSettled([
          axios.get(
            `${API.BASE_URL}/api/conquistas/${encodeURIComponent(usuarioIdParaConquistas)}?onlyConcluidas=1`,
            {
              headers: { Authorization: `Bearer ${token}` },
              withCredentials: true,
            }
          ),
          axios.get(
            `${API.BASE_URL}/api/conquistas/certificados/${encodeURIComponent(usuarioIdParaConquistas)}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              withCredentials: true,
            }
          ),
        ]);

        if (cancel) return;

        if (conqRes.status === "fulfilled") {
          setEarnedBadges(Array.isArray(conqRes.value.data?.earned) ? conqRes.value.data.earned : []);
        }

        if (certRes.status === "fulfilled") {
          setCertificados(Array.isArray(certRes.value.data?.items) ? certRes.value.data.items : []);
        }
      } catch {
        if (!cancel) {
          setEarnedBadges([]);
          setCertificados([]);
        }
      }
    }

    carregarConquistas();

    return () => {
      cancel = true;
    };
  }, [token, usuarioIdParaConquistas]);

  function getCursoIdentity(curso: any) {
    const origem = String(
      curso.origem ||
        curso.origemTipo ||
        curso.assinatura?.origem ||
        ""
    ).toUpperCase();

    const metodologiaAvulsaId =
      curso.metodologiaAvulsaId ||
      curso.metodologiaAvulsa?.id ||
      curso.avulsaId ||
      null;

    const metodologiaId =
      curso.metodologiaId ||
      curso.metodologia?.id ||
      curso.id ||
      null;

    const isAvulsa = origem === "AVULSA" || !!metodologiaAvulsaId;
    const idFinal = metodologiaAvulsaId || metodologiaId;

    return {
      id: idFinal ? String(idFinal) : "",
      isAvulsa,
      key: `${isAvulsa ? "AVULSA" : "LEARNING"}:${idFinal || ""}`,
    };
  }

  useEffect(() => {
    if (!token) return;

    const conteudosRaw = Array.isArray(data?.conteudos) ? data.conteudos : [];
    if (!conteudosRaw.length) return;

    let cancel = false;

    async function carregarProgressosReais() {
      const atualizacoes: Record<string, number> = {};

      await Promise.all(
        conteudosRaw.map(async (curso: any) => {
          const info = getCursoIdentity(curso);

          if (!info.id) return;

          const progressoFallback = Number(
            curso.progressoPercentual ??
              curso.progresso ??
              curso.percentual ??
              0
          ) || 0;

          try {
            const url = info.isAvulsa
              ? `${API.BASE_URL}/api/metodologias/metodologias-avulsas/${encodeURIComponent(info.id)}?_t=${Date.now()}`
              : `${API.BASE_URL}/api/metodologias/${encodeURIComponent(info.id)}/detalhe?_t=${Date.now()}`;

            const res = await axios.get(url, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            const raw = res.data?.item ?? res.data;

            const estruturas = Array.isArray(raw?.estruturas)
              ? raw.estruturas
              : [];

            const itens = estruturas.flatMap((estrutura: any) =>
              Array.isArray(estrutura?.itens)
                ? estrutura.itens.filter((it: any) => it?.publicado !== false)
                : []
            );

            const totalItens = itens.length;

            const concluidosRaw = Array.isArray(raw?.viewer?.progresso?.concluidos)
              ? raw.viewer.progresso.concluidos
              : [];

            const concluidosSet = new Set(
              concluidosRaw.map((v: any) => String(v))
            );

            const totalConcluidos = itens.filter((it: any) =>
              concluidosSet.has(String(it.id))
            ).length;

            atualizacoes[info.key] =
              totalItens > 0
                ? Math.round((totalConcluidos / totalItens) * 100)
                : progressoFallback;
          } catch (e) {
            atualizacoes[info.key] = progressoFallback;
          }
        })
      );

      if (!cancel) {
        setProgressoCursos((prev) => ({
          ...prev,
          ...atualizacoes,
        }));
      }
    }

    carregarProgressosReais();

    return () => {
      cancel = true;
    };
  }, [token, data?.conteudos]);

  function formatarDataAula(
    valor?: string | null
  ) {
    if (!valor) {
      return "Data não informada";
    }

    const data =
      new Date(valor);

    if (
      Number.isNaN(
        data.getTime()
      )
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

  function formatarOrigemAcesso(
    origem?: string | null
  ) {
    const valor =
      String(
        origem || ""
      ).toUpperCase();

    if (valor === "COMPRA") {
      return "Acesso comprado";
    }

    if (valor === "GRATUITO") {
      return "Acesso gratuito";
    }

    if (valor === "PRESENCA") {
      return "Aula assistida";
    }

    if (valor === "ASSINATURA") {
      return "Incluída na assinatura";
    }

    if (valor === "CONVITE") {
      return "Você foi convidado";
    }

    return "Acesso liberado";
  }

  if (!data) {
    return (
      <div className="p-10 text-center text-red-600">
        Perfil Learning não encontrado.
      </div>
    );
  }

  const usuario = data.usuario ?? {};
  const usuarioId = usuario.id ?? data.learning?.usuarioId ?? idDaUrl ?? meuId;
  const conteudosOriginais = Array.isArray(data.conteudos) ? data.conteudos : [];

  const conteudos = conteudosOriginais.map((curso: any) => {
    const info = getCursoIdentity(curso);
    const progressoReal = progressoCursos[info.key];

    const progressoFinal =
      typeof progressoReal === "number"
        ? progressoReal
        : Number(curso.progressoPercentual ?? curso.progresso ?? 0) || 0;

    return {
      ...curso,
      progressoPercentual: progressoFinal,
      progresso: progressoFinal,
    };
  });

  const aulasComoCursos =
    aulasLearning
      .filter((aula) => {
        const status =
          String(
            aula.status || ""
          ).toUpperCase();

        return (
          status !==
          "CANCELADA"
        );
      })
      .map((aula) => {
        const status =
          String(
            aula.status || ""
          ).toUpperCase();

        const finalizada =
          status ===
          "FINALIZADA";

        return {
          key:
            `AULA_AO_VIVO:${aula.id}`,
          id:
            aula.id,
          aulaId:
            aula.id,
          tipoConteudo:
            "AULA_AO_VIVO",
          titulo:
            aula.titulo,
          descricao:
            aula.descricao,
          status:
            aula.status,
          dataInicio:
            aula.dataInicio,
          iniciouEm:
            aula.iniciouEm,
          finalizouEm:
            aula.finalizouEm,
          replayDisponivel:
            aula.replayDisponivel ===
            true,
          replayExpiraEm:
            aula.replayExpiraEm,
          replayExpirado:
            aula.replayExpirado ===
            true,
          precoAcesso:
            Number(
              aula.precoAcesso ??
                0
            ),
          acessoPago:
            aula.acessoPago ===
            true,
          origemAcesso:
            aula.origemAcesso,
          criadorUsuario:
            aula.criadorUsuario,
          progressoPercentual:
            finalizada
              ? 100
              : 0,
          progresso:
            finalizada
              ? 100
              : 0,
        };
      });

  const todosOsCursos = [
    ...conteudos.map(
      (curso: any) => ({
        ...curso,

        key:
          `METODOLOGIA:${
            getCursoIdentity(
              curso
            ).key
          }`,

        tipoConteudo:
          "METODOLOGIA",
      })
    ),

    ...aulasComoCursos,
  ];

  function getCursoHref(curso: any) {

    if (
      curso.tipoConteudo ===
      "AULA_AO_VIVO"
    ) {
      const aulaId =
        String(
          curso.aulaId ||
            curso.id ||
            ""
        );

      const status =
        String(
          curso.status ||
            ""
        ).toUpperCase();

      if (
        status === "AO_VIVO" ||
        (
          status ===
            "FINALIZADA" &&
          curso.replayDisponivel ===
            true &&
          curso.replayExpirado !==
            true
        )
      ) {
        return `/learning/live?aulaId=${encodeURIComponent(
          aulaId
        )}`;
      }

      return `/learning/evento/${encodeURIComponent(
        aulaId
      )}`;
    }

    const origem = String(
      curso.origem ||
        curso.origemTipo ||
        curso.assinatura?.origem ||
        ""
    ).toUpperCase();

    const metodologiaAvulsaId =
      curso.metodologiaAvulsaId ||
      curso.metodologiaAvulsa?.id ||
      curso.avulsaId ||
      null;

    const metodologiaId =
      curso.metodologiaId ||
      curso.metodologia?.id ||
      curso.id;

    if (origem === "AVULSA" || metodologiaAvulsaId) {
      return `/learning/${encodeURIComponent(
        metodologiaAvulsaId || metodologiaId
      )}?origem=avulsa`;
    }

    return `/learning/${encodeURIComponent(metodologiaId)}`;
  }

  const cursosFinalizados = todosOsCursos.filter((item: any) => {
    const status = String(item.status || item.assinatura?.status || "").toUpperCase();
    const progresso = Number(item.progressoPercentual ?? item.progresso ?? 0);

      return status === "CONCLUIDA" || status === "CONCLUÍDA" || progresso >= 100;
    });

  const cursosEmAndamento = todosOsCursos.filter((item: any) => {
    const status = String(item.status || item.assinatura?.status || "").toUpperCase();
    const progresso = Number(item.progressoPercentual ?? item.progresso ?? 0);

    return status !== "CONCLUIDA" && status !== "CONCLUÍDA" && progresso < 100;
  });

  const totalLearningsConcluidos = cursosFinalizados.length;
  const totalConquistasECertificados =
    earnedBadges.length + certificados.length;

  const totalSeguidores =
    Number(
      data.metricas?.seguidores ??
      data.usuario?.seguidoresCount ??
      data.usuario?.totalSeguidores ??
      data.seguidoresCount ??
      0
    ) || 0;

  return (
    <div className="pb-24 bg-[#f5f2e8] min-h-screen">
      <div className="w-full max-w-2xl mx-auto">
      <ProfileHeader
        perfilId={usuarioId}
        nome={usuario.nome ?? usuario.nomeDeUsuario ?? "Learning"}
        time="Conta Learning"
        avatar={usuario.foto}
        foto={usuario.foto}
        isOwnProfile={isOwn}
        perfilTipoProp="Learning"
        perfilTipoIdProp={data.learning?.id ?? null}
        isVerified={usuario.verified ?? false}
        hasCreator={false}
        creatorUsuarioId={null}
        kpis={[
          {
            label: "Learnings",
            value: totalLearningsConcluidos,
          },
          {
            label: "Conquistas",
            value: totalConquistasECertificados,
          },
          {
            label: "Seguidores",
            value: totalSeguidores,
          },
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 mt-5">
        <div className={`mt-4 grid gap-2 mb-4 ${
            isOwn
              ? "grid-cols-4"
              : "grid-cols-3"
          }`}>
          {[
            ["perfil", "Perfil"],

            ...(isOwn
              ? [
                  [
                    "cursos",
                    "Meus conteúdos",
                  ],
                ]
              : []),

            [
              "conquistas",
              "Conquistas",
            ],

            [
              "postagens",
              "Postagens",
            ],
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
          <div className="space-y-4">
            <section className="border rounded-2xl p-5">
              <h2 className="text-2xl text-green-900 mb-4">
                Informações do Learning
              </h2>

              <div className="space-y-2 text-green-900 text-base">
                <p>
                  <strong>Nome:</strong>{" "}
                  {usuario.nome || "Não informado"}
                </p>

                <p>
                  <strong>Nome de usuário:</strong>{" "}
                  {usuario.nomeDeUsuario || "Não informado"}
                </p>

                <p>
                  <strong>E-mail:</strong>{" "}
                  {usuario.email || "Não informado"}
                </p>

                <p>
                  <strong>Tipo de conta:</strong> Learning
                </p>

                {data?.learning?.bio || data?.dadosEspecificos?.bio ? (
                  <p>
                    <strong>Bio:</strong>{" "}
                    {data?.learning?.bio || data?.dadosEspecificos?.bio}
                  </p>
                ) : null}

                {data?.learning?.objetivo || data?.dadosEspecificos?.objetivo ? (
                  <p>
                    <strong>Objetivo:</strong>{" "}
                    {data?.learning?.objetivo || data?.dadosEspecificos?.objetivo}
                  </p>
                ) : null}

                {(usuario.logradouro || usuario.cidade || usuario.estado || usuario.pais) && (
                  <p>
                    <strong>Endereço:</strong>{" "}
                    {[usuario.logradouro, usuario.cidade, usuario.estado, usuario.pais]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                )}

                {usuario.cep && (
                  <p>
                    <strong>CEP:</strong> {usuario.cep}
                  </p>
                )}
              </div>

              {isOwn && (
                <Link
                  href="/perfil/editar"
                  className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-semibold"
                >
                  <Pencil className="w-4 h-4" />
                  Editar perfil
                </Link>
              )}
            </section>
          </div>
        )}

        {aba === "cursos" && (
          <div className="space-y-6">
            {aulasLearningLoading && (
              <div className="rounded-xl border border-green-100 bg-white/70 p-4 text-sm text-green-900/70">
                Carregando aulas ao vivo…
              </div>
            )}

            {aulasLearningErro && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {aulasLearningErro}
              </div>
            )}
            <section className="border rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-green-900">
                  Conteúdos em andamento
                </h2>

                <Link
                  href="/learning"
                  className="text-sm font-semibold text-green-900 hover:underline"
                >
                  Ver cursos existentes
                </Link>
              </div>

              {cursosEmAndamento.length === 0 ? (
                <p className="text-green-900/70 text-base">
                  Você ainda não possui conteúdos em andamento.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {cursosEmAndamento.map((curso: any) => (
                    <Link
                      key={
                        curso.key ||
                        `${curso.tipoConteudo}:${curso.id}`
                      }
                      href={getCursoHref(curso)}
                      className="block border rounded-xl px-4 py-3 hover:bg-green-50"
                    >
                      <p className="font-semibold text-green-900 text-base">
                        {curso.titulo ||
                          curso.nome ||
                          (
                            curso.tipoConteudo ===
                            "AULA_AO_VIVO"
                              ? "Aula ao vivo"
                              : "Curso"
                          )}
                      </p>

                      {curso.tipoConteudo ===
                      "AULA_AO_VIVO" ? (
                        <>
                          <p className="mt-1 text-sm text-green-900/65">
                            {String(
                              curso.status
                            ).toUpperCase() ===
                            "AO_VIVO"
                              ? "Ao vivo agora"
                              : `Agendada para ${formatarDataAula(
                                  curso.dataInicio
                                )}`}
                          </p>

                          <p className="mt-1 text-xs font-medium text-green-700">
                            {formatarOrigemAcesso(
                              curso.origemAcesso
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-green-900/60">
                          Progresso:{" "}
                          {Math.round(
                            Number(
                              curso.progressoPercentual ??
                                curso.progresso ??
                                0
                            )
                          )}
                          %
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="border rounded-2xl p-5">
              <h2 className="text-2xl font-bold text-green-900 mb-4">
                Conteúdos finalizados
              </h2>

              {cursosFinalizados.length === 0 ? (
                <p className="text-green-900/70">
                  Você ainda não finalizou nenhum conteúdo.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {cursosFinalizados.map((curso: any) => (
                    <Link
                      key={
                        curso.key ||
                        `${curso.tipoConteudo}:${curso.id}`
                      }
                      href={getCursoHref(curso)}
                      className="block border rounded-xl p-4 hover:bg-green-50"
                    >
                      <p className="font-bold text-green-900">
                        {curso.titulo || curso.nome || "Curso"}
                      </p>
                      {curso.tipoConteudo ===
                        "AULA_AO_VIVO" ? (
                          <>
                            <p className="text-sm text-green-900/60">
                              Finalizada em{" "}
                              {formatarDataAula(
                                curso.finalizouEm
                              )}
                            </p>

                            <p className="mt-1 text-xs font-medium text-green-700">
                              {formatarOrigemAcesso(
                                curso.origemAcesso
                              )}
                            </p>

                            {curso.replayDisponivel &&
                            !curso.replayExpirado ? (
                              <p className="mt-2 text-sm font-semibold text-green-800">
                                Replay disponível
                              </p>
                            ) : curso.replayExpirado ? (
                              <p className="mt-2 text-sm font-semibold text-amber-700">
                                Replay expirado
                              </p>
                            ) : (
                              <p className="mt-2 text-sm text-green-900/60">
                                Replay ainda não disponível
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-green-900/60">
                            Curso concluído
                          </p>
                        )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {aba === "conquistas" && (
          <div className="space-y-4">
            <section className="border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-lg font-semibold text-green-900">
                  Conquistas e Troféus
                </h2>

                <Link
                  href="/perfil/conquistas"
                  className="text-sm text-green-900 hover:underline"
                >
                  Ver conquistas
                </Link>
              </div>

              {earnedBadges.length === 0 ? (
                <div className="p-5 text-green-900/70">
                  Nenhuma conquista desbloqueada ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                  {earnedBadges.slice(0, 4).map((item: any) => {
                    const c = item.conquista || {};

                    return (
                      <div
                        key={item.vinculoId || c.id}
                        className="border border-green-100 rounded-xl p-4 text-center"
                      >
                        <div className="text-3xl mb-2">
                          {c.icon || "🏆"}
                        </div>

                        <h3 className="font-bold text-green-900 leading-tight">
                          {c.titulo || "Conquista"}
                        </h3>

                        {c.descricao && (
                          <p className="text-sm text-green-800/70 mt-2">
                            {String(c.descricao)
                              .replace(/Grupo:/gi, "Grupo:")
                              .replace(/Tier:/gi, "Tier:")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-lg font-semibold text-green-900">
                  Certificados emitidos
                </h2>

                <Link
                  href="/perfil/conquistas"
                  className="text-sm text-green-900 hover:underline"
                >
                  Ver certificados
                </Link>
              </div>

              <div className="p-5 text-green-900 font-semibold">
                {certificados.length === 1
                  ? "1 certificado emitido"
                  : `${certificados.length} certificados emitidos`}
              </div>
            </section>
          </div>
        )}

        {aba === "postagens" && <ProfilePostsSection usuarioId={usuarioId} />}
      </div>
    </div>
   </div>
  );
}