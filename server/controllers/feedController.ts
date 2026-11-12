import { Response, RequestHandler, Request } from "express";
import { getIO } from "../socket.js";
import { getDailyUsage } from "../services/usage.js";
import { prisma } from "../prisma.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";
import {
  Prisma,
  VisibilidadePostagem,
  NotificacaoTipo,
} from "@prisma/client";
import {
  audit,
} from "../services/audit.js";
import {
  getPostVisibilityWhere,
  normalizarVisibilidadePostagem,
  podeVisualizarPostagem,
} from "../utils/postVisibility.js";
import {
  sanitizePublicPost,
} from "../utils/publicSanitizers.js";
import {
  obterOrganizacaoAtivaDoUsuario,
} from "../services/organizacoes.js";
import {
  criarNotificacaoEEnviarPush,
} from "./notificacoesController.js";
import {
  getActiveContext,
  listarActiveContexts,
  type ActiveContext,
} from "../services/activeContext.js";
import {
  verificarPermissaoResponsavelAtleta,
} from "../services/responsavelPermissoes.service.js";
import { canPermission } from "../services/permissions.js";

const ADS_CAP_PER_DAY = 5;
const AD_EVERY_N = 10;

type AutorPostagemResolvido = {
  contexto: ActiveContext;
  organizacaoId: string | null;
};

async function resolverAutorPostagem(
  usuarioId: string,
  authorContextKeyRaw?: unknown
): Promise<AutorPostagemResolvido> {
  const authorContextKey =
    String(
      authorContextKeyRaw ?? ""
    ).trim();

  if (!authorContextKey) {
    const contexto =
      await getActiveContext(
        usuarioId
      );

    if (!contexto) {
      const erro: any =
        new Error(
          "Nenhum contexto ativo disponível para publicação."
        );

      erro.status = 403;
      erro.code =
        "POST_AUTHOR_CONTEXT_NOT_FOUND";

      throw erro;
    }

    return {
      contexto,

      organizacaoId:
        contexto.kind ===
        "ORGANIZATION"
          ? contexto.organizationId ??
            null
          : null,
    };
  }

  const contextos =
    await listarActiveContexts(
      usuarioId
    );

  const contexto =
    contextos.find(
      (item) =>
        item.key ===
        authorContextKey
    );

  if (!contexto) {
    const erro: any =
      new Error(
        "Você não pode publicar usando esse perfil ou organização."
      );

    erro.status = 403;
    erro.code =
      "POST_AUTHOR_CONTEXT_FORBIDDEN";

    throw erro;
  }

  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    const organizacaoId =
      String(
        contexto.organizationId ??
          ""
      ).trim();

    if (!organizacaoId) {
      const erro: any =
        new Error(
          "O contexto da organização não possui uma organização válida."
        );

      erro.status = 409;
      erro.code =
        "POST_AUTHOR_ORGANIZATION_INVALID";

      throw erro;
    }

    return {
      contexto,
      organizacaoId,
    };
  }

  return {
    contexto,
    organizacaoId: null,
  };
}

const postagemIncludeBase = {
  usuario: {
    select: {
      id: true,
      nome: true,
      nomeDeUsuario: true,
      foto: true,
      tipo: true,
      destaque: true,
      verified: true,
    },
  },
  organizacao: {
    select: {
      id: true,
      nome: true,
      tipo: true,

      clube: {
        select: {
          logo:
            true,

          usuarioId:
            true,
        },
      },

      escolinha: {
        select: {
          logo:
            true,

          usuarioId:
            true,
        },
      },

      marca: {
        select: {
          logo:
            true,

          usuarioId:
            true,
        },
      },

      federacao: {
        select: {
          logo:
            true,

          usuarioId:
            true,
        },
      },
    },
  },
  curtidas: { select: { usuarioId: true } },
  comentarios: {
    orderBy: { dataCriacao: "asc" as const },
    include: {
      usuario: { select: { id: true, nome: true, nomeDeUsuario: true, foto: true } },
    },
  },
};

function obterLogoOrganizacao(
  organizacao: any
) {
  if (!organizacao) {
    return null;
  }

  return (
    organizacao.clube?.logo ??
    organizacao.escolinha?.logo ??
    organizacao.marca?.logo ??
    organizacao.federacao?.logo ??
    null
  );
}

