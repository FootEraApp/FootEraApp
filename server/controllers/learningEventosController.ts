// server/controllers/learningEventosController.ts
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import {
  MetodologiaAssinaturaOrigem,
  MetodologiaAssinaturaStatus,
  TipoUsuario,
} from "@prisma/client";
import { sendLiveEventAccessEmail } from "../utils/mailer.js";
import { sendError } from "../utils/httpError.js";

const JWT_SECRET = process.env.JWT_SECRET || "";

const REPLAY_PUBLICO_DIAS = 7;

const REPLAY_PUBLICO_MS =
  REPLAY_PUBLICO_DIAS *
  24 *
  60 *
  60 *
  1000;

function calcularValidadeReplay(
  aula: any
) {
  const status = String(
    aula?.status || ""
  ).toUpperCase();

  if (status !== "FINALIZADA") {
    return {
      replayExpiraEm: null,
      replayExpirado: false,
      segundosRestantes: null,
    };
  }

  const finalizacaoRaw =
    aula?.finalizouEm ||
    aula?.dataFim ||
    null;

  if (!finalizacaoRaw) {
    return {
      replayExpiraEm: null,
      replayExpirado: false,
      segundosRestantes: null,
    };
  }

  const finalizacao =
    new Date(finalizacaoRaw);

  if (
    Number.isNaN(
      finalizacao.getTime()
    )
  ) {
    return {
      replayExpiraEm: null,
      replayExpirado: false,
      segundosRestantes: null,
    };
  }

  const expiraEm =
    new Date(
      finalizacao.getTime() +
        REPLAY_PUBLICO_MS
    );

  const diferenca =
    expiraEm.getTime() -
    Date.now();

  return {
    replayExpiraEm:
      expiraEm,

    replayExpirado:
      diferenca <= 0,

    segundosRestantes:
      Math.max(
        0,
        Math.floor(
          diferenca / 1000
        )
      ),
  };
}

function getBearerToken(req: Request) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return "";
  return raw.replace("Bearer ", "").trim();
}

function getUserIdFromOptionalToken(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token || !JWT_SECRET) return "";

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return String(decoded?.id || decoded?.sub || decoded?.userId || "").trim();
  } catch {
    return "";
  }
}

function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function slugFromEmail(email: string) {
  return email
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
}

