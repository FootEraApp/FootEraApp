import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcryptjs";
import {
  AuthProvider,
  TipoUsuario,
  StatusResponsavelAtleta,
} from "@prisma/client";
import { getIO } from "../socket.js";
import {
  normalizarVisibilidadePerfil,
  readPrivacyConfig,
} from "../utils/privacy.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  obterSupervisaoMenor,
} from "../services/supervisaoMenor.js";
import {
  audit,
} from "../services/audit.js";

function getUserId(req: Request): string | null {
  const r: any = req;
  return r.userId || r.user?.id || r.usuarioId || null;
}

function calcularIdade(
  dataNascimento:
    | Date
    | string
    | null
    | undefined
) {
  if (!dataNascimento) {
    return null;
  }

  const nascimento =
    new Date(
      dataNascimento
    );

  if (
    Number.isNaN(
      nascimento.getTime()
    )
  ) {
    return null;
  }

  const hoje =
    new Date();

  let idade =
    hoje.getFullYear() -
    nascimento.getFullYear();

  const mes =
    hoje.getMonth() -
    nascimento.getMonth();

  if (
    mes < 0 ||
    (
      mes === 0 &&
      hoje.getDate() <
        nascimento.getDate()
    )
  ) {
    idade--;
  }

  return idade;
}

async function obterSupervisaoUsuario(
  usuarioId: string
) {
  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id:
          usuarioId,
      },

      select: {
        dataNascimento:
          true,

        atleta: {
          select: {
            id: true,

            responsaveis: {
              where: {
                status:
                  StatusResponsavelAtleta.ATIVO,
              },

              orderBy: [
                {
                  principal:
                    "desc",
                },

                {
                  criadoEm:
                    "asc",
                },
              ],

              select: {
                id: true,

                responsavelUsuarioId:
                  true,

                principal:
                  true,

                permitirPerfilPublico:
                  true,

                permitirMensagensDiretas:
                  true,

                permitirMostrarEmail:
                  true,
              },
            },
          },
        },
      },
    });

  if (
    !usuario ||
    !usuario.atleta
  ) {
    return {
      supervisionado:
        false,

      atletaId:
        null,

      responsavelUsuarioId:
        null,

      permitirPerfilPublico:
        true,

      permitirMensagensDiretas:
        true,

      permitirMostrarEmail:
        true,
    };
  }

  const idade =
    calcularIdade(
      usuario.dataNascimento
    );

  /*
   * Nesta etapa a regra
   * continua sendo apenas
   * para menores de 12.
   */
  if (
    idade === null ||
    idade >= 12
  ) {
    return {
      supervisionado:
        false,

      atletaId:
        usuario.atleta.id,

      responsavelUsuarioId:
        null,

      permitirPerfilPublico:
        true,

      permitirMensagensDiretas:
        true,

      permitirMostrarEmail:
        true,
    };
  }

  /*
   * Se existir mais de um responsável,
   * damos preferência ao principal.
   */
  const responsavel =
    usuario.atleta
      .responsaveis[0] ??
    null;

  return {
    supervisionado:
      true,

    atletaId:
      usuario.atleta.id,

    responsavelUsuarioId:
      responsavel
        ?.responsavelUsuarioId ??
      null,

    /*
     * Menor sem responsável ativo
     * continua com regras seguras.
     */
    permitirPerfilPublico:
      responsavel
        ?.permitirPerfilPublico ??
      false,

    permitirMensagensDiretas:
      responsavel
        ?.permitirMensagensDiretas ??
      false,

    permitirMostrarEmail:
      responsavel
        ?.permitirMostrarEmail ??
      false,
  };
}

export async function getPrivacidade(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesPrivacidade: true },
    });

    const raw: any =
      u?.configuracoesPrivacidade && typeof u.configuracoesPrivacidade === "object"
        ? u.configuracoesPrivacidade
        : {};

    const privacidade =
      readPrivacyConfig(
        raw
      );

    const supervisao =
      await obterSupervisaoUsuario(
        userId
      );

    return res.json({
      ...privacidade,

      supervisao,
    });
  } catch (err) {
    console.error("getPrivacidade erro:", err);
    return res.status(500).json({ message: "Erro ao carregar privacidade." });
  }
}

