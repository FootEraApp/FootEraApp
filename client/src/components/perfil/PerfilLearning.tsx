import { useEffect, useState } from "react";
import axios from "axios";
import {
  BookOpen,
  GraduationCap,
  Mail,
  User,
  Trophy,
  CalendarDays,
  Pencil,
  BadgeCheck,
} from "lucide-react";
import { Link } from "wouter";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import ProfilePostsSection from "./ProfilePostsSection.js";

export default function PerfilLearning({ idDaUrl }: { idDaUrl?: string }) {
  const [data, setData] = useState<any>(null);
  const [aba, setAba] = useState<"perfil" | "cursos" | "conquistas" | "postagens">("perfil");
  const [earnedBadges, setEarnedBadges] = useState<any[]>([]);
  const [certificados, setCertificados] = useState<any[]>([]);

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

  const isOwn = !idDaUrl || idDaUrl === meuId;
  const id = isOwn ? "me" : idDaUrl;

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

  if (!data) {
    return (
      <div className="p-10 text-center text-red-600">
        Perfil Learning não encontrado.
      </div>
    );
  }

  const usuario = data.usuario ?? {};
  const usuarioId = usuario.id ?? data.learning?.usuarioId ?? idDaUrl ?? meuId;
  const conteudos = Array.isArray(data.conteudos) ? data.conteudos : [];
  
  function getCursoHref(curso: any) {
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

  const cursosFinalizados = conteudos.filter((item: any) => {
  const status = String(item.status || item.assinatura?.status || "").toUpperCase();
  const progresso = Number(item.progressoPercentual ?? item.progresso ?? 0);

    return status === "CONCLUIDA" || status === "CONCLUÍDA" || progresso >= 100;
  });

  const cursosEmAndamento = conteudos.filter((item: any) => {
    const status = String(item.status || item.assinatura?.status || "").toUpperCase();
    const progresso = Number(item.progressoPercentual ?? item.progresso ?? 0);

    return status !== "CONCLUIDA" && status !== "CONCLUÍDA" && progresso < 100;
  });

  const totalLearningsConcluidos =
    Number(data.metricas?.finalizados ?? 0) || cursosFinalizados.length;

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
        <div className="mt-4 grid grid-cols-4 gap-2 mb-4">
          {[
            ["perfil", "Perfil"],
            ["cursos", "Meus cursos"],
            ["conquistas", "Conquistas"],
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

                <p>
                  <strong>Certificados:</strong> {certificados.length}
                </p>

                <p>
                  <strong>Conquistas:</strong> {earnedBadges.length}
                </p>
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
            <section className="border rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-green-900">
                  Cursos em andamento
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
                  Você ainda não possui cursos em andamento.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {cursosEmAndamento.map((curso: any) => (
                    <Link
                      key={curso.id}
                      href={getCursoHref(curso)}
                      className="block border rounded-xl px-4 py-3 hover:bg-green-50"
                    >
                      <p className="font-semibold text-green-900 text-base">
                        {curso.titulo || curso.nome || "Curso"}
                      </p>
                      <p className="text-sm text-green-900/60">
                        Progresso: {Number(curso.progressoPercentual ?? curso.progresso ?? 0)}%
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="border rounded-2xl p-5">
              <h2 className="text-2xl font-bold text-green-900 mb-4">
                Cursos finalizados
              </h2>

              {cursosFinalizados.length === 0 ? (
                <p className="text-green-900/70">
                  Você ainda não finalizou nenhum curso.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {cursosFinalizados.map((curso: any) => (
                    <Link
                      key={curso.id}
                      href={getCursoHref(curso)}
                      className="block border rounded-xl p-4 hover:bg-green-50"
                    >
                      <p className="font-bold text-green-900">
                        {curso.titulo || curso.nome || "Curso"}
                      </p>
                      <p className="text-sm text-green-900/60">
                        Curso concluído
                      </p>
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
          </div>
        )}

        {aba === "postagens" && <ProfilePostsSection usuarioId={usuarioId} />}
      </div>
    </div>
   </div>
  );
}