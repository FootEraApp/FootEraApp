import React, { useEffect, useState, useRef } from "react";
import { toast } from "@/lib/toast";
import { useRoute, useLocation } from "wouter";
import { getPostById, PostagemComUsuario, likePost, comentarPost } from "../services/feedService.js";
import { format } from "date-fns";
import { FaHeart, FaRegHeart, FaTrash, FaShare, FaRegCommentDots } from "react-icons/fa";
import { Link } from "wouter";
import { API, APP } from "../config.js";
import { CircleX, Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import PostImage from "../components/PostImage.js";
import { publicImgUrl } from "@/utils/publicUrl.js";
import { FaRetweet } from "react-icons/fa";
import { repostPost } from "../services/feedService.js";
import { useAuthGate } from "../context/AuthGateContext.js";
import {
  lerAcaoPendenteAuth,
  limparAcaoPendenteAuth,
} from "../utils/authSession.js";

function extrairConquista(
  conteudo?: string | null
) {
  const texto =
    String(
      conteudo || ""
    ).trim();

  const match =
    texto.match(
      /^🏆\s*Conquista(?:\s*\([^)]+\))?\s*:\s*(.+)$/is
    );

  if (!match) {
    return null;
  }

  const corpo =
    match[1].trim();

  const partes =
    corpo.split(
      /\s+—\s+/
    );

  const titulo =
    String(
      partes.shift() || ""
    ).trim();

  let detalhes =
    partes
      .join(" — ")
      .trim();

  let comentario =
    "";

  const comId =
    detalhes.match(
      /^(.*?)(?:\s*⏱️)?\s*\[[^\]]+\]\s*(.*)$/s
    );

  if (comId) {
    detalhes =
      String(
        comId[1] || ""
      ).trim();

    comentario =
      String(
        comId[2] || ""
      ).trim();
  }

  return {
    titulo,
    detalhes,
    comentario,
  };
}

