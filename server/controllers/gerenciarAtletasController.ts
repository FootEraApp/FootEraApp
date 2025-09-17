import { PrismaClient, Categoria } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

// ===== Helpers =====
const CATEGORIA_ORDER: Categoria[] = ["Sub9", "Sub11", "Sub13", "Sub15", "Sub17", "Sub20", "Livre"];
function pickMainCategoria(categorias: Categoria[] | null | undefined): Categoria | null {
  if (!categorias || categorias.length === 0) return null;
  const sorted = [...categorias].sort((a, b) => CATEGORIA_ORDER.indexOf(b) - CATEGORIA_ORDER.indexOf(a));
  return sorted[0] ?? null;
}

function parseOrder(order?: string) {
  switch (order) {
    case "pontuacao_asc":
      return { pontuacao: "asc" as const };
    case "nome_asc":
      return { nome: "asc" as const };
    case "nome_desc":
      return { nome: "desc" as const };
    case "pontuacao_desc":
    default:
      return { pontuacao: "desc" as const };
  }
}

async function isAtivoRecentemente(usuarioId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const recent = await prisma.atividadeRecente.findFirst({
    where: { usuarioId, createdAt: { gte: since } },
    select: { id: true },
  });
  return !!recent;
}

export const gerenciarAtletasController = {
  // GET /api/gerenciar/atletas
  list: async (req: Request, res: Response) => {
    try {
      const vinculo = String(req.query.vinculo || "").toLowerCase();
      const entidadeUsuarioId = String(req.query.id || "");
      const search = (req.query.search as string) || "";
      const categoria = (req.query.categoria as Categoria) || undefined;
      const posicaoFiltro = (req.query.posicao as string) || undefined; // posição efetiva (elenco)
      const status = (req.query.status as "ativo" | "inativo" | undefined) || undefined;
      const order = (req.query.order as string) || "pontuacao_desc";

      if (!["escolinha", "clube", "professor"].includes(vinculo)) {
        return res.status(400).json({ message: "Parâmetro 'vinculo' inválido" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' (usuarioId da entidade) é obrigatório" });
      }

      // === Resolve entidade pelo usuarioId e prepara filtro base de vínculo ===
      let whereByVinculo: any = {};
      let entidadeId: string | null = null;

      if (vinculo === "clube") {
        const entidade = await prisma.clube.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!entidade) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = entidade.id;
        whereByVinculo = { clubeId: entidade.id };
      } else if (vinculo === "escolinha") {
        const entidade = await prisma.escolinha.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!entidade) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = entidade.id;
        whereByVinculo = { escolinhaId: entidade.id };
      } else {
        // professor
        const prof = await prisma.professor.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!prof) return res.status(404).json({ message: "Professor não encontrado" });
        entidadeId = prof.id;
        whereByVinculo = { relacoesTreinamento: { some: { professorId: prof.id } } };
      }

      // === Filtros básicos no banco (não filtrar por Atleta.posicao aqui)
      const where: any = { ...whereByVinculo };
      if (categoria) where.categoria = { has: categoria };
      if (search) {
        where.OR = [
          { nome: { contains: search, mode: "insensitive" } },
          { usuario: { nome: { contains: search, mode: "insensitive" } } },
        ];
      }

      // Busca atletas vinculados à entidade
      const atletas = await prisma.atleta.findMany({
        where,
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          idade: true,
          foto: true,
          posicao: true, // fallback
          categoria: true,
          usuario: { select: { nome: true } },
          pontuacao: { select: { pontuacaoTotal: true } },
        },
      });

      // === Coleta todos os elencos da entidade (sem orderBy em Elenco)
      let elencoIds: string[] = [];
      if (vinculo === "clube" && entidadeId) {
        const elencos = await prisma.elenco.findMany({ where: { clubeId: entidadeId }, select: { id: true } });
        elencoIds = elencos.map((e) => e.id);
      } else if (vinculo === "escolinha" && entidadeId) {
        const elencos = await prisma.elenco.findMany({ where: { escolinhaId: entidadeId }, select: { id: true } });
        elencoIds = elencos.map((e) => e.id);
      } else if (vinculo === "professor" && entidadeId) {
        const elencos = await prisma.elenco.findMany({ where: { professorId: entidadeId }, select: { id: true } });
        elencoIds = elencos.map((e) => e.id);
      }

      // === Mapa atletaId -> posição mais recente no(s) elencos (pelo createdAt do vínculo)
      const posicaoPorAtletaId = new Map<string, string>();
      if (elencoIds.length > 0) {
        const vincs = await prisma.atletaElenco.findMany({
          where: { elencoId: { in: elencoIds } },
          select: { atletaId: true, posicao: true, createdAt: true },
          orderBy: { createdAt: "desc" }, // createdAt existe em AtletaElenco
        });
        for (const v of vincs) {
          if (!posicaoPorAtletaId.has(v.atletaId)) {
            posicaoPorAtletaId.set(v.atletaId, v.posicao as unknown as string);
          }
        }
      }

      // Monta payload final
      const enriched = await Promise.all(
        atletas.map(async (a) => {
          const ativo = await isAtivoRecentemente(a.usuarioId);
          const posicaoElenco = posicaoPorAtletaId.get(a.id) ?? null; // a.id é atletaId
          return {
            id: a.id,
            usuarioId: a.usuarioId,
            nome: a.nome || a.usuario?.nome || "—",
            idade: a.idade,
            foto: a.foto,
            posicao: posicaoElenco || a.posicao || null,
            categoria: pickMainCategoria(a.categoria) || null,
            pontuacao: a.pontuacao?.pontuacaoTotal ?? 0,
            ativoRecentemente: ativo,
          };
        })
      );

      // Filtro por posição efetiva
      let filtered = enriched;
      if (posicaoFiltro) {
        const needle = posicaoFiltro.toLowerCase();
        filtered = filtered.filter((x) => (x.posicao || "").toLowerCase() === needle);
      }

      // Filtro de status
      if (status) {
        filtered = filtered.filter((x) => (status === "ativo" ? x.ativoRecentemente : !x.ativoRecentemente));
      }

      // Ordenação
      const ord = parseOrder(order);
      if ((ord as any).nome) {
        filtered.sort((a, b) =>
          (ord as any).nome === "asc" ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome)
        );
      } else if ((ord as any).pontuacao) {
        filtered.sort((a, b) =>
          (ord as any).pontuacao === "asc"
            ? (a.pontuacao ?? 0) - (b.pontuacao ?? 0)
            : (b.pontuacao ?? 0) - (a.pontuacao ?? 0)
        );
      }

      return res.json({ atletas: filtered });
    } catch (e: any) {
      console.error("[gerenciarAtletas.list]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar atletas" });
    }
  },

  // GET /api/gerenciar/treinosprogramados?criador=escolinha|clube|professor&id=<usuarioId>
  // Retorna apenas TreinoProgramado cujo <tipo>Id corresponda ao id da ENTIDADE (resolvida a partir do usuarioId).
  listTreinos: async (req: Request, res: Response) => {
    try {
      const criador = String(req.query.criador || "").toLowerCase(); // "escolinha" | "clube" | "professor"
      const entidadeUsuarioId = String(req.query.id || ""); // usuario.id da entidade

      if (!["escolinha", "clube", "professor"].includes(criador)) {
        return res.status(400).json({ message: "Parâmetro 'criador' inválido" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' obrigatório" });
      }

      // 1) Resolver id da ENTIDADE a partir do usuarioId
      let entidadeId: string | null = null;
      if (criador === "clube") {
        const clube = await prisma.clube.findUnique({ where: { usuarioId: entidadeUsuarioId }, select: { id: true } });
        if (!clube) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = clube.id;
      } else if (criador === "escolinha") {
        const escolinha = await prisma.escolinha.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!escolinha) return res.status(404).json({ message: "Entidade não encontrada" });
        entidadeId = escolinha.id;
      } else {
        const prof = await prisma.professor.findUnique({
          where: { usuarioId: entidadeUsuarioId },
          select: { id: true },
        });
        if (!prof) return res.status(404).json({ message: "Professor não encontrado" });
        entidadeId = prof.id;
      }

      // 2) Montar filtro diretamente na TABELA TreinoProgramado
      //    - clubeId / escolinhaId / professorId = entidadeId
      let whereTreino: any = {};
      if (criador === "clube") whereTreino = { clubeId: entidadeId };
      else if (criador === "escolinha") whereTreino = { escolinhaId: entidadeId };
      else whereTreino = { professorId: entidadeId };

      const treinos = await prisma.treinoProgramado.findMany({
        where: whereTreino,
        select: {
          id: true,
          nome: true,
          descricao: true,
          objetivo: true,
          pontuacao: true,
          categoria: true,
          expiraEm: true,
          naoExpira: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        items: treinos.map((t) => ({
          id: t.id,
          titulo: t.nome,
          objetivo: t.objetivo ?? null,
          pontuacao: t.pontuacao ?? null,
          categoria: pickMainCategoria(t.categoria) ?? null,
          expiraEm: t.expiraEm ?? null,
          naoExpira: t.naoExpira ?? false,
        })),
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.listTreinos]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar treinos" });
    }
  },

  // POST /api/gerenciar/treinosprogramados/convocar
  // body: { treinoProgramadoId: string, destinatarios: string[], objetivo?: string, prazo?: string (yyyy-mm-dd), origem: "escolinha"|"clube"|"professor" }
  convocarTreino: async (req: Request, res: Response) => {
    try {
      const { treinoProgramadoId, destinatarios, objetivo, prazo, origem } = req.body as {
        treinoProgramadoId: string;
        destinatarios: string[]; // usuarioIds dos atletas
        objetivo?: string;
        prazo?: string;          // yyyy-mm-dd
        origem: "escolinha" | "clube" | "professor";
      };

      if (!treinoProgramadoId || !Array.isArray(destinatarios) || destinatarios.length === 0) {
        return res.status(400).json({ message: "Dados inválidos para convocação" });
      }
      if (!["escolinha", "clube", "professor"].includes(origem)) {
        return res.status(400).json({ message: "Origem inválida" });
      }

      const treino = await prisma.treinoProgramado.findUnique({ where: { id: treinoProgramadoId } });
      if (!treino) return res.status(404).json({ message: "Treino programado não encontrado" });

      // usuarioId -> atletaId
      const atletas = await prisma.atleta.findMany({
        where: { usuarioId: { in: destinatarios } },
        select: { id: true, usuarioId: true },
      });
      if (atletas.length === 0) return res.status(400).json({ message: "Nenhum atleta válido encontrado" });

      // Deriva datas/objetivo (snapshot)
      const dataExpiracaoDerivada =
        prazo ? new Date(prazo) :
        treino.expiraEm ?? undefined;

      const dataTreinoDerivada = treino.dataAgendada ?? undefined;
      const objetivoSnapshot   = (objetivo ?? treino.objetivo ?? undefined);

      // Tudo em transação: garante consistência
      await prisma.$transaction(async (tx) => {
        for (const a of atletas) {
          // 1) Garante TreinoProgramadoRecebido (sem duplicar)
          const existente = await tx.treinoProgramadoRecebido.findFirst({
            where: { atletaId: a.id, treinoId: treino.id },
            select: { id: true },
          });
          if (!existente) {
            await tx.treinoProgramadoRecebido.create({
              data: { atletaId: a.id, treinoId: treino.id },
            });
          }

          // 2) SEMPRE cria um TreinoAgendado para o atleta
          // titulo é unique no schema => inclui atletaId + timestamp para não colidir
          await tx.treinoAgendado.create({
            data: {
              atletaId: a.id,
              treinoProgramadoId: treino.id,
              titulo: `${treino.nome}`,
              dataExpiracao: dataExpiracaoDerivada,
              dataTreino: dataTreinoDerivada,
              // usando 'local' como snapshot de objetivo (como já fazia antes)
              local: objetivoSnapshot,
            },
          });
        }
      });

      return res.json({ ok: true, count: atletas.length, criouAgendados: true });
    } catch (e: any) {
      console.error("[gerenciarAtletas.convocarTreino]", e);
      return res.status(500).json({ message: e?.message || "Erro ao convocar treino" });
    }
  },


  // GET /api/gerenciar/atletas/:usuarioId/pontuacao
  // Retorna resumo para painel lateral (mês corrente + evolução últimas 4 semanas)
  // Treinos (mês) = submissões de treino do mês + submissões de desafio do mês
  statsAtleta: async (req: Request, res: Response) => {
    try {
      const usuarioId = String(req.params.usuarioId || "");
      if (!usuarioId) return res.status(400).json({ message: "usuarioId obrigatório" });

      const atleta = await prisma.atleta.findUnique({ where: { usuarioId }, select: { id: true } });
      if (!atleta) return res.status(404).json({ message: "Atleta não encontrado" });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Contadores do mês
      const [treinosMes, desafiosMes] = await Promise.all([
        prisma.submissaoTreino.count({
          where: { atletaId: atleta.id, criadoEm: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
        prisma.submissaoDesafio.count({
          where: { atletaId: atleta.id, createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
      ]);

      const totalTreinosMes = treinosMes + desafiosMes; // soma pedida
      const concluidosMes = treinosMes;                  // apenas treinos
      const desafiosFeitosMes = desafiosMes;             // apenas desafios

      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const ultimas = await prisma.submissaoTreino.findMany({
        where: { atletaId: atleta.id, criadoEm: { gte: fourWeeksAgo } },
        select: { criadoEm: true, pontuacaoSnapshot: true },
      });

      // agrega por "semana" simples (chave YYYY-WN)
      const buckets: Record<string, number> = {};
      for (const s of ultimas) {
        const d = new Date(s.criadoEm);
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
        const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + firstDay) / 7)}`;
        buckets[weekKey] = (buckets[weekKey] || 0) + (s.pontuacaoSnapshot || 0);
      }

      const series: { semana: string; pontos: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
        const key = `${d.getFullYear()}-W${Math.ceil((d.getDate() + firstDay) / 7)}`;
        series.push({ semana: i === 0 ? "S" : `S-${i}`, pontos: buckets[key] || 0 });
      }
      const mediaUltimas4Semanas =
        series.reduce((acc, x) => acc + x.pontos, 0) / (series.length || 1);

      return res.json({
        totalTreinosMes,
        concluidosMes,
        desafiosFeitosMes,
        mediaUltimas4Semanas: Math.round(mediaUltimas4Semanas),
        evolucaoSemanas: series,
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.statsAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao obter estatísticas" });
    }
  },

  ranking: async (req: Request, res: Response) => {
    try {
      const vinculo = String(req.query.vinculo || "").toLowerCase();
      const entidadeUsuarioId = String(req.query.id || "");
      if (!["escolinha", "clube", "professor"].includes(vinculo)) {
        return res.status(400).json({ message: "Parâmetro 'vinculo' inválido" });
      }
      if (!entidadeUsuarioId) {
        return res.status(400).json({ message: "Parâmetro 'id' obrigatório" });
      }

      let whereByVinculo: any = {};
      if (vinculo === "clube") {
        const entidade = await prisma.clube.findUnique({ where: { usuarioId: entidadeUsuarioId }, select: { id: true } });
        if (!entidade) return res.status(404).json({ message: "Entidade não encontrada" });
        whereByVinculo = { clubeId: entidade.id };
      } else if (vinculo === "escolinha") {
        const entidade = await prisma.escolinha.findUnique({ where: { usuarioId: entidadeUsuarioId }, select: { id: true } });
        if (!entidade) return res.status(404).json({ message: "Entidade não encontrada" });
        whereByVinculo = { escolinhaId: entidade.id };
      } else {
        const prof = await prisma.professor.findUnique({ where: { usuarioId: entidadeUsuarioId }, select: { id: true } });
        if (!prof) return res.status(404).json({ message: "Professor não encontrado" });
        whereByVinculo = { relacoesTreinamento: { some: { professorId: prof.id } } };
      }

      const atletas = await prisma.atleta.findMany({
        where: whereByVinculo,
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          foto: true,
          posicao: true,
          categoria: true,
          usuario: { select: { nome: true } },
          pontuacao: { select: { pontuacaoTotal: true } },
        },
      });

      const payload = atletas
        .map((a) => ({
          id: a.id,
          usuarioId: a.usuarioId,
          nome: a.nome || a.usuario?.nome || "—",
          foto: a.foto,
          posicao: a.posicao || null,
          categoria: pickMainCategoria(a.categoria) || null,
          pontuacao: a.pontuacao?.pontuacaoTotal ?? 0,
        }))
        .sort((a, b) => (b.pontuacao ?? 0) - (a.pontuacao ?? 0));

      return res.json({ atletas: payload });
    } catch (e: any) {
      console.error("[gerenciarAtletas.ranking]", e);
      return res.status(500).json({ message: e?.message || "Erro ao obter ranking" });
    }
  },

  // GET /api/gerenciar/atletas/:usuarioId/detalhes
  // Mesmo cômputo do mês + snapshot simples (últimos itens)
  detalhesAtleta: async (req: Request, res: Response) => {
    try {
      const usuarioId = String(req.params.usuarioId || "");
      if (!usuarioId) return res.status(400).json({ message: "usuarioId obrigatório" });

      const atleta = await prisma.atleta.findUnique({ where: { usuarioId }, select: { id: true, nome: true, foto: true } });
      if (!atleta) return res.status(404).json({ message: "Atleta não encontrado" });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [treinosMes, desafiosMes, ultTreinos, ultDesafios] = await Promise.all([
        prisma.submissaoTreino.count({
          where: { atletaId: atleta.id, criadoEm: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
        prisma.submissaoDesafio.count({
          where: { atletaId: atleta.id, createdAt: { gte: startOfMonth, lt: startOfNextMonth } },
        }),
        prisma.submissaoTreino.findMany({
          where: { atletaId: atleta.id },
          select: {
            id: true,
            criadoEm: true,
            aprovado: true,
            pontuacaoSnapshot: true,
            treinoTituloSnapshot: true,
            treinoAgendado: { select: { titulo: true } },
          },
          orderBy: { criadoEm: "desc" },
          take: 5,
        }),
        prisma.submissaoDesafio.findMany({
          where: { atletaId: atleta.id },
          // usamos include para trazer a relação 'desafio' (não misturar select+include)
          include: {
            desafio: { select: { titulo: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      const totalTreinosMes = treinosMes + desafiosMes;
      const concluidosMes = treinosMes;
      const desafiosFeitosMes = desafiosMes;

      return res.json({
        atleta: { id: atleta.id, nome: atleta.nome, foto: atleta.foto },
        mes: {
          totalTreinosMes,
          concluidosMes,
          desafiosFeitosMes,
        },
        ultimasSubmissoes: {
          treinos: ultTreinos.map((t) => ({
            id: t.id,
            tipo: "treino" as const,
            criadoEm: t.criadoEm,
            aprovado: t.aprovado ?? null,
            pontos: t.pontuacaoSnapshot ?? null,
            titulo: t.treinoTituloSnapshot || t.treinoAgendado?.titulo || "Treino",
          })),
          desafios: ultDesafios.map((d) => ({
            id: d.id,
            tipo: "desafio" as const,
            criadoEm: d.createdAt,
            aprovado: (d as any).aprovado ?? null, // scalar vem por padrão ao usar include
            titulo: d.desafio?.titulo || "Desafio",
          })),
        },
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.detalhesAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao obter detalhes do atleta" });
    }
  },

  // GET /api/gerenciar/atletas/:usuarioId/submissoes?period=month|all&type=all|treinos|desafios&limit=20
  submissoesAtleta: async (req: Request, res: Response) => {
    try {
      const usuarioId = String(req.params.usuarioId || "");
      if (!usuarioId) return res.status(400).json({ message: "usuarioId obrigatório" });

      const atleta = await prisma.atleta.findUnique({ where: { usuarioId }, select: { id: true } });
      if (!atleta) return res.status(404).json({ message: "Atleta não encontrado" });

      const { period = "all", type = "all", limit = "20" } = req.query as Record<string, string>;
      const take = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);

      // Período
      let dateFilterTreino: any = undefined;
      let dateFilterDesafio: any = undefined;
      if (period === "month") {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        dateFilterTreino = { gte: startOfMonth, lt: startOfNextMonth };
        dateFilterDesafio = { gte: startOfMonth, lt: startOfNextMonth };
      }

      // Queries em paralelo conforme 'type'
      const doTreinos = type === "all" || type === "treinos";
      const doDesafios = type === "all" || type === "desafios";

      const [treinos, desafios] = await Promise.all([
        doTreinos
          ? prisma.submissaoTreino.findMany({
              where: { atletaId: atleta.id, ...(dateFilterTreino ? { criadoEm: dateFilterTreino } : {}) },
              select: {
                id: true,
                criadoEm: true,
                aprovado: true,
                pontuacaoSnapshot: true,
                treinoTituloSnapshot: true,
                treinoAgendado: { select: { titulo: true } },
              },
              orderBy: { criadoEm: "desc" },
              take,
            })
          : Promise.resolve([]),
        doDesafios
          ? prisma.submissaoDesafio.findMany({
              where: { atletaId: atleta.id, ...(dateFilterDesafio ? { createdAt: dateFilterDesafio } : {}) },
              // usar include para trazer relação 'desafio'
              include: {
                desafio: { select: { titulo: true } },
              },
              orderBy: { createdAt: "desc" },
              take,
            })
          : Promise.resolve([]),
      ]);

      // Unifica e ordena por data (desc)
      type Row =
        | { id: string; tipo: "treino"; data: Date; aprovado: boolean | null; titulo: string; pontos?: number | null }
        | { id: string; tipo: "desafio"; data: Date; aprovado: boolean | null; titulo: string };

      const rows: Row[] = [
        ...treinos.map((t) => ({
          id: t.id,
          tipo: "treino" as const,
          data: t.criadoEm,
          aprovado: t.aprovado ?? null,
          titulo: t.treinoTituloSnapshot || t.treinoAgendado?.titulo || "Treino",
          pontos: t.pontuacaoSnapshot ?? null,
        })),
        ...desafios.map((d) => ({
          id: d.id,
          tipo: "desafio" as const,
          data: (d as any).createdAt,
          aprovado: (d as any).aprovado ?? null,
          titulo: (d as any).desafio?.titulo || "Desafio",
        })),
      ].sort((a, b) => b.data.getTime() - a.data.getTime());

      return res.json({
        total: rows.length,
        items: rows.slice(0, take),
      });
    } catch (e: any) {
      console.error("[gerenciarAtletas.submissoesAtleta]", e);
      return res.status(500).json({ message: e?.message || "Erro ao listar submissões" });
    }
  },
};
