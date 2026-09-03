import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import axios from "axios";
import { ArrowLeft, Share2, CheckCircle2 } from "lucide-react";
import { API, APP } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import { publicImgUrl } from "../utils/publicUrl.js";
import PerfilAtleta from "../components/perfil/PerfilAtleta.js";
import PerfilProfessor from "../components/perfil/PerfilProfessor.js";
import PerfilClube from "../components/perfil/PerfilClube.js";
import PerfilEscola from "../components/perfil/PerfilEscola.js";
import BottomNav from "@/components/layout/BottomNav.js";
import PerfilFederacao from "../components/perfil/PerfilFederacao.js";
import PerfilMarca from "../components/perfil/PerfilMarca.js";
import PerfilLearning from "../components/perfil/PerfilLearning.js";
import PerfilOlheiro from "../components/perfil/PerfilOlheiro.js";
import ProfilePostsSection from "../components/perfil/ProfilePostsSection.js";
import { clearAuthSession } from "../utils/authSession.js";

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
  tipo: TipoPerfil | null;
  usuario: {
    id: string;
    nome?: string | null;
    nomeDeUsuario?: string | null;
    foto?: string | null;
    verified?: boolean;
  } | null;
  dadosEspecificos?: Record<string, any>;
  pontuacaoTotal?: number;
}

type ErroPerfil = {
  status?: number;
  code?: string;
  message: string;
};