function normalizarOrganizacaoPost(
  post: any
): any {
  if (!post) {
    return post;
  }

  let perfilUsuarioId:
    string | null =
    null;

  let perfilPapel:
    string | null =
    null;

  if (
    post.organizacao
      ?.clube
  ) {
    perfilUsuarioId =
      post.organizacao
        .clube.usuarioId ??
      null;

    perfilPapel =
      "Clube";
  } else if (
    post.organizacao
      ?.escolinha
  ) {
    perfilUsuarioId =
      post.organizacao
        .escolinha
        .usuarioId ??
      null;

    perfilPapel =
      "Escolinha";
  } else if (
    post.organizacao
      ?.marca
  ) {
    perfilUsuarioId =
      post.organizacao
        .marca.usuarioId ??
      null;

    perfilPapel =
      "Marca";
  } else if (
    post.organizacao
      ?.federacao
  ) {
    perfilUsuarioId =
      post.organizacao
        .federacao
        .usuarioId ??
      null;

    perfilPapel =
      "Federacao";
  }

  const organizacao =
    post.organizacao
      ? {
          id:
            post.organizacao.id,

          nome:
            post.organizacao.nome,

          tipo:
            post.organizacao.tipo,

          logo:
            obterLogoOrganizacao(
              post.organizacao
            ),

          perfilUsuarioId,

          perfilPapel,
        }
      : null;

  return {
    ...post,

    organizacao,

    repostOf:
      post.repostOf
        ? normalizarOrganizacaoPost(
            post.repostOf
          )
        : null,
  };
}

async function carregarCadeiaRepost(post: any): Promise<any> {
  if (!post?.repostOfId) return post;

  let atual = post;
  let depth = 0;
  const MAX_DEPTH = 20; 

  while (atual?.repostOfId && depth < MAX_DEPTH) {
    const pai = await prisma.postagem.findUnique({
      where: { id: atual.repostOfId },
      include: postagemIncludeBase,
    });

    if (!pai) break;

    atual.repostOf = pai;
    atual = atual.repostOf;
    depth++;
  }

  return post;
}

async function carregarCadeiasDosPosts(posts: any[]) {
  return Promise.all(posts.map((post) => carregarCadeiaRepost(post)));
}

async function emitirNovoPost(
  post: any,
  autorId: string,
  visibilidade:
    VisibilidadePostagem
) {
  const io = getIO();

  if (!io) return;

  if (
    visibilidade ===
    VisibilidadePostagem.PRIVADO
  ) {
    io.to(
      `u:${autorId}`
    ).emit(
      "feed:novoPost",
      post
    );

    return;
  }

  const seguidores =
    await prisma.seguidor.findMany({
      where: {
        seguidoUsuarioId:
          autorId,
      },

      select: {
        seguidorUsuarioId:
          true,
      },
    });

  const rooms = [
    `u:${autorId}`,

    ...seguidores.map(
      (s) =>
        `u:${s.seguidorUsuarioId}`
    ),
  ];

  io.to(rooms).emit(
    "feed:novoPost",
    post
  );
}

function getPostDateMs(post: any) {
  const raw =
    post?.dataCriacao ??
    post?.createdAt ??
    post?.criadoEm ??
    post?.updatedAt ??
    null;

  const ms = raw ? new Date(raw).getTime() : 0;

  return Number.isFinite(ms) ? ms : 0;
}

function ordenarPostsDestaquePrimeiro(posts: any[]) {
  return [...posts].sort((a, b) => {
    const ad = a?.usuario?.destaque === true ? 1 : 0;
    const bd = b?.usuario?.destaque === true ? 1 : 0;

    if (ad !== bd) return bd - ad;

    return getPostDateMs(b) - getPostDateMs(a);
  });
}