export async function patchPrivacidade(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const {
      perfilVisivel,
      visibilidadePerfil,
      permitirMensagens,
      mostrarEmail,
      mostrarOnline,
    } = (req.body || {}) as any;

    const visibilidadeNormalizada =
      visibilidadePerfil === undefined
        ? undefined
        : normalizarVisibilidadePerfil(
            visibilidadePerfil
          );

    const perfilVisivelCompat =
      visibilidadeNormalizada !==
      undefined
        ? visibilidadeNormalizada !==
          "PRIVADO"
        : typeof perfilVisivel ===
          "boolean"
        ? perfilVisivel
        : undefined;

    if (
      visibilidadePerfil !==
        undefined &&
      !visibilidadeNormalizada
    ) {
      return res.status(400).json({
        message:
          "visibilidadePerfil deve ser PUBLICO, NAO_LISTADO ou PRIVADO.",
      });
    }

    const supervisao =
      await obterSupervisaoUsuario(
        userId
      );

    if (
      supervisao.supervisionado
    ) {
      if (
        visibilidadeNormalizada ===
          "PUBLICO" &&
        !supervisao
          .permitirPerfilPublico
      ) {
        return res
          .status(409)
          .json({
            code:
              "RESPONSAVEL_APPROVAL_REQUIRED",

            campo:
              "visibilidadePerfil",

            message:
              "Seu responsável precisa liberar o perfil público.",
          });
      }

      if (
        permitirMensagens ===
          true &&
        !supervisao
          .permitirMensagensDiretas
      ) {
        return res
          .status(409)
          .json({
            code:
              "RESPONSAVEL_APPROVAL_REQUIRED",

            campo:
              "permitirMensagens",

            message:
              "Seu responsável precisa liberar mensagens diretas.",
          });
      }

      if (
        mostrarEmail ===
          true &&
        !supervisao
          .permitirMostrarEmail
      ) {
        return res
          .status(409)
          .json({
            code:
              "RESPONSAVEL_APPROVAL_REQUIRED",

            campo:
              "mostrarEmail",

            message:
              "Seu responsável precisa liberar a exibição do e-mail.",
          });
      }
    }

    const next = {
      perfilVisivel:
        perfilVisivelCompat,

      visibilidadePerfil:
        visibilidadeNormalizada,

      permitirMensagens:
        typeof permitirMensagens ===
        "boolean"
          ? permitirMensagens
          : undefined,

      mostrarEmail:
        typeof mostrarEmail ===
        "boolean"
          ? mostrarEmail
          : undefined,

      mostrarOnline:
        typeof mostrarOnline ===
        "boolean"
          ? mostrarOnline
          : undefined,
    };

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesPrivacidade: true },
    });

    const current: any =
      u?.configuracoesPrivacidade && typeof u.configuracoesPrivacidade === "object"
        ? u.configuracoesPrivacidade
        : {};

    const merged = {
      ...current,
      ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)),
    };

    await prisma.usuario.update({
      where: { id: userId },
      data: { configuracoesPrivacidade: merged as any },
    });

    await audit(
      req,
      {
        acao:
          "PRIVACIDADE_ATUALIZADA",

        entidade:
          "Usuario",

        entidadeId:
          userId,

        descricao:
          "Usuário atualizou configurações de privacidade.",

        meta: {
          camposAlterados:
            Object.keys(
              next
            ).filter(
              (campo) =>
                next[
                  campo as keyof typeof next
                ] !== undefined
            ),

          supervisionado:
            supervisao
              .supervisionado,
        },
      }
    );

    if (
      typeof mostrarOnline === "boolean" &&
      mostrarOnline === false
    ) {
      try {
        const io = getIO();

        io?.emit("presence:update", {
          userId,
          online: false,
          lastSeenAt: null,
          lastLogoutAt: null,
          hidden: true,
        });
      } catch {}
    }

    return res.json(
      readPrivacyConfig(merged)
    );
  } catch (err) {
    console.error("patchPrivacidade erro:", err);
    return res.status(500).json({ message: "Erro ao salvar privacidade." });
  }
}

