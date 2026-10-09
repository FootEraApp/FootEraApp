import {
  Request,
  Response,
} from "express";
import {
  StatusResponsavelAtleta,
} from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  activateScheduledMaintenanceIfDue,
} from "../services/maintenanceScheduler.js";
import {
  audit,
} from "../services/audit.js";

const REQUIRED_PHRASE = "Excluir Conta Footera";

function calcularIdadeUsuario(
  nascimento:
    | Date
    | string
    | null
    | undefined
) {
  if (!nascimento) {
    return null;
  }

  const data =
    new Date(
      nascimento
    );

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return null;
  }

  const hoje =
    new Date();

  let idade =
    hoje.getFullYear() -
    data.getFullYear();

  const aindaNaoFez =
    hoje.getMonth() <
      data.getMonth() ||
    (
      hoje.getMonth() ===
        data.getMonth() &&
      hoje.getDate() <
        data.getDate()
    );

  if (
    aindaNaoFez
  ) {
    idade--;
  }

  return Math.max(
    0,
    idade
  );
}

export const getConfiguracoes = async (
  req: Request,
  res: Response
) => {
  try {
    await activateScheduledMaintenanceIfDue();

    let config = await prisma.configuracaoSistema.findFirst();

    if (!config) {
      config = await prisma.configuracaoSistema.create({
        data: {
          registrationEnabled: true,
          maintenanceMode: false,
          maintenanceScheduledAt: null,
          allowAthleteChallenges: true,
          allowProfileEditing: true,
          maxDailyPosts: 5,
        },
      });
    }

    return res.json({
      ...config,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[configurações] erro ao buscar:", err);

    return res.status(500).json({
      message: "Erro ao buscar configurações",
    });
  }
};

export const atualizarConfiguracoes = async (
  req: Request,
  res: Response
) => {
  try {
    const config = await prisma.configuracaoSistema.findFirst();

    if (!config) {
      return res.status(404).json({
        message: "Configuração não encontrada",
      });
    }

    const {
      registrationEnabled,
      maintenanceMode,
      maintenanceScheduledAt,
      maintenanceDelayMinutes,
      allowAthleteChallenges,
      allowProfileEditing,
      maxDailyPosts,
    } = req.body ?? {};

    const data: {
      registrationEnabled?: boolean;
      maintenanceMode?: boolean;
      maintenanceScheduledAt?: Date | null;
      allowAthleteChallenges?: boolean;
      allowProfileEditing?: boolean;
      maxDailyPosts?: number;
    } = {};

    if (typeof registrationEnabled === "boolean") {
      data.registrationEnabled = registrationEnabled;
    }

    if (typeof allowAthleteChallenges === "boolean") {
      data.allowAthleteChallenges = allowAthleteChallenges;
    }

    if (typeof allowProfileEditing === "boolean") {
      data.allowProfileEditing = allowProfileEditing;
    }

    if (
      typeof maxDailyPosts === "number" &&
      Number.isInteger(maxDailyPosts) &&
      maxDailyPosts >= 0
    ) {
      data.maxDailyPosts = maxDailyPosts;
    }

    if (typeof maintenanceMode === "boolean") {
      data.maintenanceMode = maintenanceMode;

      if (maintenanceMode) {
        data.maintenanceScheduledAt = null;
      }
    }

    if (maintenanceDelayMinutes !== undefined) {
      if (
        typeof maintenanceDelayMinutes !== "number" ||
        !Number.isInteger(maintenanceDelayMinutes) ||
        maintenanceDelayMinutes < 1 ||
        maintenanceDelayMinutes > 10_080
      ) {
        return res.status(400).json({
          message: "O tempo deve estar entre 1 minuto e 7 dias.",
        });
      }

      data.maintenanceMode = false;
      data.maintenanceScheduledAt = new Date(
        Date.now() + maintenanceDelayMinutes * 60_000
      );
    } else if (maintenanceScheduledAt !== undefined) {
      if (maintenanceScheduledAt === null || maintenanceScheduledAt === "") {
        data.maintenanceScheduledAt = null;
      } else {
        const scheduledDate = new Date(maintenanceScheduledAt);

        if (Number.isNaN(scheduledDate.getTime())) {
          return res.status(400).json({
            message: "Data de manutenção inválida.",
          });
        }

        if (scheduledDate.getTime() <= Date.now()) {
          data.maintenanceMode = true;
          data.maintenanceScheduledAt = null;
        } else {
          data.maintenanceMode = false;
          data.maintenanceScheduledAt = scheduledDate;
        }
      }
    }

    const atualizada = await prisma.configuracaoSistema.update({
      where: {
        id: config.id,
      },
      data,
    });

    return res.json({
      ...atualizada,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[configurações] erro ao atualizar:", err);

    return res.status(500).json({
      message: "Erro ao atualizar configurações",
    });
  }
};

export async function solicitarExclusaoConta(
  req: Request,
  res: Response
) {
  try {
    const userId =
      req.userId;

    const {
      confirm,
    } =
      req.body ??
      {};

    if (!userId) {
      return res
        .status(401)
        .json({
          message:
            "Não autenticado.",
        });
    }

    if (
      String(
        confirm ?? ""
      ).trim() !==
      REQUIRED_PHRASE
    ) {
      return res
        .status(400)
        .json({
          message:
            `Digite exatamente "${REQUIRED_PHRASE}".`,
        });
    }

    /*
     * Verifica se esta conta é de
     * atleta menor supervisionado.
     */
    const usuario =
      await prisma.usuario.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          id: true,

          dataNascimento:
            true,

          atleta: {
            select: {
              id: true,

              idade: true,

              responsaveis: {
                where: {
                  status:
                    StatusResponsavelAtleta.ATIVO,
                },

                select: {
                  id: true,
                },

                take: 1,
              },
            },
          },
        },
      });

    if (!usuario) {
      return res
        .status(404)
        .json({
          message:
            "Usuário não encontrado.",
        });
    }

    if (
      usuario.atleta
    ) {
      const idade =
        calcularIdadeUsuario(
          usuario
            .dataNascimento
        ) ??
        usuario
          .atleta
          .idade ??
        null;

      const possuiResponsavelAtivo =
        usuario
          .atleta
          .responsaveis
          .length >
        0;

      /*
       * Menor de 12 com responsável:
       * a própria criança não pode
       * excluir a conta.
       */
      if (
        idade !== null &&
        idade < 12 &&
        possuiResponsavelAtivo
      ) {
        return res
          .status(403)
          .json({
            code:
              "GUARDIAN_REQUIRED_FOR_ACCOUNT_DELETE",

            message:
              "Sua conta é supervisionada. A exclusão deve ser solicitada pelo responsável.",
          });
      }
    }

    const now =
      new Date();

    const in30 =
      new Date(
        now.getTime() +
        30 *
          24 *
          60 *
          60 *
          1000
      );

    await prisma.usuario.update({
      where: {
        id:
          userId,
      },

      data: {
        deletedAt:
          now,

        deleteScheduledAt:
          in30,

        tokenVersion: {
          increment:
            1,
        },

        lastLogoutAt:
          now,
      },
    });

    await audit(
      req,
      {
        acao:
          "CONTA_MOVIDA_PARA_LIXEIRA",

        entidade:
          "Usuario",

        entidadeId:
          userId,

        descricao:
          "Usuário solicitou exclusão da própria conta.",

        meta: {
          deleteScheduledAt:
            in30.toISOString(),
        },
      }
    );

    return res
      .status(200)
      .json({
        message:
          "Conta movida para lixeira. Você tem 30 dias para reativar antes da exclusão definitiva.",

        deleteScheduledAt:
          in30,
      });
  } catch (error) {
    console.error(
      "[configurações] erro ao solicitar exclusão da conta:",
      error
    );

    return res
      .status(500)
      .json({
        message:
          "Não foi possível solicitar a exclusão da conta.",
      });
  }
}