async function isProUser(
  userId: string
) {
  const contexto =
    await getActiveContext(
      userId
    );

  if (!contexto) {
    return false;
  }

  const assinatura =
    await prisma.assinatura.findFirst({
      where: {
        usuarioId:
          userId,

        contextoKey:
          contexto.key,
      },

      orderBy: [
        { ativo: "desc" },
        { renovaEm: "desc" },
        { startsAt: "desc" },
      ],

      select: {
        ativo: true,
        plano: true,
        status: true,
        trialEndsAt: true,
      },
    });

  if (!assinatura) {
    return false;
  }

  const status =
    String(
      assinatura.status || ""
    ).toUpperCase();

  const plano =
    String(
      assinatura.plano || ""
    ).toUpperCase();

  if (!assinatura.ativo) {
    return false;
  }

  if (
    status === "BLOQUEADA" ||
    status === "CANCELADA" ||
    status === "SEM_ASSINATURA"
  ) {
    return false;
  }

  if (status === "ATIVA") {
    return true;
  }

  if (status === "TRIAL") {
    if (
      assinatura.trialEndsAt
    ) {
      return (
        new Date() <=
        new Date(
          assinatura.trialEndsAt
        )
      );
    }

    return true;
  }

  return plano.includes(
    "PRO"
  );
}

async function getAdsConfigForUser(userId?: string) {
  if (!userId) {
    return {
      adsEnabled: false,
      adEveryN: null,
      adsRemainingToday: 0,
    };
  }

  const pro = await isProUser(userId);
  if (pro) {
    return {
      adsEnabled: false,
      adEveryN: null,
      adsRemainingToday: 0,
    };
  }

  const usedToday = await getDailyUsage(userId, "ads_impressions_day");
  const remaining = Math.max(0, ADS_CAP_PER_DAY - usedToday);

  return {
    adsEnabled: remaining > 0,
    adEveryN: AD_EVERY_N,
    adsRemainingToday: remaining,
  };
}

async function podeVisualizarCadeiaPostagem(
  post: any,
  usuarioId?: string | null
): Promise<boolean> {
  const visitados = new Set<string>();
  let atual = post;
  let profundidade = 0;

  while (atual) {
    if (profundidade++ >= 20) {
      return false;
    }

    const id = String(atual.id ?? "");

    if (!id || visitados.has(id)) {
      return false;
    }

    visitados.add(id);

    const permitido =
      await podeVisualizarPostagem(atual, usuarioId);

    if (!permitido) {
      return false;
    }

    atual = atual.repostOf ?? null;
  }

  return true;
}

