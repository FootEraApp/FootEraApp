import { Request, Response } from "express";
import { PrismaClient, OrigemFormador } from "@prisma/client";
import { resolveAtletaId, resolveClubeId, resolveEscolinhaId } from "../services/formadores.service.js";

const prisma = new PrismaClient();

const SOLIDARIEDADE_PCT = 0.05;
function ensureNumber(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export const formadoresController = {
   dashboard: async (_req: Request, res: Response) => {
      try {
        const [totalVinculos, transfSolid, sumSolid, totalBadgesPersistidos] = await Promise.all([
          prisma.vinculoFormacao.count(),
          prisma.transferenciaFormador.count({ where: { gerouSolidariedade: true } }),
          prisma.transferenciaFormador.aggregate({ _sum: { valorSolidariedade: true } }),
          prisma.badgeFormador.count(),
        ]);

        let dinamicos = 0;
        if (totalVinculos >= 1) dinamicos += 1;
        if (totalVinculos >= 5) dinamicos += 1; 
        if (transfSolid >= 1)   dinamicos += 1; 

        res.json({
          totalAtletasFormados: totalVinculos,
          totalTransferenciasComSolidariedade: transfSolid,
          totalArrecadadoSolidariedade: Number(sumSolid._sum.valorSolidariedade ?? 0),
          totalBadges: totalBadgesPersistidos + dinamicos,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar dashboard" });
      }
    },

  listarAtletas: async (_req: Request, res: Response) => {
    try {
      const rows = await prisma.vinculoFormacao.findMany({
        orderBy: { createdAt: "desc" },
        include: { atleta: { select: { nome: true } } },
      });
      const mapped = rows.map((r) => ({ ...r, atletaNome: r.atleta?.nome ?? null }));
      res.json(mapped);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao listar vínculos" });
    }
  },

  criarVinculo: async (req: Request, res: Response) => {
    try {
      let { atletaId, origem, origemId, inicio, observacoes } = req.body as {
        atletaId: string;
        origem: "Escolinha" | "Clube" | "escolinha" | "clube";
        origemId: string;
        inicio?: string;
        observacoes?: string;
      };
      if (!atletaId || !origem || !origemId) {
        return res.status(400).json({ message: "Campos obrigatórios: atletaId, origem, origemId" });
      }

      const atletaRealId = await resolveAtletaId(atletaId);
      if (!atletaRealId) return res.status(400).json({ message: "Atleta não encontrado." });

      const origemEnum: OrigemFormador =
        origem === "escolinha" ? "Escolinha" :
        origem === "clube"     ? "Clube"     :
        (origem as OrigemFormador);

      const entidadeId = origemEnum === "Clube"
        ? await resolveClubeId(origemId)
        : await resolveEscolinhaId(origemId);

      if (!entidadeId) return res.status(400).json({ message: `${origemEnum} não encontrado(a).` });

      const created = await prisma.$transaction(async (tx) => {
        const vinculo = await tx.vinculoFormacao.create({
          data: {
            atletaId: atletaRealId,
            origem: origemEnum,
            origemId: entidadeId,
            inicio: inicio ? new Date(inicio) : null,
            observacoes: observacoes || null,
          },
        });
        if (origemEnum === "Clube") {
          await tx.atleta.update({ where: { id: atletaRealId }, data: { clubeId: entidadeId } });
        } else {
          await tx.atleta.update({ where: { id: atletaRealId }, data: { escolinhaId: entidadeId } });
        }
        return vinculo;
      });

      res.status(201).json(created);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao criar vínculo" });
    }
  },

  listarTransferencias: async (_req: Request, res: Response) => {
    try {
      const rows = await prisma.transferenciaFormador.findMany({
        orderBy: { createdAt: "desc" },
        include: { atleta: { select: { nome: true } } },
      });

      const ids = Array.from(
        new Set(
          rows.flatMap(r => [r.deClubeId, r.paraClubeId].filter(Boolean) as string[])
        )
      );

      const clubes = ids.length
        ? await prisma.clube.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })
        : [];
      const nomePorId = new Map(clubes.map(c => [c.id, c.nome]));

      const mapped = rows.map(r => ({
        ...r,
        atletaNome: r.atleta?.nome ?? null,
        deClubeNome: r.deClubeId ? (nomePorId.get(r.deClubeId) ?? r.deClubeId) : null,
        paraClubeNome: r.paraClubeId ? (nomePorId.get(r.paraClubeId) ?? r.paraClubeId) : null,
      }));

      res.json(mapped);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao listar transferências" });
    }
  },

    criarTransferencia: async (req: Request, res: Response) => {
      try {
        const { atletaId, deClubeId, paraClubeId, data, valorTransferencia } = req.body as {
          atletaId: string;
          deClubeId?: string;
          paraClubeId?: string;
          data?: string;
          valorTransferencia: number;
        };
        if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

        const valor = ensureNumber(valorTransferencia, 0);
        const valorSolidariedade = Math.round(valor * SOLIDARIEDADE_PCT * 100) / 100;

        const created = await prisma.$transaction(async (tx) => {
          const created = await tx.transferenciaFormador.create({
            data: {
              atletaId,
              deClubeId: deClubeId || null,
              paraClubeId: paraClubeId || null,
              data: data ? new Date(data) : null,
              valorTransferencia: valor,
              gerouSolidariedade: valorSolidariedade > 0,
              valorSolidariedade,
            },
          });

          if (paraClubeId) {
            await tx.atleta.update({
              where: { id: atletaId },
              data: { clubeId: paraClubeId },
            });

            await tx.relacaoTreinamento.deleteMany({
              where: { atletaId, clubeId: { not: paraClubeId } },
            });
            const existe = await tx.relacaoTreinamento.findFirst({
              where: { atletaId, clubeId: paraClubeId },
            });
            if (!existe) {
              await tx.relacaoTreinamento.create({
                data: { atletaId, clubeId: paraClubeId },
              });
            }
          }

          return created;
        });

        res.status(201).json(created);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao registrar transferência" });
      }
    },

  listarBadges: async (_req: Request, res: Response) => {
    try {
      const totalVinculos = await prisma.vinculoFormacao.count();
      const transferComSol = await prisma.transferenciaFormador.count({ where: { gerouSolidariedade: true } });

      const dinamicas: Array<{ nome: string; descricao: string; icon: string }> = [];
      if (totalVinculos >= 1) dinamicas.push({ nome: "Primeiro Atleta Formado", descricao: "Você registrou seu primeiro vínculo", icon: "🥇" });
      if (totalVinculos >= 5) dinamicas.push({ nome: "Time de Base", descricao: "5+ atletas formados", icon: "👥" });
      if (transferComSol >= 1) dinamicas.push({ nome: "Solidariedade Ativa", descricao: "Primeira transferência com solidariedade", icon: "⚖️" });

      const persistidas = await prisma.badgeFormador.findMany({ orderBy: { createdAt: "desc" } });

      const result = [
        ...dinamicas.map((b, idx) => ({ id: `dyn-${idx}`, nome: b.nome, descricao: b.descricao, icon: b.icon, iconUrl: null, conquistadoEm: new Date().toISOString() })),
        ...persistidas.map((b) => ({ id: b.id, nome: b.nome, descricao: b.descricao, icon: b.icon ?? null, iconUrl: b.iconUrl ?? null, conquistadoEm: b.conquistadoEm?.toISOString() ?? null })),
      ];
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao listar badges" });
    }
  },

  calcularSolidariedade: async (req: Request, res: Response) => {
    try {
      const { valorTransferencia } = req.body as { valorTransferencia: number };
      const valor = ensureNumber(valorTransferencia, 0);
      const valorSolidariedade = Math.round(valor * SOLIDARIEDADE_PCT * 100) / 100;
      res.json({ valorTransferencia: valor, percentual: SOLIDARIEDADE_PCT, valorSolidariedade });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao calcular solidariedade" });
    }
  },

  listarDocumentos: async (req: Request, res: Response) => {
    try {
      const { atletaId } = req.query as { atletaId?: string };
      const where = atletaId ? { atletaId } : {};
      const docs = await prisma.documentoFormador.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          atleta: { select: { usuarioId: true, nome: true } },
        },
      });

      const result = docs.map((d) => ({
        id: d.id,
        atletaId: d.atletaId,
        atletaNome: d.atleta?.nome ?? null,
        descricao: d.descricao,
        fileName: d.fileName,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        path: d.path,      
        createdAt: d.createdAt,
      }));
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Erro ao listar documentos" });
    }
  },


  uploadDocumentos: async (req: Request, res: Response) => {
    try {
      const { atletaId, descricao, vinculoFormacaoId } = req.body as {
        atletaId: string;                
        descricao?: string;
        vinculoFormacaoId?: string;
      };

    if (!atletaId) return res.status(400).json({ message: "atletaId é obrigatório" });

    const atleta = await prisma.atleta.findFirst({
      where: {
        OR: [
          { id: atletaId },
          { usuarioId: atletaId },
          { usuario: { nomeDeUsuario: atletaId } },
        ],
      },
    });
    if (!atleta) return res.status(400).json({ message: "Atleta não encontrado para o identificador informado." });

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ message: "Nenhum arquivo enviado" });

    const created = await prisma.$transaction(
      files.map((f) =>
        prisma.documentoFormador.create({
          data: {
            atletaId: atleta.id,              
            descricao: descricao || null,
            vinculoFormacaoId: vinculoFormacaoId || null,
            fileName: f.filename,
            originalName: f.originalname,
            mimeType: f.mimetype,
            size: f.size,
            path: `/uploads/formadores/${f.filename}`,
          },
        })
      )
    );

    res.status(201).json(created);
  } catch (err: any) {
    console.error("UPLOAD_DOCUMENTOS_ERROR:", err);
    if (err.code === "P2003") {
      return res.status(400).json({ message: "ID de atleta inválido. Informe o id do Atleta, o usuarioId do Atleta, ou o nomeDeUsuario." });
    }
    res.status(500).json({ message: "Erro ao fazer upload" });
  }
},
}