async function obterVinculoPrivacidadeResponsavel(
  req: Request,
  atletaId: string
) {
  const responsavelUsuarioId =
    getUserId(req);

  if (
    !responsavelUsuarioId
  ) {
    return null;
  }

  const contexto =
    await getActiveContext(
      responsavelUsuarioId
    );

  if (
    contexto?.kind !==
      "PERSONAL" ||
    contexto.tipoUsuario !==
      TipoUsuario.Responsavel
  ) {
    return null;
  }

  const vinculo =
    await prisma
      .responsavelAtleta
      .findUnique({
        where: {
          responsavelUsuarioId_atletaId:
            {
              responsavelUsuarioId,

              atletaId,
            },
        },

        include: {
          atleta: {
            select: {
              id: true,

              usuarioId:
                true,

              usuario: {
                select: {
                  id: true,

                  nome: true,

                  nomeDeUsuario:
                    true,

                  configuracoesPrivacidade:
                    true,
                },
              },
            },
          },
        },
      });

  if (
    !vinculo ||
    vinculo.status !==
      StatusResponsavelAtleta.ATIVO ||
    vinculo
      .podeGerenciarPrivacidade !==
      true
  ) {
    return null;
  }

  return vinculo;
}

export async function getPrivacidadeAtletaGerenciado(
  req: Request,
  res: Response
) {
  try {
    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    if (!atletaId) {
      return res
        .status(400)
        .json({
          message:
            "atletaId é obrigatório.",
        });
    }

    const vinculo =
      await obterVinculoPrivacidadeResponsavel(
        req,
        atletaId
      );

    if (!vinculo) {
      return res
        .status(403)
        .json({
          code:
            "ATLETA_ACCESS_DENIED",

          message:
            "Você não possui permissão para gerenciar a privacidade deste atleta.",
        });
    }

    const raw =
      vinculo.atleta
        .usuario
        .configuracoesPrivacidade;

    return res.json({
      atleta: {
        id:
          vinculo.atleta.id,

        usuarioId:
          vinculo.atleta
            .usuarioId,

        nome:
          vinculo.atleta
            .usuario.nome,

        nomeDeUsuario:
          vinculo.atleta
            .usuario
            .nomeDeUsuario,
      },

      privacidade:
        readPrivacyConfig(
          raw
        ),

      supervisao: {
        permitirPerfilPublico:
          vinculo
            .permitirPerfilPublico,

        permitirMensagensDiretas:
          vinculo
            .permitirMensagensDiretas,

        permitirMostrarEmail:
          vinculo
            .permitirMostrarEmail,
      },
    });
  } catch (error) {
    console.error(
      "getPrivacidadeAtletaGerenciado",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Erro ao carregar a supervisão do atleta.",
      });
  }
}

export async function patchPrivacidadeAtletaGerenciado(
  req: Request,
  res: Response
) {
  try {
    const atletaId =
      String(
        req.params.atletaId ??
        ""
      ).trim();

    const vinculo =
      await obterVinculoPrivacidadeResponsavel(
        req,
        atletaId
      );

    if (!vinculo) {
      return res
        .status(403)
        .json({
          code:
            "ATLETA_ACCESS_DENIED",

          message:
            "Você não possui permissão para gerenciar a privacidade deste atleta.",
        });
    }

    const {
      permitirPerfilPublico,
      permitirMensagensDiretas,
      permitirMostrarEmail,
    } =
      (req.body ??
        {}) as {
        permitirPerfilPublico?:
          boolean;

        permitirMensagensDiretas?:
          boolean;

        permitirMostrarEmail?:
          boolean;
      };

    const atualizado =
      await prisma
        .responsavelAtleta
        .update({
          where: {
            id:
              vinculo.id,
          },

          data: {
            ...(typeof permitirPerfilPublico ===
            "boolean"
              ? {
                  permitirPerfilPublico,
                }
              : {}),

            ...(typeof permitirMensagensDiretas ===
            "boolean"
              ? {
                  permitirMensagensDiretas,
                }
              : {}),

            ...(typeof permitirMostrarEmail ===
            "boolean"
              ? {
                  permitirMostrarEmail,
                }
              : {}),
          },
        });

    /*
     * Ao retirar uma permissão,
     * também corrigimos imediatamente
     * a configuração da criança.
     */
    const atual =
      readPrivacyConfig(
        vinculo.atleta
          .usuario
          .configuracoesPrivacidade
      );

    const novaPrivacidade:
      Record<
        string,
        unknown
      > = {
      ...atual,
    };

    if (
      permitirPerfilPublico ===
        false &&
      atual.visibilidadePerfil ===
        "PUBLICO"
    ) {
      novaPrivacidade.visibilidadePerfil =
        "PRIVADO";

      novaPrivacidade.perfilVisivel =
        false;
    }

    if (
      permitirMensagensDiretas ===
      false
    ) {
      novaPrivacidade.permitirMensagens =
        false;
    }

    if (
      permitirMostrarEmail ===
      false
    ) {
      novaPrivacidade.mostrarEmail =
        false;
    }

    await prisma.usuario.update({
      where: {
        id:
          vinculo.atleta
            .usuarioId,
      },

      data: {
        configuracoesPrivacidade:
          novaPrivacidade as any,
      },
    });

    await audit(
      req,
      {
        acao:
          "RESPONSAVEL_ATUALIZOU_PRIVACIDADE_ATLETA",

        entidade:
          "ResponsavelAtleta",

        entidadeId:
          vinculo.id,

        descricao:
          "Responsável atualizou permissões de privacidade de atleta supervisionado.",

        meta: {
          atletaId,

          atletaUsuarioId:
            vinculo.atleta
              .usuarioId,

          camposAlterados: [
            typeof permitirPerfilPublico ===
            "boolean"
              ? "permitirPerfilPublico"
              : null,

            typeof permitirMensagensDiretas ===
            "boolean"
              ? "permitirMensagensDiretas"
              : null,

            typeof permitirMostrarEmail ===
            "boolean"
              ? "permitirMostrarEmail"
              : null,
          ].filter(Boolean),
        },
      }
    );

    return res.json({
      ok: true,

      supervisao: {
        permitirPerfilPublico:
          atualizado
            .permitirPerfilPublico,

        permitirMensagensDiretas:
          atualizado
            .permitirMensagensDiretas,

        permitirMostrarEmail:
          atualizado
            .permitirMostrarEmail,
      },

      privacidade:
        readPrivacyConfig(
          novaPrivacidade
        ),
    });
  } catch (error) {
    console.error(
      "patchPrivacidadeAtletaGerenciado",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Erro ao atualizar a supervisão do atleta.",
      });
  }
}