export const getFeedPosts: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const visibilityWhere =
      await getPostVisibilityWhere(
        userId
      );

    let filterWhere:
      Prisma.PostagemWhereInput =
      {};
    const raw = String(req.query.filtro ?? req.query.filter ?? "todos").toLowerCase();
    const filtro: "todos" | "seguindo" | "favoritos" | "meus" =
      raw === "seguindo" || raw === "favoritos" || raw === "meus" ? (raw as any) : "todos";

    if (filtro === "meus") {
      if (!userId) {
        const ads = await getAdsConfigForUser(undefined);
        return res.json({ items: [], meta: ads });
      }
      filterWhere = { usuarioId: userId };
    }

    if (filtro === "todos") {
      if (userId) filterWhere = { NOT: { usuarioId: userId } };
    }

    if (filtro === "seguindo") {
      if (!userId) {
        const ads = await getAdsConfigForUser(undefined);
        return res.json({ items: [], meta: ads });
      }
      const seguindo = await prisma.seguidor.findMany({
        where: { seguidorUsuarioId: userId },
        select: { seguidoUsuarioId: true },
      });
      const ids = seguindo.map((s) => s.seguidoUsuarioId);
      if (ids.length === 0) {
        const ads = await getAdsConfigForUser(userId);
        return res.json({ items: [], meta: ads });
      }
      filterWhere = { usuarioId: { in: ids } };
    }

    if (filtro === "favoritos") {
      if (!userId) {
        const ads = await getAdsConfigForUser(undefined);
        return res.json({ items: [], meta: ads });
      }
      const favs = await prisma.favoritoUsuario.findMany({
        where: { usuarioId: userId },
        select: { favoritoUsuarioId: true },
      });
      const ids = favs.map((f) => f.favoritoUsuarioId);
      if (ids.length === 0) {
        const ads = await getAdsConfigForUser(userId);
        return res.json({ items: [], meta: ads });
      }
      filterWhere = { usuarioId: { in: ids } };
    }

    const perfilUsuarioId = String(
      req.query.perfilUsuarioId ?? ""
    ).trim();

    const perfilPapel = String(
      req.query.perfilPapel ?? ""
    ).trim();

    const perfilOrganizacaoId = String(
      req.query.perfilOrganizacaoId ?? ""
    ).trim();

    const filtrosDePerfilInformados = [
      perfilUsuarioId,
      perfilPapel,
      perfilOrganizacaoId,
    ].some(Boolean);

    let perfilWhere: Prisma.PostagemWhereInput = {};

    if (filtrosDePerfilInformados) {
      if (
        perfilOrganizacaoId &&
        (perfilUsuarioId || perfilPapel)
      ) {
        return res.status(400).json({
          code: "INVALID_PROFILE_FILTER",
          message: "Informe somente um tipo de perfil.",
        });
      }

      if (perfilOrganizacaoId) {
        perfilWhere = {
          organizacaoId: perfilOrganizacaoId,
        };
      } else {
        const papeisPermitidos = [
          "Atleta",
          "Professor",
          "Olheiro",
          "Learning",
          "Responsavel",
          "Creator",
        ];

        if (
          !perfilUsuarioId ||
          !papeisPermitidos.includes(perfilPapel)
        ) {
          return res.status(400).json({
            code: "INVALID_PROFILE_FILTER",
            message: "Informe um usuário e um papel válidos.",
          });
        }

        perfilWhere = {
          usuarioId: perfilUsuarioId,
          organizacaoId: null,
          autorContextoKey: `personal:${perfilPapel}`,
        };
      }
    }

    const where: Prisma.PostagemWhereInput = {
      AND: [
        visibilityWhere,
        filtrosDePerfilInformados ? perfilWhere : filterWhere,
      ],
    };

    const postagensBase = await prisma.postagem.findMany({
      where,
      orderBy: { dataCriacao: "desc" },
      include: {
        ...postagemIncludeBase,
      },
    });

    const postagensComCadeia =
      await carregarCadeiasDosPosts(
        postagensBase
      );
    const autorizacoes = await Promise.all(
      postagensComCadeia.map((post) =>
        podeVisualizarCadeiaPostagem(post, userId)
      )
    );

    const postagensAutorizadas =
      postagensComCadeia.filter(
        (_, index) => autorizacoes[index]
      );

    const postagens =
      ordenarPostsDestaquePrimeiro(
        postagensAutorizadas.map(
          normalizarOrganizacaoPost
        )
      );

    const items = userId
      ? postagens
      : postagens
          .map(
            sanitizePublicPost
          )
          .filter(Boolean);

    const ads = await getAdsConfigForUser(userId);

    return res.json({
      items,

      meta: {
        adsEnabled:
          ads.adsEnabled,

        adEveryN:
          ads.adsEnabled
            ? ads.adEveryN
            : null,

        adsRemainingToday:
          ads.adsRemainingToday,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar feed:", error);
    return res.status(500).json({ message: "Erro ao buscar postagens." });
  }
};

export async function getPostById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const postBase = await prisma.postagem.findUnique({
      where: { id },
      include: {
        ...postagemIncludeBase,
      },
    });

    if (!postBase) return res.status(404).json({ erro: "Post não encontrado" });

    const viewerId =
      (req as any)
        .userId as
        | string
        | undefined;

    const permitido =
      await podeVisualizarPostagem(
        postBase,
        viewerId
      );

    if (!permitido) {
      return res.status(403).json({
        code:
          "POST_NOT_ACCESSIBLE",

        message:
          "Esta publicação não está disponível.",
      });
    }
    const postComCadeia =
      await carregarCadeiaRepost(postBase);

    const cadeiaPermitida =
      await podeVisualizarCadeiaPostagem(
        postComCadeia,
        viewerId
      );

    if (!cadeiaPermitida) {
      return res.status(403).json({
        code: "POST_NOT_ACCESSIBLE",
        message:
          "Esta publicação não está disponível.",
      });
    }

    const post =
      normalizarOrganizacaoPost(
        postComCadeia
      );

    if (!viewerId) {
      return res.json(
        sanitizePublicPost(post)
      );
    }

    return res.json(post);
  } catch (error) {
    console.error("Erro ao buscar post:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar o post" });
  }
}