function PostUnico(): JSX.Element {
  const [match, params] = useRoute<{ id: string }>("/post/:id");
  const [post, setPost] = useState<PostagemComUsuario | null>(null);
  const [comentario, setComentario] = useState("");
  const comentarioRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );
  const [carregando, setCarregando] = useState(false);
  const [
    carregandoPost,
    setCarregandoPost,
  ] = useState(true);

  const [
    erroPost,
    setErroPost,
  ] = useState<{
    status?: number;
    code?: string;
    message: string;
  } | null>(null);
  const [, setLocation] = useLocation();
  const [modalAberto, setModalAberto] = useState(false);

  const {
    requireAuth,
    openAuthGate,
  } = useAuthGate();

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const usuarioId =
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    "";
  
  useEffect(() => {
    if (!match || !params?.id) {
      return;
    }

    let cancelado = false;

    async function fetchPost() {
      setCarregandoPost(true);
      setErroPost(null);
      setPost(null);

      try {
        const postUnico =
          await getPostById(
            params!.id
          );

        if (cancelado) {
          return;
        }

        setPost(postUnico);
      } catch (error: any) {
        console.error(
          "Erro ao buscar post:",
          error
        );

        if (cancelado) {
          return;
        }

        setErroPost({
          status:
            typeof error?.status ===
            "number"
              ? error.status
              : undefined,

          code:
            error?.code,

          message:
            error?.message ||
            "Não foi possível carregar esta publicação.",
        });
      } finally {
        if (!cancelado) {
          setCarregandoPost(false);
        }
      }
    }

    void fetchPost();

    return () => {
      cancelado = true;
    };
  }, [match, params?.id]);

  async function registrarCompartilhamento(
    origem:
      | "copiar"
      | "whatsapp"
      | "email"
      | "footera"
  ) {
    const postId =
      post?.id ??
      params?.id;

    if (!postId) {
      return;
    }

    try {
      const tokenRaw =
        localStorage.getItem(
          "token"
        ) ||
        sessionStorage.getItem(
          "token"
        );

      const headers: Record<
        string,
        string
      > = {
        "Content-Type":
          "application/json",
      };

      if (tokenRaw) {
        headers.Authorization =
          tokenRaw.startsWith(
            "Bearer "
          )
            ? tokenRaw
            : `Bearer ${tokenRaw}`;
      }

      const response =
        await fetch(
          `${API.BASE_URL}/api/post/${encodeURIComponent(
            postId
          )}/compartilhar`,
          {
            method:
              "POST",

            headers,

            body:
              JSON.stringify({
                origem,
              }),

            // importante se a página
            // mudar logo após o clique
            keepalive:
              true,
          }
        );

      if (!response.ok) {
        console.warn(
          "Não foi possível registrar o compartilhamento:",
          response.status
        );

        return;
      }

      const data =
        await response
          .json()
          .catch(() => ({}));

      setPost((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,

          compartilhamentos:
            typeof data
              ?.compartilhamentos ===
            "number"
              ? data.compartilhamentos
              : Number(
                  prev
                    .compartilhamentos ??
                    0
                ) + 1,
        };
      });
    } catch (error) {
      console.error(
        "Erro ao registrar compartilhamento:",
        error
      );
    }
  }

  async function handleCurtir() {
    if (!post?.id) return;

    if (
      !requireAuth({
        message:
          "Entre na FootEra para curtir esta publicação.",

        returnTo:
          `/post/${encodeURIComponent(
            post.id
          )}`,

        action: {
          type:
            "LIKE_POST",

          postId:
            post.id,
        },
      })
    ) {
      return;
    }
    try {
      await likePost(post.id);
      const atualizado = await getPostById(post.id);
      if (atualizado) setPost(atualizado);
    } catch (err) {
      console.error("Erro ao curtir o post:", err);
    }
  }

  const postIdPublico =
    post?.id ??
    params?.id ??
    "";

  const publicUrl =
    window.location.hostname ===
    "localhost"
      ? `${window.location.origin}/post/${encodeURIComponent(
          postIdPublico
        )}`
      : `https://footera.app.br/post/${encodeURIComponent(
          postIdPublico
      )}`;

  async function handleCopiarLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      await registrarCompartilhamento("copiar");
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  function handleCompartilharWhatsapp() {
    const texto =
      encodeURIComponent(
        publicUrl
      );

    window.open(
      `https://wa.me/?text=${texto}`,
      "_blank",
      "noopener,noreferrer"
    );

    void registrarCompartilhamento(
      "whatsapp"
    );
  }

  function handleCompartilharEmail() {
    const assunto =
      encodeURIComponent(
        "Veja esta postagem no FootEra"
      );

    const corpo =
      encodeURIComponent(
        publicUrl
      );

    void registrarCompartilhamento(
      "email"
    );

    window.location.href =
      `mailto:?subject=${assunto}&body=${corpo}`;
  }

  async function handleComentarioSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (
      !post?.id ||
      !comentario.trim()
    ) {
      return;
    }

    const conteudo =
      comentario.trim();

    if (
      !requireAuth({
        message:
          "Entre na FootEra para comentar nesta publicação.",

        returnTo:
          `/post/${encodeURIComponent(
            post.id
          )}`,

        action: {
          type:
            "COMMENT_POST",

          postId:
            post.id,

          texto:
            conteudo,
        },
      })
    ) {
      return;
    }

    try {
      setCarregando(true);

      await comentarPost(
        post.id,
        conteudo
      );

      setComentario("");

      const atualizado =
        await getPostById(
          post.id
        );

      if (atualizado) {
        setPost(atualizado);
      }
    } catch (err) {
      console.error(
        "Erro ao comentar:",
        err
      );
    } finally {
      setCarregando(false);
    }
  }

  async function handleExcluirPost() {
    if (!post?.id || !confirm("Tem certeza que deseja excluir esta postagem?")) return;
    try {
      const response = await fetch(`${API.BASE_URL}/api/feed/posts/${post.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Erro ao excluir:", data);
        toast.error("Erro ao excluir a postagem.");
        return;
      }

      toast.success("Postagem excluída com sucesso.");
      setLocation("/feed");
    } catch (err) {
      console.error("Erro ao excluir a postagem:", err);
      toast.error("Erro ao excluir a postagem.");
    }
  }

  async function handleRepost() {
    if (!post?.id) {
      return;
    }

    if (
      !requireAuth({
        message:
          "Entre na FootEra para repostar esta publicação.",

        returnTo:
          `/post/${encodeURIComponent(
            post.id
          )}`,

        action: {
          type:
            "REPOST_POST",

          postId:
            post.id,
        },
      })
    ) {
      return;
    }

    const comentario =
      prompt(
        "Adicionar um comentário (opcional):"
      ) ?? "";

    try {
      await repostPost(
        post.id,
        comentario
      );

      toast.success(
        "Repost publicado no seu perfil!"
      );
    } catch (e) {
      console.error(e);

      toast.error(
        "Não foi possível repostar."
      );
    }
  }

  useEffect(() => {
    if (
      !usuarioId ||
      !post?.id
    ) {
      return;
    }

    const action =
      lerAcaoPendenteAuth();

    if (!action) {
      return;
    }

    if (
      !(
        "postId" in action
      ) ||
      action.postId !==
        post.id
    ) {
      return;
    }

    limparAcaoPendenteAuth();

    if (
      action.type ===
      "LIKE_POST"
    ) {
      void handleCurtir();
      return;
    }

    if (
      action.type ===
      "COMMENT_POST"
    ) {
      if (action.texto) {
        setComentario(
          action.texto
        );

        toast.success(
          "Seu comentário foi preservado. Revise e toque em Comentar para enviar."
        );
      } else {
        toast.success(
          "Agora você pode escrever seu comentário."
        );
      }
    
      window.setTimeout(() => {
        document
          .getElementById(
            "comentarios-post"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",
            block:
              "start",
          });

        comentarioRef.current
          ?.focus();
      }, 300);

      return;
    }

    if (
      action.type ===
      "REPOST_POST"
    ) {
      const confirmar =
        window.confirm(
          "Você entrou na FootEra. Deseja continuar com o repost?"
        );

      if (confirmar) {
        void handleRepost();
      }
    }
  }, [
    usuarioId,
    post?.id,
  ]);

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Publicação não encontrada
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            O link desta publicação é inválido.
          </p>

          <button
            type="button"
            onClick={() =>
              setLocation("/feed")
            }
            className="mt-5 rounded-xl bg-green-700 px-4 py-2 text-white font-semibold"
          >
            Voltar ao Feed
          </button>
        </div>
      </div>
    );
  }

  function abrirComentarios() {
    if (!post?.id) {
      return;
    }

    if (
      !requireAuth({
        message:
          "Entre na FootEra para comentar nesta publicação.",

        returnTo:
          `/post/${encodeURIComponent(
            post.id
          )}`,

        action: {
          type:
            "COMMENT_POST",

          postId:
            post.id,
        },
      })
    ) {
      return;
    }

    document
      .getElementById(
        "comentarios-post"
      )
      ?.scrollIntoView({
        behavior:
          "smooth",
        block:
          "start",
      });

    window.setTimeout(() => {
      comentarioRef.current
        ?.focus();
    }, 350);
  }

  if (carregandoPost) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">
          Carregando publicação...
        </p>
      </div>
    );
  }

  if (
    erroPost?.status === 403 ||
    erroPost?.code ===
      "POST_NOT_ACCESSIBLE"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Publicação indisponível
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {usuarioId
              ? "Você não possui acesso a esta publicação."
              : "Esta publicação não está disponível publicamente. Entre na FootEra para verificar se você possui acesso."}
          </p>

          <div className="mt-5 flex flex-col gap-2">
            {!usuarioId && (
              <button
                type="button"
                onClick={() =>
                  openAuthGate({
                    message:
                      "Entre para verificar se sua conta possui acesso a esta publicação.",

                    returnTo:
                      `/post/${encodeURIComponent(
                        params?.id || ""
                      )}`,
                  })
                }
                className="rounded-xl bg-green-700 px-4 py-2 text-white font-semibold"
              >
                Entrar na FootEra
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setLocation("/feed")
              }
              className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700"
            >
              Voltar ao Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (erroPost?.status === 404) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Publicação não encontrada
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Ela pode ter sido removida ou o link está incorreto.
          </p>

          <button
            type="button"
            onClick={() =>
              setLocation("/feed")
            }
            className="mt-5 rounded-xl bg-green-700 px-4 py-2 text-white font-semibold"
          >
            Voltar ao Feed
          </button>
        </div>
      </div>
    );
  }

  if (erroPost) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Não foi possível carregar
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {erroPost.message}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-5 rounded-xl bg-green-700 px-4 py-2 text-white font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center p-10 text-gray-600">
        Publicação não encontrada.
      </div>
    );
  }

  const linkCompartilhado =
  publicUrl;
  const curtidas =
    post.curtidas || [];

  const jaCurtiu =
    !!usuarioId &&
    curtidas.some(
      (c) =>
        c.usuarioId ===
        usuarioId
    );

  const totalCurtidas =
    typeof (
      post as any
    ).totalCurtidas ===
    "number"
      ? (post as any)
          .totalCurtidas
      : curtidas.length;

  const conquista =
    extrairConquista(
      post.conteudo
    );

  const avatarAutor =
    publicImgUrl(
      post.usuario?.foto
    ) ||
    `${APP.FRONTEND_BASE_URL}/assets/usuarios/default-user.png`;

  const autorRef =
    String(
      post.usuario
        ?.nomeDeUsuario ||
        post.usuario?.id ||
        ""
    );

  const tipoAutor =
    String(
      post.usuario?.tipo ||
      ""
    )
      .trim()
      .toLowerCase();

  const ehOrganizacao =
    [
      "clube",
      "escolinha",
      "escola",
      "federacao",
      "marca",
    ].includes(
      tipoAutor
    );

  const linkAutor =
    ehOrganizacao
      ? `/organizacao/${encodeURIComponent(
          autorRef
        )}`
      : `/profile/${encodeURIComponent(
          autorRef
        )}`;

  const totalComentarios =
    post.comentarios?.length ??
    0;
      
  return (
    <main className="min-h-screen bg-[#FEFBE9] px-4 py-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <article
          className="
            overflow-hidden
            rounded-3xl
            border
            border-gray-200
            bg-white
            shadow-sm
          "
        >
          {/* CABEÇALHO */}
          <div className="flex items-center gap-3 px-5 pt-5">
            <Link
              href={linkAutor}
              className="shrink-0"
            >
              <img
                src={avatarAutor}
                alt={
                  post.usuario?.nome ||
                  "Perfil"
                }
                className="
                  h-12
                  w-12
                  rounded-full
                  border
                  border-gray-200
                  object-cover
                "
              />
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                href={linkAutor}
                className="
                  block
                  truncate
                  font-bold
                  text-gray-950
                  hover:text-green-800
                "
              >
                {post.usuario?.nome}
              </Link>

              <p className="text-sm text-gray-500">
                {format(
                  new Date(
                    post.dataCriacao
                  ),
                  "dd/MM, HH:mm"
                )}
              </p>
            </div>

            {post.usuario.id ===
              usuarioId && (
              <button
                type="button"
                onClick={
                  handleExcluirPost
                }
                className="
                  rounded-full
                  p-2
                  text-gray-400
                  transition
                  hover:bg-red-50
                  hover:text-red-600
                "
                title="Excluir publicação"
              >
                <FaTrash />
              </button>
            )}
          </div>

          {/* REPOST */}
          {post.repostOf && (
            <p className="px-5 pt-3 text-xs text-gray-500">
              Repostou de{" "}
              <strong>
                {post.repostOf.usuario
                  ?.nome ||
                  "Usuário"}
              </strong>
            </p>
          )}

          {/* CONTEÚDO */}
          <div className="px-5 pb-5 pt-4">
            {post.repostOf ? (
              <>
                {post.conteudo?.trim() && (
                  <p className="mb-4 whitespace-pre-line text-gray-800">
                    {post.conteudo}
                  </p>
                )}

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <img
                      src={
                        publicImgUrl(
                          post.repostOf
                            .usuario?.foto
                        ) ||
                        `${APP.FRONTEND_BASE_URL}/assets/usuarios/default-user.png`
                      }
                      alt="Perfil"
                      className="h-9 w-9 rounded-full object-cover"
                    />

                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {
                          post.repostOf
                            .usuario?.nome
                        }
                      </p>

                      <p className="text-xs text-gray-500">
                        {format(
                          new Date(
                            post.repostOf
                              .dataCriacao
                          ),
                          "dd/MM, HH:mm"
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="whitespace-pre-line text-sm text-gray-800">
                    {
                      post.repostOf
                        .conteudo
                    }
                  </p>

                  {post.repostOf
                    .imagemUrl && (
                    <div className="mt-3 overflow-hidden rounded-xl">
                      <PostImage
                        src={
                          publicImgUrl(
                            post.repostOf
                              .imagemUrl
                          ) ??
                          undefined
                        }
                      />
                    </div>
                  )}

                  {post.repostOf
                    .videoUrl && (
                    <video
                      controls
                      className="mt-3 w-full rounded-xl"
                    >
                      <source
                        src={
                          publicImgUrl(
                            post.repostOf
                              .videoUrl
                          ) ?? ""
                        }
                        type="video/mp4"
                      />
                    </video>
                  )}
                </div>
              </>
            ) : conquista ? (
              <div
                className="
                  rounded-2xl
                  border
                  border-amber-300
                  bg-amber-50/40
                  p-4
                "
              >
                <div className="flex items-start gap-3">
                  <div
                    className="
                      flex
                      h-11
                      w-11
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-gray-200
                      bg-white
                      text-xl
                    "
                  >
                    🏆
                  </div>

                  <div className="min-w-0">
                    <h2 className="font-semibold text-amber-950">
                      Conquista:{" "}
                      {
                        conquista.titulo
                      }
                    </h2>

                    {conquista.detalhes && (
                      <p className="mt-1 text-sm text-amber-900">
                        {
                          conquista.detalhes
                        }
                      </p>
                    )}

                    {conquista.comentario && (
                      <p className="mt-3 italic text-gray-700">
                        “
                        {
                          conquista.comentario
                        }
                        ”
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {post.conteudo && (
                  <p className="whitespace-pre-line text-gray-800">
                    {post.conteudo}
                  </p>
                )}
              </>
            )}

            {!post.repostOf &&
              post.tipoMidia ===
                "Imagem" &&
              post.imagemUrl && (
                <div className="mt-4 overflow-hidden rounded-2xl">
                  <PostImage
                    src={
                      publicImgUrl(
                        post.imagemUrl
                      ) ??
                      undefined
                    }
                  />
                </div>
              )}

            {!post.repostOf &&
              post.tipoMidia ===
                "Video" &&
              post.videoUrl && (
                <video
                  controls
                  className="mt-4 w-full rounded-2xl"
                >
                  <source
                    src={
                      publicImgUrl(
                        post.videoUrl
                      ) ?? ""
                    }
                    type="video/mp4"
                  />
                </video>
              )}

            {/* AÇÕES */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={
                  handleCurtir
                }
                className={`
                  inline-flex
                  h-11
                  min-w-[72px]
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  px-4
                  transition
                  ${
                    jaCurtiu
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {jaCurtiu ? (
                  <FaHeart />
                ) : (
                  <FaRegHeart />
                )}

                <span>
                  {totalCurtidas}
                </span>
              </button>

              <button
                type="button"
                onClick={
                  abrirComentarios
                }
                className="
                  inline-flex
                  h-11
                  min-w-[72px]
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-gray-200
                  px-4
                  text-gray-600
                  transition
                  hover:bg-gray-50
                "
              >
                <FaRegCommentDots />

                <span>
                  {totalComentarios}
                </span>
              </button>

              <button
                type="button"
                onClick={
                  handleRepost
                }
                className="
                  inline-flex
                  h-11
                  min-w-[72px]
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-gray-200
                  px-4
                  text-gray-600
                  transition
                  hover:bg-gray-50
                "
              >
                <FaRetweet />

                <span>
                  {Number(
                    post.reposts ??
                    0
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setModalAberto(
                    true
                  )
                }
                className="
                  inline-flex
                  h-11
                  min-w-[72px]
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-gray-200
                  px-4
                  text-gray-600
                  transition
                  hover:bg-gray-50
                "
                title="Compartilhar"
              >
              <FaShare />

              <span>
                {Number(
                  post
                    .compartilhamentos ??
                    0
                )}
              </span>
            </button>
            </div>
          </div>
        </article>

        {/* COMENTÁRIOS */}
        <section
          id="comentarios-post"
          className="
            mt-4
            rounded-3xl
            border
            border-gray-200
            bg-white
            p-5
            shadow-sm
          "
        >
          <h3 className="font-bold text-gray-900">
            Comentários
          </h3>

          <div className="mt-4 space-y-3">
            {post.comentarios
              ?.length ? (
              post.comentarios.map(
                (item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-2xl bg-gray-50 p-3"
                  >
                    <img
                      src={
                        publicImgUrl(
                          item.usuario
                            ?.foto
                        ) ||
                        `${APP.FRONTEND_BASE_URL}/assets/usuarios/default-user.png`
                      }
                      alt="Perfil"
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {
                          item.usuario
                            ?.nome
                        }
                      </p>

                      <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">
                        {
                          item.conteudo
                        }
                      </p>
                    </div>
                  </div>
                )
              )
            ) : (
              <p className="text-sm text-gray-500">
                Ainda não há comentários.
              </p>
            )}
          </div>

          {usuarioId ? (
            <form
              onSubmit={
                handleComentarioSubmit
              }
              className="mt-5"
            >
              <textarea
                ref={comentarioRef}
                value={comentario}
                onChange={(e) =>
                  setComentario(
                    e.target.value
                  )
                }
                className="
                  min-h-[100px]
                  w-full
                  resize-none
                  rounded-2xl
                  border
                  border-gray-200
                  p-3
                  outline-none
                  transition
                  focus:border-green-600
                  focus:ring-2
                  focus:ring-green-600/10
                "
                placeholder="Escreva um comentário..."
              />

              <button
                type="submit"
                disabled={
                  carregando ||
                  !comentario.trim()
                }
                className="
                  mt-2
                  rounded-xl
                  bg-green-700
                  px-5
                  py-2.5
                  font-semibold
                  text-white
                  transition
                  hover:bg-green-800
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {carregando
                  ? "Enviando..."
                  : "Comentar"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={
                abrirComentarios
              }
              className="
                mt-5
                w-full
                rounded-xl
                border
                border-green-700
                px-4
                py-3
                font-semibold
                text-green-800
                transition
                hover:bg-green-50
              "
            >
              Entre para comentar
            </button>
          )}
        </section>

        {usuarioId && (
          <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
            <Link
              href="/feed"
              className="hover:underline"
            >
              <House />
            </Link>

            <Link
              href="/explorar"
              className="hover:underline"
            >
              <Search />
            </Link>

            <Link
              href="/post"
              className="hover:underline"
            >
              <CirclePlus />
            </Link>

            <Link
              href="/treinos"
              className="hover:underline"
            >
              <Volleyball />
            </Link>

            <Link
              href="/perfil"
              className="hover:underline"
            >
              <User />
            </Link>
          </nav>
        )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">Compartilhar Postagem</h2>

            <input
              type="text"
              value={linkCompartilhado}
              readOnly
              onFocus={(e) => e.target.select()}
              className="w-full border rounded px-3 py-2 text-sm mb-3"
            />

            <button
              type="button"
              className="
                mb-4
                w-full
                rounded-xl
                bg-green-700
                py-3
                font-semibold
                text-white
                transition
                hover:bg-green-800
              "
              onClick={
                handleCopiarLink
              }
            >
              Copiar Link
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCompartilharWhatsapp}
                className="rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                WhatsApp
              </button>

              <button
                type="button"
                onClick={handleCompartilharEmail}
                className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                Email
              </button>

              <a
                href={publicUrl}
                onClick={() => {
                  void registrarCompartilhamento(
                    "footera"
                  );
                }}
                className="
                  flex
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-green-300
                  bg-green-100
                  px-4
                  py-3
                  text-center
                  text-sm
                  font-semibold
                  text-green-800
                  transition
                  hover:bg-green-200
                "
              >
                Ver no FootEra
              </a>
            </div>

            <button
              onClick={() => setModalAberto(false)}
              className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl"
            >
              <CircleX />
            </button>
          </div>
        </div>
      )}
    </div>
   </main>
  );
}

export default PostUnico;