function readStoredToken() {
  return (
    Storage.token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function salvarRetornoAtual() {
  try {
    sessionStorage.setItem(
      "footera:returnTo",
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
  } catch {}
}

function textoLista(valor: unknown) {
  if (Array.isArray(valor)) {
    return valor.map(String).map((v) => v.trim()).filter(Boolean).join(", ");
  }

  const texto = String(valor ?? "").trim();
  return texto;
}

export default function PerfilUnico() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const token = readStoredToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [tipo, setTipo] = useState<TipoPerfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCreator, setHasCreator] = useState(false);
  const [perfilData, setPerfilData] = useState<PerfilMinimo | null>(null);
  const [erroPerfil, setErroPerfil] = useState<ErroPerfil | null>(null);
  const [modoVisitante, setModoVisitante] = useState(!token);
  const [abaPublica, setAbaPublica] =
    useState<"perfil" | "postagens">("perfil");

  function irParaLogin() {
    salvarRetornoAtual();
    navigate("/login");
  }

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate(modoVisitante ? "/feed" : "/perfil");
  }

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setErroPerfil({
        status: 404,
        code: "PROFILE_NOT_FOUND",
        message: "Perfil não encontrado.",
      });
      return;
    }

    let cancelled = false;

    async function carregarPerfil() {
      setLoading(true);
      setErroPerfil(null);
      setPerfilData(null);

      const url = `${API.BASE_URL}/api/perfil/${encodeURIComponent(id!)}`;

      try {
        let resposta;

        try {
          resposta = await axios.get<PerfilMinimo>(url, { headers });
        } catch (erro: any) {
          // Token antigo/expirado: limpa somente a sessão de autenticação
          // e tenta novamente a rota pública como visitante.
          if (token && erro?.response?.status === 401) {
            clearAuthSession();

            resposta = await axios.get<PerfilMinimo>(url);

            if (!cancelled) {
              setModoVisitante(true);
            }
          } else {
            throw erro;
          }
        }

        if (cancelled) return;

        const data = resposta.data;
        const resolvedUsuarioId = data?.usuario?.id ?? null;

        setPerfilData(data);
        setTipo(data?.tipo ?? null);
        setUsuarioId(resolvedUsuarioId);

        if (!token) {
          setModoVisitante(true);
        }

        // Caso a URL tenha recebido id de atleta/clube/escolinha/etc.,
        // normaliza para o id do Usuario sem criar uma nova navegação.
        if (resolvedUsuarioId && String(resolvedUsuarioId) !== String(id)) {
          window.history.replaceState(
            null,
            "",
            `/perfil/${encodeURIComponent(resolvedUsuarioId)}`
          );
        }
      } catch (erro: any) {
        if (cancelled) return;

        console.error("Erro ao carregar perfil:", erro);

        const status = erro?.response?.status;
        const body = erro?.response?.data ?? {};

        setErroPerfil({
          status,
          code: body?.code,
          message:
            body?.message ||
            body?.error ||
            "Não foi possível carregar este perfil.",
        });

        setPerfilData(null);
        setTipo(null);
        setUsuarioId(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void carregarPerfil();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    if (!usuarioId || !token || modoVisitante) return;

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
  }, [usuarioId, token, modoVisitante]);

  if (loading) {
    return (
      <div className="text-center p-10 text-green-800">
        Carregando perfil...
      </div>
    );
  }

  if (erroPerfil?.status === 403 || erroPerfil?.code === "PROFILE_PRIVATE") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f7f4ea] px-5">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg border border-gray-200">
          <h1 className="text-xl font-bold text-green-900">Perfil privado</h1>

          <p className="mt-2 text-sm text-gray-600">
            {modoVisitante
              ? "Este perfil não está disponível publicamente. Entre na FootEra para verificar se você possui acesso."
              : "Você não possui acesso a este perfil."}
          </p>

          {modoVisitante && (
            <button
              type="button"
              onClick={irParaLogin}
              className="mt-5 w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white"
            >
              Entrar na FootEra
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("/feed")}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700"
          >
            Ir para o Feed
          </button>
        </div>
      </div>
    );
  }

  if (erroPerfil?.status === 404) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#f7f4ea] px-5">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-bold text-green-900">Perfil não encontrado</h1>

          <p className="mt-2 text-sm text-gray-600">
            O perfil pode ter sido removido ou o link está incorreto.
          </p>

          <button
            type="button"
            onClick={() => navigate("/feed")}
            className="mt-5 rounded-xl bg-green-700 px-4 py-3 text-white font-semibold"
          >
            Voltar ao Feed
          </button>
        </div>
      </div>
    );
  }

  if (erroPerfil) {
    return (
      <div className="text-center p-10">
        <p className="text-gray-700">{erroPerfil.message}</p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-green-700 px-4 py-2 text-white"
        >
          Tentar novamente
        </button>
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
            Esta conta não possui um perfil público disponível.
          </p>

          {modoVisitante && (
            <button
              type="button"
              onClick={irParaLogin}
              className="w-full rounded-xl bg-green-700 px-4 py-3 text-white font-semibold shadow-sm active:scale-[0.99]"
            >
              Entrar na FootEra
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("/feed")}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-700 font-semibold"
          >
            Voltar ao Feed
          </button>
        </div>
      </div>
    );
  }

  if (modoVisitante && perfilData && usuarioId) {
    const dados =
      perfilData.dadosEspecificos ??
      {};

    const nome =
      String(
        dados.nome ||
          perfilData.usuario?.nome ||
          "Perfil FootEra"
      ).trim() ||
      "Perfil FootEra";

    const rawFoto =
      dados.foto ||
      dados.logo ||
      perfilData.usuario?.foto ||
      null;

    const foto =
      publicImgUrl(rawFoto) ||
      null;

    const categoria =
      textoLista(
        dados.categoria
      );

    const interesses =
      textoLista(
        dados.interesses
      );

    const qualificacoes =
      textoLista(
        dados.qualificacoes
      );

    const certificacoes =
      textoLista(
        dados.certificacoes
      );

    const resumoPublico = [
      tipo,
      dados.posicao
        ? String(dados.posicao)
        : "",
      categoria,
    ]
      .filter(Boolean)
      .join(" • ");

    const tituloInformacoes =
      String(tipo).toLowerCase() ===
      "atleta"
        ? "Informações do Atleta"
        : `Informações do ${tipo}`;

    const compartilhar =
      async () => {
        const basePublica =
          String(
            APP.FRONTEND_BASE_URL ||
              window.location.origin
          ).replace(/\/+$/, "");

        const slugPerfil =
          String(
            perfilData.usuario
              ?.nomeDeUsuario ||
              usuarioId
          )
            .replace(/^@/, "")
            .trim();

        const url =
          `${basePublica}/perfil/${encodeURIComponent(
            slugPerfil
          )}`;

        try {
          if (
            navigator.share
          ) {
            await navigator.share({
              title:
                `${nome} na FootEra`,
              url,
            });

            return;
          }

          await navigator.clipboard
            .writeText(url);
        } catch (e: any) {
          if (
            e?.name ===
            "AbortError"
          ) {
            return;
          }

          console.error(
            "Erro ao compartilhar:",
            e
          );
        }
      };

    return (
      <div className="min-h-[100dvh] bg-[#f7f4ea] pb-12">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Voltar"
            title="Voltar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-800 bg-white text-green-900 shadow-sm hover:bg-green-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-auto max-w-3xl px-4">
          <section className="overflow-hidden rounded-2xl shadow-sm">
            <div className="footera-bg-green p-6 flex flex-col items-center relative">
              <div className="relative w-24 h-24 rounded-full mb-3 flex items-center justify-center bg-white border-2 border-white overflow-hidden">
                <img
                  src={
                    foto ||
                    "/assets/usuarios/footera-logo-fundo-verde.png"
                  }
                  alt={nome}
                  className="h-full w-full object-cover"
                />
              </div>

              <h1 className="footera-text-cream text-2xl font-bold text-center">
                {nome.toUpperCase()}
              </h1>

              {perfilData.usuario
                ?.verified && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verificado
                </span>
              )}

              {resumoPublico && (
                <p className="footera-text-cream text-sm mt-2 text-center">
                  {resumoPublico}
                </p>
              )}

              {String(tipo)
                .toLowerCase() ===
                "atleta" && (
                <div className="w-full mt-4">
                  <h2 className="footera-text-cream text-center mb-2">
                    Pontuação FootEra
                  </h2>

                  <div className="footera-bg-green border border-footera-cream rounded-lg p-3 flex items-center justify-center">
                    <span className="footera-text-cream text-3xl font-bold">
                      {Number(
                        perfilData
                          .pontuacaoTotal ??
                          0
                      )}{" "}
                      pts
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={irParaLogin}
                  className="inline-flex items-center justify-center rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 shadow-sm hover:bg-green-400"
                >
                  Entrar na FootEra
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void compartilhar()
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-green-900 shadow-sm hover:bg-amber-200"
                >
                  <Share2 size={16} />
                  Compartilhar
                </button>
              </div>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              {
                key: "perfil",
                label: "Perfil",
              },
              {
                key: "postagens",
                label:
                  "Postagens",
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  setAbaPublica(
                    tab.key as
                      | "perfil"
                      | "postagens"
                  )
                }
                className={`py-2 rounded-lg text-sm font-medium ${
                  abaPublica ===
                  tab.key
                    ? "bg-green-100 text-green-900"
                    : "bg-white/70 text-green-900 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {abaPublica ===
            "perfil" && (
            <section className="mt-4 rounded-xl border bg-white/70 p-4 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-green-900">
                {tituloInformacoes}
              </h2>

              <div className="space-y-2 text-sm text-green-900/90">
                <p>
                  <b>Nome:</b>{" "}
                  {nome}
                </p>

                {dados.posicao && (
                  <p>
                    <b>Posição:</b>{" "}
                    {String(
                      dados.posicao
                    )}
                  </p>
                )}

                {categoria && (
                  <p>
                    <b>Categoria:</b>{" "}
                    {categoria}
                  </p>
                )}

                {dados.clube && (
                  <p>
                    <b>Clube:</b>{" "}
                    {String(
                      dados.clube
                    )}
                  </p>
                )}

                {dados.escola && (
                  <p>
                    <b>Escola:</b>{" "}
                    {String(
                      dados.escola
                    )}
                  </p>
                )}

                {dados.professor && (
                  <p>
                    <b>Professor:</b>{" "}
                    {String(
                      dados.professor
                    )}
                  </p>
                )}

                {dados.areaFormacao && (
                  <p>
                    <b>Área de formação:</b>{" "}
                    {String(
                      dados.areaFormacao
                    )}
                  </p>
                )}

                {qualificacoes && (
                  <p>
                    <b>Qualificações:</b>{" "}
                    {qualificacoes}
                  </p>
                )}

                {certificacoes && (
                  <p>
                    <b>Certificações:</b>{" "}
                    {certificacoes}
                  </p>
                )}

                {dados.areaAtuacao && (
                  <p>
                    <b>Área de atuação:</b>{" "}
                    {String(
                      dados.areaAtuacao
                    )}
                  </p>
                )}

                {dados.anosExperiencia !=
                  null &&
                  String(
                    dados.anosExperiencia
                  ).trim() && (
                    <p>
                      <b>Experiência:</b>{" "}
                      {String(
                        dados.anosExperiencia
                      )}{" "}
                      ano(s)
                    </p>
                  )}

                {dados.headline && (
                  <p className="font-medium">
                    {String(
                      dados.headline
                    )}
                  </p>
                )}

                {dados.descricao && (
                  <p>
                    {String(
                      dados.descricao
                    )}
                  </p>
                )}

                {dados.bio && (
                  <p>
                    {String(
                      dados.bio
                    )}
                  </p>
                )}

                {dados.objetivo && (
                  <p>
                    <b>Objetivo:</b>{" "}
                    {String(
                      dados.objetivo
                    )}
                  </p>
                )}

                {interesses && (
                  <p>
                    <b>Interesses:</b>{" "}
                    {interesses}
                  </p>
                )}

                {dados
                  .colaboracaoClube
                  ?.nome && (
                  <p>
                    <b>
                      Clube
                      colaborador:
                    </b>{" "}
                    {String(
                      dados
                        .colaboracaoClube
                        .nome
                    )}
                  </p>
                )}

                {(dados.cidade ||
                  dados.estado) && (
                  <p>
                    <b>Local:</b>{" "}
                    {[
                      dados.cidade,
                      dados.estado,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " - "
                      )}
                  </p>
                )}

                {dados.siteOficial && (
                  <a
                    href={String(
                      dados.siteOficial
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-green-700 underline"
                  >
                    Site oficial
                  </a>
                )}
              </div>
            </section>
          )}

          {abaPublica ===
            "postagens" && (
            <ProfilePostsSection
              usuarioId={
                usuarioId
              }
            />
          )}
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
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-800 bg-white text-green-900 shadow-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700/30 mt-6 ml-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {tipoNormalizado === "atleta" && (
        <PerfilAtleta
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipoNormalizado === "professor" && (
        <PerfilProfessor
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipoNormalizado === "olheiro" && (
        <PerfilOlheiro
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipoNormalizado === "clube" && (
        <PerfilClube
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {["escolinha", "escola"].includes(tipoNormalizado) && (
        <PerfilEscola
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipoNormalizado === "federacao" && (
        <PerfilFederacao
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipoNormalizado === "marca" && (
        <PerfilMarca
          idDaUrl={usuarioId}
          hasCreator={hasCreator}
          creatorUsuarioId={usuarioId}
        />
      )}

      {tipoNormalizado === "learning" && (
        <PerfilLearning idDaUrl={usuarioId} />
      )}

      <div className="h-16" aria-hidden="true" />

      {!modoVisitante && <BottomNav />}
    </div>
  );
}