async function gerarNomeDeUsuarioLearning(email: string) {
  const base = slugFromEmail(email) || "learning";
  let candidate = base;
  let count = 1;

  while (true) {
    const exists = await prisma.usuario.findFirst({
      where: { nomeDeUsuario: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;

    count++;
    candidate = `${base}${count}`;
  }
}

function assinarToken(usuario: any) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return jwt.sign(
    {
      id: usuario.id,
      tipo: usuario.tipo,
      tokenVersion: usuario.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getTipoUsuarioId(usuario: any) {
  return (
    usuario?.learningProfile?.id ||
    usuario?.atleta?.id ||
    usuario?.professor?.id ||
    usuario?.clube?.id ||
    usuario?.escolinha?.id ||
    usuario?.administrador?.id ||
    usuario?.federacao?.id ||
    usuario?.marca?.id ||
    null
  );
}

function criarErroHttp(
  mensagem: string,
  statusCode: number
) {
  const erro: any =
    new Error(mensagem);

  erro.statusCode =
    statusCode;

  erro.status =
    statusCode;

  return erro;
}

async function criarOuBuscarUsuarioLearning(params: {
  nome: string;
  email: string;
  senha?: string;
}) {
  const email = normalizeEmail(params.email);

  const existente = await prisma.usuario.findFirst({
    where: { email },
    include: {
      learningProfile: { select: { id: true } },
      atleta: { select: { id: true } },
      professor: { select: { id: true } },
      clube: { select: { id: true } },
      escolinha: { select: { id: true } },
      administrador: { select: { id: true } },
      federacao: { select: { id: true } },
      marca: { select: { id: true } },
    },
  });

  if (existente) {
    const senha =
      String(
        params.senha || ""
      );

    if (!senha) {
      throw criarErroHttp(
        "Este e-mail já possui uma conta. Informe sua senha ou entre pela tela de login.",
        401
      );
    }

    if (!existente.senhaHash) {
      throw criarErroHttp(
        "Esta conta utiliza outro método de acesso. Entre pela tela de login.",
        401
      );
    }

    const senhaCorreta =
      await bcrypt.compare(
        senha,
        existente.senhaHash
      );

    if (!senhaCorreta) {
      throw criarErroHttp(
        "E-mail ou senha inválidos.",
        401
      );
    }

    return {
      usuario: existente,
      criadoAgora: false,
    };
  }

  if (!params.senha || String(params.senha).length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  const senhaHash = await bcrypt.hash(String(params.senha), 10);
  const nomeDeUsuario = await gerarNomeDeUsuarioLearning(email);

  const usuario = await prisma.usuario.create({
    data: {
      nome: params.nome.trim(),
      nomeDeUsuario,
      email,
      senhaHash,
      tipo: TipoUsuario.Learning,
      verified: true,
      learningProfile: {
        create: {},
      },
    },
    include: {
      learningProfile: { select: { id: true } },
      atleta: { select: { id: true } },
      professor: { select: { id: true } },
      clube: { select: { id: true } },
      escolinha: { select: { id: true } },
      administrador: { select: { id: true } },
      federacao: { select: { id: true } },
      marca: { select: { id: true } },
    },
  });

  return {
    usuario,
    criadoAgora: true,
  };
}

async function buscarAulaCompleta(aulaId: string) {
  return prisma.aulaAoVivo.findUnique({
    where: { id: aulaId },

    include: {
      criadorUsuario: {
        select: {
          id: true,
          nome: true,
          foto: true,
          tipo: true,
          nomeDeUsuario: true,
        },
      },

      convidadoUsuario: {
        select: {
          id: true,
          nome: true,
          foto: true,
          tipo: true,
          nomeDeUsuario: true,
        },
      },

      convidados: {
        orderBy: {
          ordem: "asc",
        },

        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              foto: true,
              tipo: true,
              nomeDeUsuario: true,
            },
          },
        },
      },

      metodologia: {
        select: {
          id: true,
          titulo: true,
          descricao: true,
          capaUrl: true,
          ativo: true,
          criadorUsuarioId: true,

          criadorUsuario: {
            select: {
              id: true,
              nome: true,
              foto: true,
            },
          },
        },
      },

      metodologiaAvulsa: {
        select: {
          id: true,
          titulo: true,
          descricao: true,
          capaUrl: true,
          ativo: true,
          precoAssinaturaMensal: true,
          criadorUsuarioId: true,

          criadorUsuario: {
            select: {
              id: true,
              nome: true,
              foto: true,
            },
          },
        },
      },
    },
  });
}

function getWebBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.WEB_BASE_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");
}

function normalizarTexto(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function montarLinkPublicoEvento(aula: any) {
  const base = getWebBaseUrl();

  const texto = normalizarTexto(
    [
      aula?.titulo,
      aula?.descricao,
      aula?.metodologia?.titulo,
      aula?.metodologiaAvulsa?.titulo,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const isSalaCopa =
    texto.includes("sala copa") ||
    texto.includes("copa") ||
    texto.includes("copa do mundo") ||
    texto.includes("mundial");

  if (!isSalaCopa) {
    return `${base}/learning/evento/${aula.id}`;
  }

  const origem = aula?.metodologiaAvulsaId ? "avulsa" : "learning";
  const metodologiaId = aula?.metodologiaAvulsaId || aula?.metodologiaId || "";

  return `${base}/learning/evento/sala-copa?aulaId=${encodeURIComponent(
    aula.id
  )}&origem=${encodeURIComponent(origem)}&metodologiaId=${encodeURIComponent(
    metodologiaId
  )}`;
}

function montarLinkLive(aula: any) {
  const base = getWebBaseUrl();
  return `${base}/learning/live?aulaId=${encodeURIComponent(aula.id)}`;
}

async function enviarEmailEventoSeSolicitado(params: {
  receberEmail: any;
  usuario: any;
  aula: any;
}) {
  const receberEmail = params.receberEmail !== false;

  if (!receberEmail) return;

  const email = String(params.usuario?.email || "").trim();
  if (!email) return;

  const linkEvento = montarLinkPublicoEvento(params.aula);
  const linkLive = montarLinkLive(params.aula);

  try {
    await sendLiveEventAccessEmail({
      to: email,
      nome: params.usuario?.nome || params.usuario?.nomeDeUsuario || null,
      tituloEvento: params.aula?.titulo || "Evento ao vivo FootEra",
      dataInicio: params.aula?.dataInicio || null,
      linkEvento,
      linkLive,
    });
  } catch (err) {
    console.error("[learning-eventos] erro ao enviar e-mail do evento:", err);
  }
}

async function buscarAssinatura(params: {
  usuarioId: string;
  metodologiaId?: string | null;
  metodologiaAvulsaId?: string | null;
}) {
  if (!params.usuarioId) return null;

  if (params.metodologiaAvulsaId) {
    return prisma.metodologiaAssinante.findFirst({
      where: {
        usuarioId: params.usuarioId,
        metodologiaAvulsaId: params.metodologiaAvulsaId,
        status: {
          in: [
            MetodologiaAssinaturaStatus.ATIVA,
            MetodologiaAssinaturaStatus.CONCLUIDA,
          ],
        },
        OR: [
          { expiraEm: null },
          { expiraEm: { gt: new Date() } },
        ],
      },
    });
  }

  if (params.metodologiaId) {
    return prisma.metodologiaAssinante.findFirst({
      where: {
        usuarioId: params.usuarioId,
        metodologiaId: params.metodologiaId,
        status: {
          in: [
            MetodologiaAssinaturaStatus.ATIVA,
            MetodologiaAssinaturaStatus.CONCLUIDA,
          ],
        },
        OR: [
          { expiraEm: null },
          { expiraEm: { gt: new Date() } },
        ],
      },
    });
  }

  return null;
}

async function criarAcessoMetodologia(params: {
  usuarioId: string;
  metodologiaId?: string | null;
  metodologiaAvulsaId?: string | null;
}) {
  const usuarioId = params.usuarioId;

  if (params.metodologiaAvulsaId) {
    const metodologiaAvulsaId = params.metodologiaAvulsaId;

    const existing = await prisma.metodologiaAssinante.findFirst({
      where: {
        usuarioId,
        metodologiaAvulsaId,
      },
    });

    if (existing) {
      return prisma.metodologiaAssinante.update({
        where: { id: existing.id },
        data: {
          status: MetodologiaAssinaturaStatus.ATIVA,
          origem: MetodologiaAssinaturaOrigem.AVULSA,
          iniciouEm: existing.iniciouEm ?? new Date(),
          expiraEm: null,
          progresso: (existing.progresso as any) || {
            concluidos: [],
            pontosGanhos: 0,
            atualizadoEm: new Date().toISOString(),
          },
        },
      });
    }

    return prisma.metodologiaAssinante.create({
      data: {
        usuarioId,
        metodologiaAvulsaId,
        origem: MetodologiaAssinaturaOrigem.AVULSA,
        status: MetodologiaAssinaturaStatus.ATIVA,
        iniciouEm: new Date(),
        expiraEm: null,
        progresso: {
          concluidos: [],
          pontosGanhos: 0,
          atualizadoEm: new Date().toISOString(),
        } as any,
      },
    });
  }

  if (params.metodologiaId) {
    const metodologiaId = params.metodologiaId;

    const existing = await prisma.metodologiaAssinante.findUnique({
      where: {
        metodologiaId_usuarioId: {
          metodologiaId,
          usuarioId,
        },
      },
    });

    if (existing) {
      return prisma.metodologiaAssinante.update({
        where: {
          metodologiaId_usuarioId: {
            metodologiaId,
            usuarioId,
          },
        },
        data: {
          status: MetodologiaAssinaturaStatus.ATIVA,
          origem: MetodologiaAssinaturaOrigem.LEARNING,
          iniciouEm: existing.iniciouEm ?? new Date(),
          progresso: (existing.progresso as any) || {
            concluidos: [],
            pontosGanhos: 0,
            atualizadoEm: new Date().toISOString(),
          },
        },
      });
    }

    return prisma.metodologiaAssinante.create({
      data: {
        usuarioId,
        metodologiaId,
        origem: MetodologiaAssinaturaOrigem.LEARNING,
        status: MetodologiaAssinaturaStatus.ATIVA,
        iniciouEm: new Date(),
        progresso: {
          concluidos: [],
          pontosGanhos: 0,
          atualizadoEm: new Date().toISOString(),
        } as any,
      },
    });
  }

  return null;
}

async function montarEventoResponse(params: {
  aula: any;
  userId: string;
}) {
  const { aula, userId } = params;

  const isOwner =
    !!userId &&
    (aula.criadorUsuarioId === userId ||
      aula.metodologia?.criadorUsuarioId === userId ||
      aula.metodologiaAvulsa?.criadorUsuarioId === userId);

  const isConvidadoFootEra =
    !!userId &&
    (
      String(
        aula.convidadoUsuarioId ||
          ""
      ) === String(userId) ||
      (
        Array.isArray(
          aula.convidados
        ) &&
        aula.convidados.some(
          (convidado: any) =>
            String(
              convidado.usuarioId ||
                ""
            ) ===
            String(userId)
        )
      )
    );

  const validadeReplay =
    calcularValidadeReplay(
      aula
    );

  const replayExpirado =
    validadeReplay
      .replayExpirado;
      
  const assinatura = await buscarAssinatura({
    usuarioId: userId,
    metodologiaId: aula.metodologiaId,
    metodologiaAvulsaId: aula.metodologiaAvulsaId,
  });

  const acessoAulaAvulsa =
    !aula.metodologiaId && !aula.metodologiaAvulsaId && userId
      ? await buscarAcessoAulaAvulsa({
          usuarioId: userId,
          aulaAoVivoId: aula.id,
        })
      : null;

  const produtoTipo = aula.metodologiaId
    ? "METODOLOGIA"
    : aula.metodologiaAvulsaId
      ? "METODOLOGIA_AVULSA"
      : "AULA_AO_VIVO";

  const precoAulaAoVivo =
    Number(
      aula.precoAcesso ?? 0
    );

  const aulaAvulsaPaga =
    produtoTipo ===
      "AULA_AO_VIVO" &&
    Number.isFinite(
      precoAulaAoVivo
    ) &&
    precoAulaAoVivo > 0;

  const aulaAvulsaGratuita =
    produtoTipo ===
      "AULA_AO_VIVO" &&
    !aulaAvulsaPaga;

  const temAcessoBase =
    isOwner ||
    isConvidadoFootEra ||
    !!assinatura ||
    !!acessoAulaAvulsa ||
    aulaAvulsaGratuita;

  const temAcesso =
    temAcessoBase &&
    !replayExpirado;

  const convidadosLista = Array.isArray(aula.convidados)
    ? aula.convidados
        .map((c: any) => ({
          id: c.id,
          usuarioId: c.usuarioId || null,
          usuario: c.usuario || null,
          nome: c.nome || c.usuario?.nome || null,
          descricao:
            c.descricao || (c.usuario ? "Convidado FootEra" : null),
          ordem: c.ordem,
        }))
        .filter((c: any) => c.usuarioId || c.nome)
    : [];

  const temConvidado =
    convidadosLista.length > 0 ||
    !!aula.convidadoUsuario ||
    !!String(
      aula.convidadoNome || ""
    ).trim();

  const primeiroConvidado =
    convidadosLista[0] ||
    null;

  const criadorUsuario =
    aula.criadorUsuario ||
    aula.metodologiaAvulsa
      ?.criadorUsuario ||
    aula.metodologia
      ?.criadorUsuario ||
    null;

  const pessoaDestaqueLabel =
    "Creator";

  const pessoaDestaqueNome =
    criadorUsuario?.nome ||
    "Creator do evento";

  const pessoaDestaqueDescricao =
    temConvidado
      ? "Creator do evento com convidados"
      : "Creator do evento";

  const planoId = aula.metodologiaId
    ? `METODOLOGIA:${aula.metodologiaId}`
    : aula.metodologiaAvulsaId
      ? `METODOLOGIA_AVULSA:${aula.metodologiaAvulsaId}`
      : `AULA_AO_VIVO:${aula.id}`;

  const preco =
    produtoTipo ===
    "AULA_AO_VIVO"
      ? precoAulaAoVivo

      : produtoTipo ===
        "METODOLOGIA_AVULSA"
      ? Number(
          aula
            .metodologiaAvulsa
            ?.precoAssinaturaMensal ??
            0
        )
      : 0;

  return {
    ...aula,
    streamKey: undefined,
    ivsIngestEndpoint: undefined,
    ivsStreamKeyArn: undefined,
    ivsChannelArn: undefined,
    ivsRecordingConfigurationArn:
      undefined,
    ivsRecordingS3Prefix:
      undefined,
    ivsRecordingId: undefined,
    urlStream:
      temAcesso &&
      aula.status === "AO_VIVO"
        ? aula.urlStream ?? null
        : null,
    videoGravadoUrl:
      temAcesso &&
      aula.status ===
        "FINALIZADA" &&
      aula.replayDisponivel ===
        true &&
      !replayExpirado
        ? aula.videoGravadoUrl ??
          null
        : null,

    replayDisponivel:
      aula.replayDisponivel ===
        true &&
      !replayExpirado,

    replayExpiraEm:
      validadeReplay
        .replayExpiraEm
        ?.toISOString() ??
      null,

    replayExpirado,

    segundosRestantes:
      validadeReplay
        .segundosRestantes,
    isOwner,
    criadorUsuario: criadorUsuario,
    temConvidado,
    pessoaDestaqueLabel,
    pessoaDestaqueNome,
    pessoaDestaqueDescricao,
    convidadoUsuario: aula.convidadoUsuario || null,
    convidados: convidadosLista,
    convidadoNome: temConvidado
      ? primeiroConvidado?.nome ||
        aula.convidadoNome ||
        aula.convidadoUsuario?.nome ||
        null
      : null,
    convidadoDescricao: temConvidado
      ? primeiroConvidado?.descricao ||
        aula.convidadoDescricao ||
        "Convidado FootEra"
      : null,

    acesso: {
      temAcesso,
      isOwner,
      isConvidadoFootEra,
      precisaLogin:
        !replayExpirado &&
        !userId &&
        !temAcessoBase,

      precisaPagamento:
        !replayExpirado &&
        !!userId &&
        !temAcessoBase,

      produtoTipo,
      planoId,
      preco,

      replayExpiraEm:
        validadeReplay
          .replayExpiraEm
          ?.toISOString() ??
        null,

      replayExpirado,

      segundosRestantes:
        validadeReplay
          .segundosRestantes,

      motivo:
        replayExpirado
          ? "REPLAY_EXPIRADO"
          : temAcessoBase
            ? null
            : !userId
              ? "PRECISA_LOGIN"
              : "PRECISA_PAGAMENTO",
    },

    metodologia: aula.metodologia
      ? {
          ...aula.metodologia,
          origem: "LEARNING",
        }
      : null,

    metodologiaAvulsa: aula.metodologiaAvulsa
      ? {
          ...aula.metodologiaAvulsa,
          origem: "AVULSA",
        }
      : null,
  };
}

export async function getAulaEventoPublica(req: Request, res: Response) {
  try {
    const aulaId = String(req.params.aulaId || "").trim();
    const userId = getUserIdFromOptionalToken(req);

    const aula = await buscarAulaCompleta(aulaId);

    if (!aula) {
      return res.status(404).json({
        message: "Evento ao vivo não encontrado.",
      });
    }

    const item = await montarEventoResponse({ aula, userId });

    return res.json({
      item,
      acesso: item.acesso,
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao carregar evento ao vivo.");
  }
}

export async function listarMinhasAulasLearning(
  req: Request,
  res: Response
) {
  try {
    const usuarioId =
      String(
        (req as any).userId ||
          (req as any).user?.id ||
          (req as any).userCtx?.id ||
          ""
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        message:
          "Usuário não autenticado.",
      });
    }

    const agora =
      new Date();

    const [
      acessos,
      presencas,
      assinaturas,
    ] = await Promise.all([
      prisma.aulaAoVivoAcesso
        .findMany({
          where: {
            usuarioId,

            status:
              "ATIVO",

            OR: [
              {
                expiraEm:
                  null,
              },
              {
                expiraEm: {
                  gt:
                    agora,
                },
              },
            ],
          },

          select: {
            aulaAoVivoId:
              true,

            origem:
              true,
          },
        }),

      prisma.aulaAoVivoPresenca
        .findMany({
          where: {
            usuarioId,
          },

          select: {
            aulaAoVivoId:
              true,

            entrouAoVivo:
              true,
          },
        }),

      prisma.metodologiaAssinante
        .findMany({
          where: {
            usuarioId,

            status: {
              in: [
                MetodologiaAssinaturaStatus.ATIVA,
                MetodologiaAssinaturaStatus.CONCLUIDA,
              ],
            },
          },

          select: {
            metodologiaId:
              true,

            metodologiaAvulsaId:
              true,

            status:
              true,

            expiraEm:
              true,
          },
        }),
    ]);

    const aulaIds =
      new Set<string>();

    const origemPorAula =
      new Map<
        string,
        string
      >();

    for (
      const acesso of acessos
    ) {
      if (
        !acesso.aulaAoVivoId
      ) {
        continue;
      }

      aulaIds.add(
        acesso.aulaAoVivoId
      );

      const origem =
        String(
          acesso.origem ||
            ""
        ).toUpperCase();

      if (
        origem.includes(
          "GRATUIT"
        )
      ) {
        origemPorAula.set(
          acesso.aulaAoVivoId,
          "GRATUITO"
        );
      } else {
        origemPorAula.set(
          acesso.aulaAoVivoId,
          "COMPRA"
        );
      }
    }

    for (
      const presenca of presencas
    ) {
      if (
        !presenca.aulaAoVivoId
      ) {
        continue;
      }

      aulaIds.add(
        presenca.aulaAoVivoId
      );

      if (
        !origemPorAula.has(
          presenca.aulaAoVivoId
        )
      ) {
        origemPorAula.set(
          presenca.aulaAoVivoId,
          "PRESENCA"
        );
      }
    }

    const metodologiaIds =
      new Set<string>();

    const metodologiaAvulsaIds =
      new Set<string>();

    for (
      const assinatura of
      assinaturas
    ) {
      const status =
        String(
          assinatura.status ||
            ""
        ).toUpperCase();

      const expirada =
        assinatura.expiraEm &&
        assinatura.expiraEm <=
          agora;

      if (
        status === "ATIVA" &&
        expirada
      ) {
        continue;
      }

      if (
        assinatura.metodologiaId
      ) {
        metodologiaIds.add(
          assinatura.metodologiaId
        );
      }

      if (
        assinatura
          .metodologiaAvulsaId
      ) {
        metodologiaAvulsaIds.add(
          assinatura
            .metodologiaAvulsaId
        );
      }
    }

    const criterios: any[] =
      [];

    if (
      aulaIds.size > 0
    ) {
      criterios.push({
        id: {
          in:
            Array.from(
              aulaIds
            ),
        },
      });
    }

    if (
      metodologiaIds.size >
      0
    ) {
      criterios.push({
        metodologiaId: {
          in:
            Array.from(
              metodologiaIds
            ),
        },
      });
    }

    if (
      metodologiaAvulsaIds
        .size > 0
    ) {
      criterios.push({
        metodologiaAvulsaId: {
          in:
            Array.from(
              metodologiaAvulsaIds
            ),
        },
      });
    }

    if (
      criterios.length ===
      0
    ) {
      return res.json({
        items: [],
      });
    }

    const aulas =
      await prisma.aulaAoVivo
        .findMany({
          where: {
            status: {
              not:
                "CANCELADA",
            },

            OR:
              criterios,
          },

          orderBy: {
            dataInicio:
              "desc",
          },

          select: {
            id:
              true,

            titulo:
              true,

            descricao:
              true,

            status:
              true,

            dataInicio:
              true,

            dataFim:
              true,

            iniciouEm:
              true,

            finalizouEm:
              true,

            replayDisponivel:
              true,

            precoAcesso:
              true,

            acessoPago:
              true,

            thumbUrl:
              true,

            duracaoMin:
              true,

            metodologiaId:
              true,

            metodologiaAvulsaId:
              true,

            criadorUsuarioId:
              true,

            criadorUsuario: {
              select: {
                id:
                  true,

                nome:
                  true,

                nomeDeUsuario:
                  true,

                foto:
                  true,
              },
            },

            metodologia: {
              select: {
                titulo:
                  true,

                capaUrl:
                  true,
              },
            },

            metodologiaAvulsa: {
              select: {
                titulo:
                  true,

                capaUrl:
                  true,
              },
            },
          },
        });

    const SETE_DIAS_MS =
      7 *
      24 *
      60 *
      60 *
      1000;

    const items =
      aulas.map((aula) => {
        const finalizacaoRaw =
          aula.finalizouEm ||
          aula.dataFim ||
          null;

        const finalizacao =
          finalizacaoRaw
            ? new Date(
                finalizacaoRaw
              )
            : null;

        const replayExpiraEm =
          finalizacao &&
          !Number.isNaN(
            finalizacao.getTime()
          )
            ? new Date(
                finalizacao.getTime() +
                  SETE_DIAS_MS
              )
            : null;

        const replayExpirado =
          aula.status ===
            "FINALIZADA" &&
          !!replayExpiraEm &&
          replayExpiraEm <=
            agora;

        const acessoDireto =
          aulaIds.has(
            aula.id
          );

        let origemAcesso =
          origemPorAula.get(
            aula.id
          ) || "";

        if (
          !origemAcesso &&
          (
            (
              aula.metodologiaId &&
              metodologiaIds.has(
                aula.metodologiaId
              )
            ) ||
            (
              aula
                .metodologiaAvulsaId &&
              metodologiaAvulsaIds.has(
                aula
                  .metodologiaAvulsaId
              )
            )
          )
        ) {
          origemAcesso =
            "ASSINATURA";
        }

        if (
          !origemAcesso &&
          acessoDireto
        ) {
          origemAcesso =
            "ACESSO";
        }

        return {
          id:
            aula.id,

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
            aula.finalizouEm ||
            aula.dataFim,

          duracaoMin:
            aula.duracaoMin,

          thumbUrl:
            aula.thumbUrl ||
            aula.metodologiaAvulsa
              ?.capaUrl ||
            aula.metodologia
              ?.capaUrl ||
            null,

          replayDisponivel:
            aula
              .replayDisponivel ===
              true &&
            !replayExpirado,

          replayExpiraEm:
            replayExpiraEm
              ?.toISOString() ??
            null,

          replayExpirado,

          segundosRestantes:
            replayExpiraEm
              ? Math.max(
                  0,
                  Math.floor(
                    (
                      replayExpiraEm.getTime() -
                      agora.getTime()
                    ) /
                      1000
                  )
                )
              : null,

          precoAcesso:
            Number(
              aula.precoAcesso ??
                0
            ),

          acessoPago:
            aula.acessoPago ===
              true ||
            Number(
              aula.precoAcesso ??
                0
            ) > 0,

          origemAcesso:
            origemAcesso ||
            "ACESSO",

          criadorUsuario:
            aula.criadorUsuario,

          metodologiaId:
            aula.metodologiaId,

          metodologiaAvulsaId:
            aula
              .metodologiaAvulsaId,

          metodologiaTitulo:
            aula.metodologiaAvulsa
              ?.titulo ||
            aula.metodologia
              ?.titulo ||
            null,
        };
      });

    return res.json({
      items,
    });
  } catch (error: any) {
    console.error(
      "Erro ao listar aulas do Learning:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Erro ao carregar suas aulas ao vivo.",
    });
  }
}

export async function inscreverAulaEvento(req: Request, res: Response) {
  try {
    const aulaId = String(req.params.aulaId || "").trim();
    const aula = await buscarAulaCompleta(aulaId);

    if (!aula) {
      return res.status(404).json({
        message: "Evento ao vivo não encontrado.",
      });
    }

    const validadeReplay =
      calcularValidadeReplay(
        aula
      );

    if (
      aula.status ===
        "FINALIZADA" &&
      validadeReplay
        .replayExpirado
    ) {
      return res.status(410).json({
        code:
          "REPLAY_EXPIRADO",

        message:
          "Este replay não está mais disponível. O prazo de sete dias terminou.",

        replayExpiraEm:
          validadeReplay
            .replayExpiraEm,
      });
    }

    let userId = getUserIdFromOptionalToken(req);
    let usuario: any = null;
    let criadoAgora = false;

    if (userId) {
      usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        include: {
          learningProfile: { select: { id: true } },
          atleta: { select: { id: true } },
          professor: { select: { id: true } },
          clube: { select: { id: true } },
          escolinha: { select: { id: true } },
          administrador: { select: { id: true } },
          federacao: { select: { id: true } },
          marca: { select: { id: true } },
        },
      });
    }

    if (!usuario) {
      const { nome, email, senha } = req.body || {};

      if (!nome || !email) {
        return res.status(400).json({
          message: "Nome e e-mail são obrigatórios.",
        });
      }

      const result = await criarOuBuscarUsuarioLearning({
        nome: String(nome),
        email: String(email),
        senha: String(senha || ""),
      });

      usuario = result.usuario;
      criadoAgora = result.criadoAgora;
      userId = usuario.id;
    }

    const token = assinarToken(usuario);
    const tipoUsuarioId = getTipoUsuarioId(usuario);

    await enviarEmailEventoSeSolicitado({
        receberEmail: req.body?.receberEmail,
        usuario,
        aula,
    });

    return res.status(201).json({
      ok: true,
      message: "Inscrição iniciada.",
      criadoAgora,
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        nomeDeUsuario: usuario.nomeDeUsuario,
        tipoUsuarioId,
      },
      acesso: {
        aulaId: aula.id,
        metodologiaId: aula.metodologiaId,
        metodologiaAvulsaId: aula.metodologiaAvulsaId,
        status: "PENDENTE_PAGAMENTO",
      },
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao inscrever no evento.");
  }
}

export async function comprarAulaEvento(req: Request, res: Response) {
  try {
    const aulaId = String(req.params.aulaId || "").trim();
    const userId = getUserIdFromOptionalToken(req);

    if (!userId) {
      return res.status(401).json({
        message: "Faça login ou crie sua conta para continuar.",
      });
    }

    const aula = await buscarAulaCompleta(aulaId);

    if (!aula) {
      return res.status(404).json({
        message: "Evento ao vivo não encontrado.",
      });
    }

    const validadeReplay =
      calcularValidadeReplay(
        aula
      );

    if (
      aula.status ===
        "FINALIZADA" &&
      validadeReplay
        .replayExpirado
    ) {
      return res.status(410).json({
        code:
          "REPLAY_EXPIRADO",

        message:
          "Este replay expirou e não pode mais ser comprado.",

        replayExpiraEm:
          validadeReplay
            .replayExpiraEm,
      });
    }

    const evento = await montarEventoResponse({ aula, userId });

    if (evento.acesso?.temAcesso) {
      return res.json({
        ok: true,
        message: "Acesso já liberado.",
        acesso: evento.acesso,
      });
    }

    const produtoTipo = evento.acesso?.produtoTipo;
    const planoId = evento.acesso?.planoId;
    const preco = Number(evento.acesso?.preco || 0);

    if (produtoTipo === "METODOLOGIA" || produtoTipo === "METODOLOGIA_AVULSA") {
      return res.status(402).json({
        ok: false,
        message:
          produtoTipo === "METODOLOGIA"
            ? "Para assistir esta aula, você precisa adquirir a metodologia."
            : "Para assistir esta aula, você precisa adquirir a metodologia avulsa.",
        acesso: evento.acesso,
        redirectTo: `/pagamentos?planoId=${encodeURIComponent(
          String(planoId || "")
        )}`,
      });
    }

    if (produtoTipo === "AULA_AO_VIVO" && preco > 0) {
      return res.status(402).json({
        ok: false,
        message: "Para assistir este evento, você precisa pagar o acesso.",
        acesso: evento.acesso,
        redirectTo: `/pagamentos?planoId=${encodeURIComponent(
          String(planoId || "")
        )}`,
      });
    }

    const acessoLiberado = await prisma.aulaAoVivoAcesso.upsert({
      where: {
        aulaAoVivoId_usuarioId: {
          aulaAoVivoId: aula.id,
          usuarioId: userId,
        },
      },
      update: {
        status: "ATIVO",
        origem: "GRATUITO",
        valorPago: 0,
        pagoEm: new Date(),
        expiraEm: null,
      },
      create: {
        aulaAoVivoId: aula.id,
        usuarioId: userId,
        status: "ATIVO",
        origem: "GRATUITO",
        valorPago: 0,
        pagoEm: new Date(),
        expiraEm: null,
      },
    });

    return res.json({
      ok: true,
      message: "Acesso gratuito liberado.",
      acessoLiberado,
      acesso: {
        ...evento.acesso,
        temAcesso: true,
        precisaPagamento: false,
      },
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao liberar acesso.");
  }
}

export async function getSalaCopaPublica(req: Request, res: Response) {
  try {
    const aulaId = String(req.query.aulaId || "").trim();
    const userId = getUserIdFromOptionalToken(req);

    if (!aulaId) {
      return res.json({
        ok: true,
        evento: {
          slug: "sala-copa",
          titulo: "Sala Copa",
          descricao:
            "Encontros ao vivo para quem quer aprender, debater e evoluir no esporte.",
          dataInicio: null,
          dataFim: null,
          status: "AGENDADA",
          thumbUrl: null,
          aulaId: null,
          metodologiaId: null,
          metodologiaAvulsaId: null,
          origem: "AVULSA",
          preco: 49.9,
          criadorUsuario: null,
          acesso: {
            temAcesso: false,
            motivo: "SEM_AULA_VINCULADA",
          },
        },
      });
    }

    const aula = await buscarAulaCompleta(aulaId);

    if (!aula) {
      return res.status(404).json({
        message: "Aula da Sala Copa não encontrada.",
      });
    }

    const evento = await montarEventoResponse({ aula, userId });
    const metodologia = aula.metodologiaAvulsa || aula.metodologia || null;

    return res.json({
        ok: true,
        evento: {
            slug: "sala-copa",
            id: aula.id,
            aulaId: aula.id,
            titulo: aula.titulo || metodologia?.titulo || "Sala Copa",
            descricao:
            aula.descricao ||
            metodologia?.descricao ||
            "Encontros ao vivo para quem quer aprender, debater e evoluir no esporte.",
            dataInicio: aula.dataInicio || null,
            dataFim: aula.dataFim || null,
            inscricaoInicio: aula.inscricaoInicio || null,
            inscricaoFim: aula.inscricaoFim || null,
            status: aula.status || "AGENDADA",
            thumbUrl: aula.thumbUrl || metodologia?.capaUrl || null,
            urlStream:
              evento.acesso?.temAcesso
                ? evento.urlStream ?? null
                : null,

            videoGravadoUrl:
              evento.acesso?.temAcesso
                ? evento.videoGravadoUrl ??
                  null
                : null,
            replayDisponivel: aula.replayDisponivel ?? false,
            chatAtivo: aula.chatAtivo ?? true,
            gravacaoAtiva: aula.gravacaoAtiva ?? true,
            metodologiaId: aula.metodologiaId || null,
            metodologiaAvulsaId: aula.metodologiaAvulsaId || null,
            origem: aula.metodologiaAvulsaId ? "AVULSA" : "LEARNING",
            metodologiaTitulo: metodologia?.titulo || null,
            metodologiaDescricao: metodologia?.descricao || null,
            metodologiaCapaUrl: metodologia?.capaUrl || null,
            preco: Number(evento?.acesso?.preco ?? 0),
            criadorUsuario:
              evento.criadorUsuario ||
              null,
            temConvidado: evento.temConvidado,
            pessoaDestaqueLabel: evento.pessoaDestaqueLabel,
            pessoaDestaqueNome: evento.pessoaDestaqueNome,
            pessoaDestaqueDescricao: evento.pessoaDestaqueDescricao,

            convidados: evento.convidados || [],
            convidadoUsuario: evento.convidadoUsuario || null,
            convidadoNome: evento.convidadoNome || null,
            convidadoDescricao: evento.convidadoDescricao || null,

            isOwner: evento.isOwner,
            acesso: evento.acesso,
        },
        });
  } catch (e: any) {
    return sendError(res, e, "Erro ao carregar evento Sala Copa.");
  }
}

export async function inscreverSalaCopa(req: Request, res: Response) {
  try {
    const aulaId = String(req.body?.aulaId || "").trim();

    if (aulaId) {
      req.params.aulaId = aulaId;
      return inscreverAulaEvento(req, res);
    }

    let userId = getUserIdFromOptionalToken(req);
    let usuario: any = null;
    let criadoAgora = false;

    if (userId) {
      usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        include: {
          learningProfile: { select: { id: true } },
          atleta: { select: { id: true } },
          professor: { select: { id: true } },
          clube: { select: { id: true } },
          escolinha: { select: { id: true } },
          administrador: { select: { id: true } },
          federacao: { select: { id: true } },
          marca: { select: { id: true } },
        },
      });
    }

    if (!usuario) {
      const { nome, email, senha } = req.body || {};

      if (!nome || !email) {
        return res.status(400).json({
          message: "Nome e e-mail são obrigatórios.",
        });
      }

      const result = await criarOuBuscarUsuarioLearning({
        nome: String(nome),
        email: String(email),
        senha: String(senha || ""),
      });

      usuario = result.usuario;
      criadoAgora = result.criadoAgora;
      userId = usuario.id;
    }

    const token = assinarToken(usuario);
    const tipoUsuarioId = getTipoUsuarioId(usuario);

    return res.status(201).json({
      ok: true,
      message: "Inscrição iniciada.",
      criadoAgora,
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        nomeDeUsuario: usuario.nomeDeUsuario,
        tipoUsuarioId,
      },
      acesso: {
        aulaId: null,
        metodologiaId: req.body?.metodologiaId || null,
        metodologiaAvulsaId: req.body?.metodologiaAvulsaId || null,
        status: "PENDENTE_PAGAMENTO",
      },
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao inscrever no evento.");
  }
}

export async function comprarSalaCopa(req: Request, res: Response) {
  try {
    const aulaId = String(req.body?.aulaId || "").trim();

    if (aulaId) {
      req.params.aulaId = aulaId;
      return comprarAulaEvento(req, res);
    }

    const userId = getUserIdFromOptionalToken(req);

    if (!userId) {
      return res.status(401).json({
        message: "Faça login ou crie sua conta para comprar o acesso.",
      });
    }

    const metodologiaId = String(req.body?.metodologiaId || "").trim();
    const metodologiaAvulsaId = String(req.body?.metodologiaAvulsaId || "").trim();

    if (!metodologiaId && !metodologiaAvulsaId) {
      return res.status(400).json({
        message: "Informe a aulaId, metodologiaId ou metodologiaAvulsaId.",
      });
    }

    if (metodologiaId) {
      const planoId =
        `METODOLOGIA:${metodologiaId}`;

      return res.status(402).json({
        ok: false,

        message:
          "Para acessar este conteúdo, assine o plano Learning.",

        redirectTo:
          `/pagamentos?planoId=${encodeURIComponent(
            planoId
          )}`,
      });
    }

    const produto =
      await prisma
        .metodologiaAvulsa
        .findUnique({
          where: {
            id:
              metodologiaAvulsaId,
          },

          select: {
            id: true,
            precoAssinaturaMensal:
              true,
          },
        });

    if (!produto) {
      return res.status(404).json({
        message:
          "Metodologia não encontrada.",
      });
    }

    const preco =
      Number(
        produto
          .precoAssinaturaMensal ??
          0
      );

    const planoId =
      `METODOLOGIA_AVULSA:${metodologiaAvulsaId}`;

    if (preco > 0) {
      return res.status(402).json({
        ok: false,
        message:
          "Para acessar este conteúdo, conclua o pagamento.",
        preco,
        redirectTo:
          `/pagamentos?planoId=${encodeURIComponent(
            planoId
          )}`,
      });
    }

    const acessoLiberado =
      await criarAcessoMetodologia({
        usuarioId: userId,
        metodologiaId:
          metodologiaId ||
          null,
        metodologiaAvulsaId:
          metodologiaAvulsaId ||
          null,
      });

    return res.json({
      ok: true,
      message:
        "Acesso gratuito liberado.",
      acessoLiberado,
      acesso: {
        aulaId: null,
        metodologiaId:
          metodologiaId ||
          null,
        metodologiaAvulsaId:
          metodologiaAvulsaId ||
          null,
        status:
          "CONFIRMADO",
      },
    });
  } catch (e: any) {
    return sendError(res, e, "Erro ao liberar acesso.");
  }
}

async function buscarAcessoAulaAvulsa(params: {
  usuarioId: string;
  aulaAoVivoId: string;
}) {
  if (!params.usuarioId || !params.aulaAoVivoId) return null;

  return prisma.aulaAoVivoAcesso.findFirst({
    where: {
      usuarioId: params.usuarioId,
      aulaAoVivoId: params.aulaAoVivoId,
      status: "ATIVO",
    },
  });
}