import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

type OrgTipo = "Escolinha" | "Clube";

type OrgOut = {
  id: string;
  nome: string;
  tipo: OrgTipo;
  usuarioId: string | null;
  logo: string | null;
  foto: string | null;
};

async function listOrganizacoes(
  req: express.Request,
  res: express.Response
) {
  try {
    const tipos = String(req.query.tipos ?? "");

    const vinculadasAoProfessorId =
      req.query.vinculadasAoProfessorId as string | undefined;

    if (vinculadasAoProfessorId) {
      const rel = await prisma.relacaoTreinamento.findFirst({
        where: {
          professorId: vinculadasAoProfessorId,
          atletaId: null,

          OR: [
            {
              escolinhaId: {
                not: null,
              },
            },
            {
              clubeId: {
                not: null,
              },
            },
          ],
        },

        orderBy: {
          criadoEm: "desc",
        },

        select: {
          escolinhaId: true,
          clubeId: true,
        },
      });

      if (!rel) {
        return res.json([]);
      }

      if (rel.escolinhaId) {
        const o = await prisma.escolinha.findUnique({
          where: {
            id: rel.escolinhaId,
          },

          select: {
            id: true,
            nome: true,
            usuarioId: true,
            logo: true,

            usuario: {
              select: {
                foto: true,
              },
            },
          },
        });

        return res.json(
          o
            ? [
                {
                  id: o.id,
                  nome: o.nome,
                  usuarioId: o.usuarioId,
                  tipo: "Escolinha",

                  logo:
                    o.logo ??
                    o.usuario?.foto ??
                    null,

                  foto:
                    o.logo ??
                    o.usuario?.foto ??
                    null,
                } satisfies OrgOut,
              ]
            : []
        );
      }

      if (rel.clubeId) {
        const o = await prisma.clube.findUnique({
          where: {
            id: rel.clubeId,
          },

          select: {
            id: true,
            nome: true,
            usuarioId: true,
            logo: true,

            usuario: {
              select: {
                foto: true,
              },
            },
          },
        });

        return res.json(
          o
            ? [
                {
                  id: o.id,
                  nome: o.nome,
                  usuarioId: o.usuarioId,
                  tipo: "Clube",

                  logo:
                    o.logo ??
                    o.usuario?.foto ??
                    null,

                  foto:
                    o.logo ??
                    o.usuario?.foto ??
                    null,
                } satisfies OrgOut,
              ]
            : []
        );
      }

      return res.json([]);
    }

    const wantEscolinha =
      !tipos ||
      tipos.toLowerCase().includes("escolinha");

    const wantClube =
      !tipos ||
      tipos.toLowerCase().includes("clube");

    const [escolinhas, clubes] = await Promise.all([
      wantEscolinha
        ? prisma.escolinha.findMany({
            select: {
              id: true,
              nome: true,
              usuarioId: true,
              logo: true,

              usuario: {
                select: {
                  foto: true,
                },
              },
            },

            orderBy: {
              nome: "asc",
            },
          })
        : Promise.resolve([]),

      wantClube
        ? prisma.clube.findMany({
            select: {
              id: true,
              nome: true,
              usuarioId: true,
              logo: true,

              usuario: {
                select: {
                  foto: true,
                },
              },
            },

            orderBy: {
              nome: "asc",
            },
          })
        : Promise.resolve([]),
    ]);

    const out: OrgOut[] = [
      ...escolinhas.map((o) => ({
        id: o.id,
        nome: o.nome,
        usuarioId: o.usuarioId,
        tipo: "Escolinha" as const,

        logo:
          o.logo ??
          o.usuario?.foto ??
          null,

        foto:
          o.logo ??
          o.usuario?.foto ??
          null,
      })),

      ...clubes.map((o) => ({
        id: o.id,
        nome: o.nome,
        usuarioId: o.usuarioId,
        tipo: "Clube" as const,

        logo:
          o.logo ??
          o.usuario?.foto ??
          null,

        foto:
          o.logo ??
          o.usuario?.foto ??
          null,
      })),
    ];

    return res.json(out);
  } catch (e) {
    console.error("[organizacoes] erro:", e);

    return res.status(500).json({
      error: "Falha ao listar organizações",
    });
  }
}

router.get("/disponiveis", listOrganizacoes);
router.get("/", listOrganizacoes);

export default router;