export const curtirPostagem: RequestHandler = async (req, res) => {
  const { postId } = req.params;
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  try {
   const post =
    await prisma.postagem.findUnique({
      where: {
        id: postId,
      },

      select: {
        id: true,
        usuarioId: true,
        organizacaoId: true,
        visibilidade: true,
        oculto: true,

        organizacao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!post) {
      return res
        .status(404)
        .json({
          message:
            "Postagem não encontrada.",
        });
    }

    const permitido =
      await podeVisualizarPostagem(
        post,
        usuarioId
      );

    if (!permitido) {
      return res
        .status(403)
        .json({
          code:
            "POST_NOT_ACCESSIBLE",

          message:
            "Esta publicação não está disponível.",
        });
    }

    const curtidaExistente = await prisma.curtida.findFirst({
      where: {
        postagemId: postId,
        usuarioId,
      },
    });

    if (curtidaExistente) {
      await prisma.curtida.delete({
        where: { id: curtidaExistente.id },
      });
      return res.json({ message: "Curtida removida" });
    } else {
      await prisma.curtida.create({
        data: {
          postagemId:
            postId,

          usuarioId,
        },
      });

      if (
        post.usuarioId &&
        post.usuarioId !== usuarioId
      ) {
        try {
          const nomeOrganizacao =
            String(
              post.organizacao?.nome ??
              ""
            ).trim();

          const mensagem =
            nomeOrganizacao
              ? `A publicação da ${nomeOrganizacao} recebeu uma nova curtida.`
              : "Sua publicação recebeu uma nova curtida.";

          await criarNotificacaoEEnviarPush({
            usuarioId:
              post.usuarioId,

            actorId:
              usuarioId,

            tipo:
              NotificacaoTipo.GENERICA,

            titulo:
              "Nova curtida",

            mensagem,

            link:
              `/post/${encodeURIComponent(
                postId
              )}`,
          });
        } catch (error) {
          console.warn(
            "[curtirPostagem] falha ao criar notificação:",
            error
          );
        }
      }

      return res.json({
        message:
          "Curtida adicionada",
      });
    }
  } catch (error) {
    console.error("Erro ao curtir post:", error);
    return res.status(500).json({ error: "Erro interno ao curtir post" });
  }
};

export const seguirUsuario: RequestHandler = async (req, res) => {
  const seguidorUsuarioId = req.userId!;
  const { seguidoUsuarioId } = req.body as { seguidoUsuarioId?: string };

  if (!seguidoUsuarioId)
    return res.status(400).json({ message: "seguidoUsuarioId é obrigatório" });
  if (seguidoUsuarioId === seguidorUsuarioId)
    return res.status(400).json({ message: "Não é permitido seguir a si mesmo." });

  const jaSegue = await prisma.seguidor.findFirst({
    where: { seguidorUsuarioId, seguidoUsuarioId },
  });
  if (jaSegue) return res.status(409).json({ message: "Você já segue este usuário." });

  await prisma.seguidor.create({ data: { seguidorUsuarioId, seguidoUsuarioId } });
  
  const organizacaoId =
    await obterOrganizacaoAtivaDoUsuario(
      seguidoUsuarioId
    );

  if (
    organizacaoId
  ) {
    await prisma.organizacaoSeguidor.upsert({
      where: {
        organizacaoId_usuarioId: {
          organizacaoId,

          usuarioId:
            seguidorUsuarioId,
        },
      },

      update: {},

      create: {
        organizacaoId,

        usuarioId:
          seguidorUsuarioId,
      },
    });
  }

  res.sendStatus(201);
};

export const postar: RequestHandler = async (req, res) => {
  const usuarioId = req.userId;
  if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });

  const { conteudo, descricao, imagemUrl: imagemUrlBody, videoUrl: videoUrlBody } = req.body;
  const texto = (descricao && descricao.length ? descricao : conteudo) || "";
  const file = req.file as any; 

  try {
    let tipoMidia: "Imagem" | "Video" | undefined;
    let imagemUrl: string | undefined;
    let videoUrl: string | undefined;

    if (file && file.location) {
      const isVideo = file.mimetype?.startsWith("video");
      if (isVideo) {
        tipoMidia = "Video";
        videoUrl = file.location; 
      } else {
        tipoMidia = "Imagem";
        imagemUrl = file.location; 
      }
    } else {
      if (imagemUrlBody) {
        imagemUrl = imagemUrlBody;
        tipoMidia = "Imagem";
      }
      if (videoUrlBody) {
        videoUrl = videoUrlBody;
        tipoMidia = "Video";
      }
    }

    if (!texto && !imagemUrl && !videoUrl) {
      return res.status(400).json({ message: "Conteúdo ou mídia obrigatória." });
    }

    const visibilidade =
      normalizarVisibilidadePostagem(
        req.body?.visibilidade,
        VisibilidadePostagem.LOGADO
      );

    const autorResolvido =
      await resolverAutorPostagem(
        usuarioId,
        req.body?.authorContextKey
      );

    const organizacaoId =
      autorResolvido.organizacaoId;

    const autorContextoKey =
      autorResolvido.contexto.key;

    const postagem = await prisma.postagem.create({
      data: {
        conteudo: texto,
        usuarioId,
        organizacaoId,
        autorContextoKey,
        dataCriacao: new Date(),
        tipoMidia,
        imagemUrl,
        videoUrl,
        visibilidade,
      },
    });

    const postForEmit =
      await prisma.postagem.findUnique({
        where: {
          id:
            postagem.id,
        },

        include: {
          ...postagemIncludeBase,
        },
      });
    
    const postNormalizado =
      normalizarOrganizacaoPost(
        postForEmit
      );

    await emitirNovoPost(
      postNormalizado,
      usuarioId,
      visibilidade
    );

    return res.status(201).json(postagem);
  } catch (error: any) {
    console.error(
      "Erro ao postar:",
      error
    );

    const status =
      Number(
        error?.status ??
          error?.statusCode ??
          500
      );

    if (
      Number.isFinite(status) &&
      status >= 400 &&
      status < 500
    ) {
      return res.status(status).json({
        message:
          error?.message ??
          "Não foi possível publicar.",

        code:
          error?.code ??
          "POST_CREATE_FAILED",
      });
    }

    return res.status(500).json({
      message:
        "Erro interno.",

      code:
        "POST_CREATE_FAILED",
    });
  }
};