export async function getNotificacoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesNotificacoes: true },
    });

    const raw: any = u?.configuracoesNotificacoes || {};
    return res.json({
      notifMensagens: raw.notifMensagens ?? true,
      notifTreinos: raw.notifTreinos ?? true,
      notifEventos: raw.notifEventos ?? true,
      notifMarketing: raw.notifMarketing ?? false,
    });
  } catch (err) {
    console.error("getNotificacoes erro:", err);
    return res.status(500).json({ message: "Erro ao carregar notificações." });
  }
}

export async function patchNotificacoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const { notifMensagens, notifTreinos, notifEventos, notifMarketing } = (req.body || {}) as any;

    const next = {
      notifMensagens: typeof notifMensagens === "boolean" ? notifMensagens : undefined,
      notifTreinos: typeof notifTreinos === "boolean" ? notifTreinos : undefined,
      notifEventos: typeof notifEventos === "boolean" ? notifEventos : undefined,
      notifMarketing: typeof notifMarketing === "boolean" ? notifMarketing : undefined,
    };

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { configuracoesNotificacoes: true },
    });

    const current: any = u?.configuracoesNotificacoes || {};
    const merged = {
      ...current,
      ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)),
    };

    await prisma.usuario.update({
      where: { id: userId },
      data: { configuracoesNotificacoes: merged as any },
    });

    return res.json({
      notifMensagens: merged.notifMensagens ?? true,
      notifTreinos: merged.notifTreinos ?? true,
      notifEventos: merged.notifEventos ?? true,
      notifMarketing: merged.notifMarketing ?? false,
    });
  } catch (err) {
    console.error("patchNotificacoes erro:", err);
    return res.status(500).json({ message: "Erro ao salvar notificações." });
  }
}