async function responsavelPodeGerenciarPostagem(
  responsavelUsuarioId: string,
  atletaUsuarioId: string
) {
  const atleta = await prisma.atleta.findUnique({
    where: {
      usuarioId: atletaUsuarioId,
    },
    select: {
      id: true,
    },
  });

  if (!atleta) {
    return null;
  }

  const autorizado =
    await verificarPermissaoResponsavelAtleta({
      responsavelUsuarioId,
      atletaId: atleta.id,
      permissao: "podeGerenciarConteudo",
    });

  if (!autorizado) {
    return null;
  }

  return prisma.responsavelAtleta.findUnique({
    where: {
      responsavelUsuarioId_atletaId: {
        responsavelUsuarioId,
        atletaId: atleta.id,
      },
    },
    select: {
      id: true,
      atletaId: true,
      responsavelUsuarioId: true,
    },
  });
}

export const deletarPostagem:
  RequestHandler =
async (req, res) => {
  const { id } =
    req.params;

  const usuarioId =
    req.userId;

  if (!usuarioId) {
    return res
      .status(401)
      .json({
        mensagem:
          "Usuário não autenticado.",
      });
  }

  try {
    const post =
      await prisma
        .postagem
        .findUnique({
          where: {
            id,
          },

          select: {
            id: true,
            usuarioId: true,
            organizacaoId: true,
            repostOfId: true,
            imagemUrl: true,
            videoUrl: true,
          },
        });

    if (!post) {
      return res
        .status(404)
        .json({
          mensagem:
            "Postagem não encontrada.",
        });
    }

    const proprioAutor =
      !post.organizacaoId &&
      post.usuarioId === usuarioId;

    let gestorOrganizacao = false;

    if (post.organizacaoId) {
      const contexto = await getActiveContext(usuarioId);

      const mesmaOrganizacao =
        contexto?.kind === "ORGANIZATION" &&
        contexto.organizationId === post.organizacaoId;

      if (mesmaOrganizacao) {
        gestorOrganizacao = await canPermission(
          usuarioId,
          "GERENCIAR_ORGANIZACAO"
        );
      }

      if (!gestorOrganizacao) {
        return res.status(403).json({
          code: "POST_ORGANIZATION_DELETE_FORBIDDEN",
          mensagem:
            "Somente um gestor autorizado da organização proprietária pode excluir esta publicação.",
        });
      }
    }

    let vinculoResponsavel:
      Awaited<
        ReturnType<
          typeof responsavelPodeGerenciarPostagem
        >
      > =
      null;

    if (!proprioAutor && !gestorOrganizacao) {
      if (
        post.organizacaoId
      ) {
        return res
          .status(403)
          .json({
            code:
              "RESPONSAVEL_CANNOT_DELETE_ORGANIZATION_POST",

            mensagem:
              "O responsável não pode apagar uma publicação feita em nome de uma organização.",
          });
      }

      vinculoResponsavel =
        post.usuarioId
          ? await responsavelPodeGerenciarPostagem(
              usuarioId,
              post.usuarioId
            )
          : null;

      if (
        !vinculoResponsavel
      ) {
        return res
          .status(403)
          .json({
            code:
              "POST_DELETE_FORBIDDEN",

            mensagem:
              "Você não está autorizado a apagar esta postagem.",
          });
      }
    }

    if (
      post.repostOfId
    ) {
      let rootId =
        post.repostOfId;

      let cursor =
        await prisma
          .postagem
          .findUnique({
            where: {
              id:
                rootId,
            },

            select: {
              repostOfId:
                true,
            },
          });

      while (
        cursor?.repostOfId
      ) {
        rootId =
          cursor
            .repostOfId;

        cursor =
          await prisma
            .postagem
            .findUnique({
              where: {
                id:
                  cursor
                    .repostOfId,
              },

              select: {
                repostOfId:
                  true,
              },
            });
      }

      await prisma
        .postagem
        .update({
          where: {
            id:
              rootId,
          },

          data: {
            reposts: {
              decrement:
                1,
            },
          },
        })
        .catch(
          () => {}
        );
    }

    await prisma
      .postagem
      .delete({
        where: {
          id,
        },
      });

    if (
      vinculoResponsavel
    ) {
      try {
        await audit(
          req as any,
          {
            acao:
              "POST_REMOVIDO_POR_RESPONSAVEL",

            entidade:
              "Postagem",

            entidadeId:
              id,

            descricao:
              "Responsável removeu uma postagem do atleta supervisionado.",

            meta: {
              atletaId:
                vinculoResponsavel
                  .atletaId,

              atletaUsuarioId:
                post.usuarioId,

              responsavelUsuarioId:
                usuarioId,

              responsavelAtletaId:
                vinculoResponsavel
                  .id,
            },
          }
        );
      } catch (
        auditError
      ) {
        console.warn(
          "[deletarPostagem] erro ao registrar auditoria:",
          auditError
        );
      }
    }

    return res.json({
      mensagem:
        vinculoResponsavel
          ? "Postagem removida pelo responsável."
          : "Postagem excluída com sucesso.",
    });
  } catch (err) {
    console.error(
      "Erro ao excluir postagem:",
      err
    );

    return res
      .status(500)
      .json({
        mensagem:
          "Erro ao excluir postagem.",
      });
  }
};