export async function trocarSenha(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const supervisao =
      await obterSupervisaoMenor(
        userId
      );

    if (
      supervisao.supervisionado
    ) {
      return res
        .status(403)
        .json({
          code:
            "GUARDIAN_APPROVAL_REQUIRED_FOR_PASSWORD_CHANGE",

          message:
            "A alteração de senha desta conta precisa ser confirmada pelo responsável.",
        });
    }

    const { senhaAtual, senhaNova } = (req.body || {}) as {
      senhaAtual?: string;
      senhaNova?: string;
    };

    if (!senhaAtual || !senhaNova || senhaNova.length < 8) {
      return res.status(400).json({ message: "Informe senhaAtual e senhaNova (mín 8 chars)." });
    }

    if (senhaAtual === senhaNova) {
      return res.status(400).json({ message: "A senha nova não pode ser igual à senha atual." });
    }
    
    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { senhaHash: true, tokenVersion: true },
    });

    if (!u) return res.status(404).json({ message: "Usuário não encontrado." });

    const ok = await bcrypt.compare(senhaAtual, u.senhaHash);
    if (!ok) return res.status(400).json({ message: "Senha atual inválida." });

    const novoHash = await bcrypt.hash(senhaNova, 10);

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        senhaHash: novoHash,
        tokenVersion: (u.tokenVersion ?? 0) + 1,
        lastLogoutAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    await audit(
      req,
      {
        acao:
          "SENHA_ALTERADA",

        entidade:
          "Usuario",

        entidadeId:
          userId,

        descricao:
          "Usuário alterou a própria senha.",
      }
    );

    return res.json({ ok: true, message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("trocarSenha erro:", err);
    return res.status(500).json({ message: "Erro ao trocar senha." });
  }
}

export async function encerrarSessoes(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const u = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    const now = new Date();

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        tokenVersion: (u?.tokenVersion ?? 0) + 1,
        lastLogoutAt: now,                        
        lastSeenAt: now,                          
      },
    });

    return res.json({ ok: true, message: "Sessões encerradas. Faça login novamente." });
  } catch (err) {
    console.error("encerrarSessoes erro:", err);
    return res.status(500).json({ message: "Erro ao encerrar sessões." });
  }
}

export async function getGoogleStatus(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        googleSub: true,
        googleEmail: true,
        googlePicture: true,
        googleLinkedAt: true,
        authProvider: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    return res.json({
      linked: !!usuario.googleSub,
      googleEmail: usuario.googleEmail ?? null,
      googlePicture: usuario.googlePicture ?? null,
      googleLinkedAt: usuario.googleLinkedAt ?? null,
      authProvider: usuario.authProvider,
    });
  } catch (err) {
    console.error("getGoogleStatus erro:", err);
    return res.status(500).json({ message: "Erro ao carregar status do Google." });
  }
}

export async function unlinkGoogle(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Não autenticado." });

    const supervisao =
      await obterSupervisaoMenor(
        userId
      );

    if (
      supervisao.supervisionado
    ) {
      return res
        .status(403)
        .json({
          code:
            "GUARDIAN_APPROVAL_REQUIRED_FOR_GOOGLE_UNLINK",

          message:
            "A desvinculação da conta Google precisa ser confirmada pelo responsável.",
        });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleSub: true,
        authProvider: true,
        localLoginEnabled: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    if (!usuario.googleSub) {
      return res.status(400).json({ message: "Sua conta não está vinculada ao Google." });
    }

    if (!usuario.localLoginEnabled) {
      return res.status(409).json({
        ok: false,
        code: "LAST_AUTH_METHOD",
        message:
          "Antes de desvincular o Google, crie uma senha FootEra em 'Esqueci minha senha'. Assim você não perde o acesso à conta.",
      });
    }

    const novoProvider =
      usuario.authProvider === AuthProvider.LOCAL_GOOGLE
        ? AuthProvider.LOCAL
        : AuthProvider.LOCAL;

    const agora =
      new Date();

    await prisma.usuario.update({
      where: {
        id:
          userId,
      },

      data: {
        googleSub:
          null,

        googleEmail:
          null,

        googlePicture:
          null,

        googleLinkedAt:
          null,

        authProvider:
          novoProvider,

        /*
        * Alteração de método de
        * autenticação é ação sensível:
        * encerra todas as sessões.
        */
        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          agora,

        lastSeenAt:
          agora,
      },
    });

    await audit(
      req,
      {
        acao:
          "GOOGLE_DESVINCULADO",

        entidade:
          "Usuario",

        entidadeId:
          userId,

        descricao:
          "Usuário removeu o vínculo Google da própria conta.",
      }
    );

    return res.json({
      ok:
        true,

      reloginRequired:
        true,

      message:
        "Conta Google desvinculada com sucesso. Faça login novamente.",
    });
  } catch (err) {
    console.error("unlinkGoogle erro:", err);
    return res.status(500).json({ message: "Erro ao desvincular conta Google." });
  }
}