export const getPerfil: RequestHandler = async (req, res) => {
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        nomeDeUsuario: true,
        email: true,
        foto: true,
        tipo: true,
        cidade: true,
        estado: true,
        pais: true,
        postagens: true,
        seguidores: true,
        seguindo: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    res.json(usuario);
  } catch (error) {
    console.error("Erro ao obter perfil:", error);
    res.status(500).json({ message: "Erro interno ao buscar perfil." });
  }
};

export const deletarUsuario: RequestHandler = async (req, res) => {
  console.warn(
    "[deletarUsuario] Rota antiga de exclusão bloqueada. " +
    "Utilize o fluxo de exclusão de conta das configurações."
  );

  return res.status(410).json({
    code: "LEGACY_ACCOUNT_DELETE_DISABLED",
    message:
      "Esta forma de exclusão de conta foi desativada. " +
      "Utilize a opção de excluir conta nas configurações.",
  });
};

export async function repostPost(req: Request, res: Response) {
  try {
    const postId = String(req.params.id);
    const userId = (req as any).userId as string | undefined;
    const comentarioRaw = req.body?.comentario;
    const comentario = String(comentarioRaw ?? "").trim();

    if (!userId) return res.status(401).json({ message: "Usuário não autenticado" });

    const clicked =
      await prisma.postagem.findUnique({
        where: {
          id: postId,
        },

        select: {
          id: true,
          repostOfId: true,
          usuarioId: true,
          visibilidade: true,
          oculto: true,
          organizacaoId: true,
        },
      });
    if (!clicked) return res.status(404).json({ message: "Post não encontrado" });
    const postComCadeia = await carregarCadeiaRepost(clicked);

    const cadeiaPermitida =
      await podeVisualizarCadeiaPostagem(
        postComCadeia,
        userId
      );

    if (!cadeiaPermitida) {
      return res.status(403).json({
        code: "POST_NOT_ACCESSIBLE",
        message:
          "Você não pode republicar este conteúdo.",
      });
    }

    const permitido =
      await podeVisualizarPostagem(
        clicked,
        userId
      );

    if (!permitido) {
      return res
        .status(403)
        .json({
          code:
            "POST_NOT_ACCESSIBLE",

          message:
            "Esta publicação não está disponível.",
        });
    }

    const parentId = clicked.id;

    let rootId = clicked.id;
    let cursor: { repostOfId: string | null } | null = clicked;

    while (cursor?.repostOfId) {
      rootId = cursor.repostOfId;
      cursor = await prisma.postagem.findUnique({
        where: { id: cursor.repostOfId },
        select: { repostOfId: true },
      });
    }

    const rootExists = await prisma.postagem.findUnique({
      where: { id: rootId },
      select: { id: true },
    });
    if (!rootExists) return res.status(404).json({ message: "Post original não encontrado" });

    const conteudoRepost = comentario ? comentario : "\u200B";

    const existente = await prisma.postagem.findFirst({
      where: {
        usuarioId: userId,
        repostOfId: parentId,
        conteudo: conteudoRepost,
      },
      select: { id: true },
    });

    if (existente) {
      await prisma.postagem.delete({ where: { id: existente.id } });

      await prisma.postagem
        .update({
          where: { id: rootId },
          data: { reposts: { decrement: 1 } },
        })
        .catch(() => {});

      return res.json({ ok: true, action: "unrepost", id: existente.id });
    }

    const autorRepost =
      await resolverAutorPostagem(
        userId,
        req.body?.authorContextKey
      );

    const organizacaoRepostId =
      autorRepost.organizacaoId;

    const autorRepostContextoKey =
      autorRepost.contexto.key;

    const novoBase =
      await prisma.postagem.create({
        data: {
          usuarioId:
            userId,

          organizacaoId:
            organizacaoRepostId,

          autorContextoKey:
            autorRepostContextoKey,

          conteudo:
            conteudoRepost,

          repostOfId:
            parentId,

          visibilidade:
            clicked.visibilidade,
        },

        include: {
          ...postagemIncludeBase,
        },
      });

    const novo =
      normalizarOrganizacaoPost(
        await carregarCadeiaRepost(
          novoBase
        )
      );

    await prisma.postagem.update({
      where: { id: rootId },
      data: { reposts: { increment: 1 } },
    });

    await emitirNovoPost(
      novo,
      userId,
      clicked.visibilidade
    );
    return res.json({ ok: true, action: "repost", post: novo });
  } catch (e) {
    console.error("Erro ao repostar:", e);
    return res.status(500).json({ message: "Erro ao repostar" });
  }
}

export const compartilharPost:
  RequestHandler =
async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      message:
        "Usuário não autenticado.",
    });
  }

  try {
    const post =
      await prisma.postagem.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          usuarioId: true,
          organizacaoId: true,
          visibilidade: true,
          oculto: true,
        },
      });

    if (!post) {
      return res.status(404).json({
        message:
          "Postagem não encontrada.",
      });
    }

    const permitido =
      await podeVisualizarPostagem(
        post,
        userId
      );

    if (!permitido) {
      return res.status(403).json({
        code:
          "POST_NOT_ACCESSIBLE",

        message:
          "Esta publicação não está disponível.",
      });
    }

    await prisma.postagem.update({
      where: {
        id,
      },

      data: {
        compartilhamentos: {
          increment: 1,
        },
      },
    });

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Erro ao compartilhar post:",
      error
    );

    return res.status(500).json({
      message:
        "Erro interno ao registrar compartilhamento.",
    });
  }
};