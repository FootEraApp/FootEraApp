// server/controllers/perfilController
import { Request, Response } from "express";
import { Categoria, PosicaoCampo, MetodologiaAssinaturaStatus} from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireUsage } from "server/lib/usage.js";
import { validarJanelaAtleta, getRangeFromQuery, PlanoAtleta } from "../utils/analyticsWindow.js";
import { prisma } from "../prisma.js";
import { calcularPerfilVerificado } from "../utils/perfilVerificado.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";
import { sendError } from "../utils/httpError.js";
import { avaliarPrivacidadePerfil } from "../utils/privacy.js";

type AtividadeUI = {
  id: string;
  tipo: string;         
  titulo: string;      
  createdAt: string;    
  imagemUrl?: string | null;
  link?: string | null; 
};

const DEFAULT_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";
const PONTOS_POR_INDICACAO_APROVADA = 10;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

function absUrl(path?: string | null) {
  const s = typeof path === "string" ? path.trim() : "";
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `${s.startsWith("/uploads") ? API_BASE_URL : FRONTEND_URL}${s}`;
}
function normalizarCategorias(input: any): Categoria[] {
  if (!input) return [];

  const arr = Array.isArray(input) ? input : String(input).split(",");

  return arr
    .map((c: string) => {
      const s = c.trim().toLowerCase();

      if (s.startsWith("sub")) {
        const num = s.replace(/\D/g, "");
        return `Sub${num}`; 
      }

      if (s === "livre") return "Livre";

      return null;
    })
    .filter(Boolean) as Categoria[];
}

function isAdminFromReq(req: any) {
  const t = String(req?.user?.tipo ?? req?.authUser?.tipo ?? "").toLowerCase();
  return t === "admin";
}

function withDefaultImg(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : DEFAULT_AVATAR;
}

async function obterAcessoPerfil(
  req: any,
  res: Response,
  targetUsuarioId: string
) {
  const viewerId =
    req?.userId ||
    req?.user?.id ||
    null;

  const acesso =
    await avaliarPrivacidadePerfil(
      viewerId,
      targetUsuarioId
    );

  if (!acesso.podeVerPerfil) {
    res.status(403).json({
      code: "PROFILE_PRIVATE",
      message:
        "Este perfil está privado.",
    });

    return null;
  }

  return acesso;
}

function sanitizarUsuarioPerfil(
  usuario: any,
  podeMostrarEmail: boolean
) {
  if (!usuario) return null;

  return {
    ...usuario,
    email: podeMostrarEmail
      ? usuario.email
      : null,
  };
}

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calcularIdadePorDataNascimento(dataNascimento: Date) {
  const hoje = new Date();
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();

  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNasc = dataNascimento.getMonth();
  const diaNasc = dataNascimento.getDate();

  if (mesAtual < mesNasc || (mesAtual === mesNasc && diaAtual < diaNasc)) {
    idade--;
  }

  return idade;
}

function parseDataNascimentoObrigatoria(raw: any) {
  const valor = String(raw || "").trim();

  if (!valor) {
    const err: any = new Error("Data de nascimento é obrigatória.");
    err.statusCode = 400;
    throw err;
  }

  const data = new Date(`${valor}T00:00:00`);

  if (Number.isNaN(data.getTime())) {
    const err: any = new Error("Data de nascimento inválida.");
    err.statusCode = 400;
    throw err;
  }

  const min = new Date("1900-01-01T00:00:00");
  const hoje = inicioDoDia(new Date());

  if (data < min || data > hoje) {
    const err: any = new Error("A data de nascimento deve estar entre 1900 e a data de hoje.");
    err.statusCode = 400;
    throw err;
  }

  return {
    dataNascimento: data,
    idade: calcularIdadePorDataNascimento(data),
  };
}

function pickId(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (raw?.id) return String(raw.id);
  if (raw?.value) return String(raw.value);
  if (Array.isArray(raw) && raw[0]?.id) return String(raw[0].id);
  return undefined;
}

function pickIds(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw) && raw.length && typeof raw[0] === "string") {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }

  if (Array.isArray(raw) && raw.length && (raw[0]?.id || raw[0]?.value)) {
    return raw
      .map((x) => (x?.id ? String(x.id) : x?.value ? String(x.value) : ""))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const one = pickId(raw);
  return one ? [one] : [];
}

function pontosDesafioInd(s: any) {
  const cand = [
    s?.pontosCreditados,   
    s?.pontuacaoSnapshot,   
    s?.pontuacao,           
    s?.desafio?.pontuacao, 
  ];
  const n = cand
    .map(v => Number(v))
    .find(v => Number.isFinite(v) && v > 0);
  return n ?? 0;
}

function pontosGrupo(p: any): number {
  const baseCandidates = [
    p?.pontosGanhos,                            
    p?.desafioEmGrupo?.pontosAcumulados,     
    p?.desafioEmGrupo?.pontosSnapshot,
  ];
  const base = baseCandidates
    .map((v) => Number(v))
    .find((v) => Number.isFinite(v) && v > 0) ?? 0;

  const bonus = Number(p?.desafioEmGrupo?.bonus) || 0;
  const bonusDado = !!p?.desafioEmGrupo?.bonusDado;

  return base + (bonusDado ? bonus : 0);
}

async function getParticipacoesGrupo(usuarioId: string, atletaId: string) {
  try {
    return await prisma.submissaoDesafioEmGrupo.findMany({
      where: {
        OR: [
          { usuarioId },                            
          { submissaoDesafio: { atletaId } },    
        ],
      },
      include: {
        desafioEmGrupo: {
          include: {
            grupo: true,
            desafioOficial: true,
          },
        },
      },
      orderBy: { dataEnvio: "desc" },
    });
  } catch {
    return [];
  }
}

function mapGrupoToAtividade(p: any) {
  const g = p.desafioEmGrupo;
  const desafio = g?.desafioOficial;
  return {
    id: `g-${p.id}`,
    tipo: "Desafio" as const,
    imagemUrl: desafio?.imagemUrl ?? null,
    nome: desafio?.titulo ?? g?.grupo?.nome ?? "Desafio em grupo",
    data: p.dataEnvio ?? g?.dataCriacao,
    duracao: undefined,
    pontuacao: pontosGrupo(p),
  };
}

export async function historicoPontuacaoAtleta(req: AuthenticatedRequest, res: Response) {
  try {
    const atletaParam = req.params.id;

    const atleta = await prisma.atleta.findFirst({
      where: {
        OR: [{ id: atletaParam }, { usuarioId: atletaParam }],
      },
      select: { id: true },
    });

    if (!atleta) {
      return res.status(404).json({ message: "Atleta não encontrado." });
    }

    const plano = (req.user?.plano ?? "FREE") as PlanoAtleta;

    const defaultDias = plano === "FREE" ? 30 : 365;
    let { from, to } = getRangeFromQuery(req.query, defaultDias);

    validarJanelaAtleta(plano, from, to);

    const [subsTreino, subsDesafio] = await Promise.all([
      prisma.submissaoTreino.findMany({
        where: {
          atletaId: atleta.id,
          aprovado: true as any,
          criadoEm: { gte: from, lte: to },
        },
        include: {
          treinoAgendado: {
            include: {
              treinoProgramado: { include: { exercicios: true } },
            },
          },
        },
        orderBy: { criadoEm: "asc" },
      }),
      prisma.submissaoDesafio.findMany({
        where: {
          atletaId: atleta.id,
          aprovado: true as any,
          createdAt: { gte: from, lte: to },
        },
        include: { desafio: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const historicoTreinos = subsTreino.map((s: any) => {
      const dur =
        s.duracaoMinutos ??
        s.treinoAgendado?.treinoProgramado?.duracao ??
        null;

      const pts =
        s.pontosCreditados ??
        s.pontuacaoSnapshot ??
        s.treinoAgendado?.treinoProgramado?.pontuacao ??
        s.treinoAgendado?.treinoProgramado?.exercicios?.length ??
        0;

      const ts = +new Date(s.criadoEm);

      return {
        tipo: "Treino" as const,
        status: "Treino Concluído",
        data: new Date(ts).toLocaleDateString("pt-BR"),
        ts,
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        titulo:
          s.treinoAgendado?.treinoProgramado?.nome ??
          s.treinoAgendado?.titulo ??
          "Treino",
        pontuacao: Number(pts) || 0,
      };
    });

    const historicoDesafios = subsDesafio.map((s: any) => {
      const ts = +new Date(s.createdAt);
      return {
        tipo: "Desafio" as const,
        status: "Desafio Concluído",
        data: new Date(ts).toLocaleDateString("pt-BR"),
        ts,
        titulo: s.desafio?.titulo ?? "Desafio",
        pontuacao: pontosDesafioInd(s),
      };
    });

    const items = [...historicoTreinos, ...historicoDesafios]
      .sort((a, b) => a.ts - b.ts)
      .map(({ ts, ...rest }) => rest);

    return res.json({
      range: { from, to },
      items,
    });
  } catch (err: any) {
    if (err.code === "WINDOW_TOO_LARGE") {
      return res.status(422).json({
        code: err.code,
        message: err.message,
        limitDays: err.limiteDias,
      });
    }

    console.error("historicoPontuacaoAtleta", err);
    return res
      .status(500)
      .json({ message: "Erro ao buscar histórico de pontuação." });
  }
}

function mapGrupoToHistorico(p: any) {
  const g = p.desafioEmGrupo;
  const desafio = g?.desafioOficial;
  const ts = +new Date(p.dataEnvio ?? g?.dataCriacao ?? Date.now());
  return {
    tipo: "Desafio" as const,
    status: "Concluído (grupo)",
    data: new Date(ts).toLocaleDateString("pt-BR"),
    ts,
    titulo: desafio?.titulo ?? g?.grupo?.nome ?? "Desafio em grupo",
    pontuacao: pontosGrupo(p),
  };
}

async function resolveByUsuarioOrEntity(opts: {
  entity:
    | "professor"
    | "clube"
    | "escolinha"
    | "olheiro"
    | "federacao"
    | "marca"
    | "learning";
  usuarioOrEntityId: string;
  select: any;
}): Promise<any> {
  const { entity, usuarioOrEntityId, select } = opts;

  if (entity === "professor") {
    let row = await prisma.professor.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.professor.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "clube") {
    let row = await prisma.clube.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.clube.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "escolinha") {
    let row = await prisma.escolinha.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.escolinha.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "olheiro") {
    let row = await prisma.olheiro.findFirst({ where: { usuarioId: usuarioOrEntityId }, select });
    if (row) return row;
    row = await prisma.olheiro.findUnique({ where: { id: usuarioOrEntityId }, select });
    return row;
  }

  if (entity === "federacao") {
  let row = await prisma.federacao.findFirst({
    where: { usuarioId: usuarioOrEntityId },
    select,
  });
  if (row) return row;

  row = await prisma.federacao.findUnique({
    where: { id: usuarioOrEntityId },
    select,
  });
  return row;
  }

  if (entity === "marca") {
    let row = await prisma.marca.findFirst({
      where: { usuarioId: usuarioOrEntityId },
      select,
    });
    if (row) return row;

    row = await prisma.marca.findUnique({
      where: { id: usuarioOrEntityId },
      select,
    });
    return row;
  }

  if (entity === "learning") {
    let row = await prisma.learningProfile.findFirst({
      where: { usuarioId: usuarioOrEntityId },
      select,
    });
    if (row) return row;

    row = await prisma.learningProfile.findUnique({
      where: { id: usuarioOrEntityId },
      select,
    });
    return row;
  }

  return null;
}

async function countAtletasPorEntidade(opts: { escolinhaId?: string; clubeId?: string }) {
  const { escolinhaId, clubeId } = opts;

  const where: any = {
    atletaId: { not: null },
  };

  if (escolinhaId) {
    where.escolinhaId = escolinhaId;
  }

  if (clubeId) {
    where.clubeId = clubeId;
  }

  const relacoes = await prisma.relacaoTreinamento.findMany({
    where,
    select: { atletaId: true },
  });

  const idsUnicos = new Set<string>(
    relacoes
      .map((r) => r.atletaId!)
      .filter(Boolean)
  );

  return idsUnicos.size;
}

export const getPerfilUsuarioMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { ...(req as any).params, id };
  return getPerfilUsuario(req as any, res);
};

export const getPontuacaoMe = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const usuarioId = req.userId;

  if (!usuarioId) {
    return res.status(401).json({
      error: "Sem autenticação",
    });
  }

  (req as any).params = {
    usuarioId,
  };

  return getPontuacaoPerfil(
    req as any,
    res
  );
};

export const getAtividadesRecentesMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getAtividadesRecentes(req as any, res);
};

export const getBadgesMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getBadges(req as any, res);
};

export const getTreinosPorUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const treinos = await prisma.treinoRealizado.findMany({
      where: { usuarioId: id },
      include: { treino: true },
      orderBy: { dataExpiracao: "desc" },
    });

    const resultado = treinos.map((t: any) => ({
      titulo: t.treino?.nome || "Treino",
      dataExpiracao: t.dataExpiracao,
      local: t.local || "Local não informado",
    }));

    return res.json(resultado);
  } catch (err) {
    console.error("Erro ao buscar treinos:", err);
    return res.status(500).json({ message: "Erro ao buscar treinos." });
  }
};

export const getAtividadesRecentes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.params.id || "").trim();
    if (!userId) return res.json([]);

    const atividadesDb = await prisma.atividadeRecente.findMany({
      where: { usuarioId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, tipo: true, titulo: true, createdAt: true, imagemUrl: true, link: true },
    });

    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId: userId },
      select: { id: true },
    });

    const escolinha = await prisma.escolinha.findFirst({
      where: { OR: [{ usuarioId: userId }, { id: userId }] },
      select: { id: true, logo: true },
    });

    const clube = await prisma.clube.findFirst({
      where: { OR: [{ usuarioId: userId }, { id: userId }] },
      select: { id: true, logo: true },
    });

    if (!atleta && (escolinha || clube)) {
      const entidadeTipo = escolinha ? "escolinha" : "clube";
      const entidadeId = escolinha ? escolinha.id : clube!.id;
      const logo = escolinha ? escolinha.logo : clube!.logo;

      const [eventos, treinos] = await Promise.all([
        prisma.evento.findMany({
          where: entidadeTipo === "escolinha" ? { escolinhaId: entidadeId } : { clubeId: entidadeId },
          orderBy: { criadoEm: "desc" },
          take: 10,
          select: { id: true, titulo: true, criadoEm: true },
        }),
        prisma.treinoProgramado.findMany({
          where: entidadeTipo === "escolinha" ? { escolinhaId: entidadeId } : { clubeId: entidadeId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, nome: true, createdAt: true, imagemUrl: true },
        }),
      ]);


      type AtividadeComTs = (AtividadeUI & { ts: number });

      const itensComTs: AtividadeComTs[] = [
        ...eventos.map((e): AtividadeComTs => ({
          id: `ev-${e.id}`,
          tipo: "Evento",
          titulo: `Novo evento: ${e.titulo ?? "Evento"}`,
          createdAt: e.criadoEm.toISOString(),
          imagemUrl: logo ?? null,
          link: `/eventos/${e.id}`,
          ts: +e.criadoEm,
        })),

        ...treinos.map((t): AtividadeComTs => ({
          id: `tp-${t.id}`,
          tipo: "Treino",
          titulo: `Novo treino: ${t.nome ?? "Treino"}`,
          createdAt: t.createdAt.toISOString(),
          imagemUrl: t.imagemUrl ?? logo ?? null,
          link: `/treinos`,
          ts: +t.createdAt,
        })),
        ...atividadesDb.map((a): AtividadeComTs => ({
          id: `ar-${a.id}`,
          tipo: a.tipo ?? "Atividade",
          titulo: a.titulo ?? "Atividade",
          createdAt: a.createdAt.toISOString(),
          imagemUrl: a.imagemUrl ?? null,
          link: a.link ?? null,
          ts: +a.createdAt,
        })),
      ];

      function dedupKey(it: any) {
        const tipo = String(it.tipo ?? "").toLowerCase();

        const link = typeof it.link === "string" ? it.link : "";
        const m1 = link.match(/\/metodologias\/([0-9a-f-]+)/i);
        if (m1) return `metodologia:${m1[1]}`;

        const m2 = link.match(/\/eventos\/([0-9a-f-]+)/i);
        if (m2) return `evento:${m2[1]}`;

        return `${tipo}:${String(it.id ?? "")}`.toLowerCase();
      }

      const seen = new Set<string>();

      const dedup = itensComTs.filter((it) => {
        const key = dedupKey(it);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const itens: AtividadeUI[] = dedup
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 10)
        .map(({ ts, ...rest }) => rest);

      return res.json(itens);
    }

    if (!atleta) return res.json([]);

    const treinosLivres = await prisma.treinoLivre.findMany({
      where: { atletaId: atleta.id },
      orderBy: { data: "desc" },
      take: 10,
    });

    const subsTreino = await prisma.submissaoTreino.findMany({
      where: {
        atletaId: atleta.id,
        OR: [
          {
            treinoTituloSnapshot: {
              contains: "livre",
              mode: "insensitive",
            },
          },
          {
            AND: [
              { aprovado: true as any },
              {
                OR: [
                  { midiaUrl: { not: null } },
                  { observacao: { not: null } },
                  { midias: { some: {} } },
                ],
              },
            ],
          },
        ],
      },
      include: {
        treinoAgendado: {
          include: { treinoProgramado: { include: { exercicios: true } } },
        },
      },
      orderBy: { criadoEm: "desc" },
      take: 10,
    });

    const subsDesafio = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const parts = await getParticipacoesGrupo(userId, atleta.id);
    const itensGrupo = parts.map(mapGrupoToAtividade);

    type AtividadeComTs = AtividadeUI & { ts: number };

    const itensRaw: AtividadeComTs[] = [
      ...atividadesDb.map((a): AtividadeComTs => ({
        id: `ar-${a.id}`,
        tipo: a.tipo ?? "Atividade",
        titulo: a.titulo ?? "Atividade",
        createdAt: a.createdAt.toISOString(),
        imagemUrl: a.imagemUrl ?? null,
        link: a.link ?? null,
        ts: +a.createdAt,
      })),
      ...treinosLivres.map((t: any): AtividadeComTs => ({
        id: `tl-${t.id}`,
        tipo: "Treino Livre",
        titulo: t.descricao || "Treino Livre",
        createdAt: new Date(t.data).toISOString(),
        imagemUrl: t.urlEvidencia ?? null,
        link: "/treinos",
        ts: +new Date(t.data),
      })),

      ...subsTreino.map((s: any): AtividadeComTs => {
        const titulo =
          s.treinoAgendado?.treinoProgramado?.nome ??
          s.treinoAgendado?.titulo ??
          "Treino";

        const snapshot = String(s.treinoTituloSnapshot || "").toLowerCase();
        const isLivre = snapshot.includes("livre");

        const dt = s.criadoEm ?? new Date();

        return {
          id: `t-${s.id}`,
          tipo: isLivre ? "Treino Livre" : "Treino",
          titulo,
          createdAt: new Date(dt).toISOString(),
          imagemUrl: s.treinoAgendado?.treinoProgramado?.imagemUrl ?? null,
          link: "/treinos",
          ts: +new Date(dt),
        };
      }),

      ...subsDesafio.map((s: any): AtividadeComTs => {
        const dt = s.createdAt ?? new Date();
        return {
          id: `d-${s.id}`,
          tipo: "Desafio",
          titulo: s.desafio?.titulo ?? "Desafio",
          createdAt: new Date(dt).toISOString(),
          imagemUrl: s.desafio?.imagemUrl ?? s.videoUrl ?? null,
          link: "/explorar",
          ts: +new Date(dt),
        };
      }),

      ...itensGrupo.map((g: any): AtividadeComTs => {
        const dt = g.data ?? new Date();
        return {
          id: String(g.id),
          tipo: g.tipo ?? "Desafio",
          titulo: g.nome ?? "Atividade",
          createdAt: new Date(dt).toISOString(),
          imagemUrl: g.imagemUrl ?? null,
          link: "/explorar",
          ts: +new Date(dt),
        };
      }),
    ];

    const itens: AtividadeUI[] = itensRaw
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10)
      .map(({ ts, ...rest }) => rest);

    return res.json(itens);
  } catch (e) {
    console.error("[AtividadesRecentes] erro:", e);
    return res.status(500).json({ message: "Erro ao buscar atividades recentes." });
  }
};

export const getBadges = async (_req: Request, res: Response) => {
  try {
    const badges = [
      { id: "1", nome: "Disciplina", icon: "stopwatch" },
      { id: "2", nome: "Pontualidade", icon: "bullseye" },
      { id: "3", nome: "Liderança", icon: "medal" },
    ];

    res.json(badges);
  } catch (err) {
    console.error("Erro ao buscar badges:", err);
    res.status(500).json({ error: "Erro ao buscar badges." });
  }
};

async function calcularTotalAtualDoPerfil(
  usuarioId: string
): Promise<number | null> {
  const atleta = await prisma.atleta.findUnique({
    where: {
      usuarioId,
    },

    select: {
      pontosTotal: true,

      pontuacao: {
        select: {
          pontuacaoTotal: true,
        },
      },
    },
  });

  if (!atleta) {
    return null;
  }

  return Number(
    atleta.pontuacao?.pontuacaoTotal ??
    atleta.pontosTotal ??
    0
  );
}

export async function getPontuacaoPerfil(req: Request, res: Response) {
  const { usuarioId } = req.params as { usuarioId: string };

  try {
    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: {
        id: true,
        pontosTotal: true,

        pontuacao: {
          select: {
            pontuacaoTotal: true,
            pontuacaoPerformance: true,
            pontuacaoDisciplina: true,
            pontuacaoResponsabilidade: true,
          },
        },
      },
    });
    if (!atleta) {
      return res.json({
        performance: 0,
        disciplina: 0,
        responsabilidade: 0,
        historico: [],
        videos: [],
      });
    }

    const subsTreino = await prisma.submissaoTreino.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: {
        treinoAgendado: {
          include: { treinoProgramado: { include: { exercicios: true } } },
        },
      },
      orderBy: { criadoEm: "desc" },
    });

    const agIds = Array.from(new Set(subsTreino.map((s) => s.treinoAgendadoId).filter(Boolean)));
    const agRows = agIds.length
      ? await prisma.treinoAgendado.findMany({
          where: { id: { in: agIds } },
          select: {
            id: true,
            treinoProgramado: { select: { pontuacao: true, exercicios: true, duracao: true, nome: true } },
          },
        })
      : [];
    const progPontuacaoMap = new Map<
      string,
      { pontuacao: number; exerciciosCount: number }
    >(agRows.map((r) => [r.id, { pontuacao: r.treinoProgramado?.pontuacao ?? 0, exerciciosCount: r.treinoProgramado?.exercicios?.length ?? 0 }]));

    const historicoTreinos = subsTreino.map((s: any) => {
      const fromCredit = Number(s.pontosCreditados ?? 0);
      const fromSnap = Number(s.pontuacaoSnapshot ?? 0);
      const fromIncludeProg = Number(s.treinoAgendado?.treinoProgramado?.pontuacao ?? 0);
      const fromIncludeExLen = Number(s.treinoAgendado?.treinoProgramado?.exercicios?.length ?? 0);
      const fromMap = s.treinoAgendadoId && progPontuacaoMap.has(s.treinoAgendadoId) ? progPontuacaoMap.get(s.treinoAgendadoId)!.pontuacao : 0;
      const fromMapEx = s.treinoAgendadoId && progPontuacaoMap.has(s.treinoAgendadoId) ? progPontuacaoMap.get(s.treinoAgendadoId)!.exerciciosCount : 0;

      const pontos =
        fromCredit > 0 ? fromCredit :
        fromSnap > 0 ? fromSnap :
        fromIncludeProg > 0 ? fromIncludeProg :
        fromMap > 0 ? fromMap :
        fromIncludeExLen > 0 ? fromIncludeExLen :
        fromMapEx > 0 ? fromMapEx : 0;

      const dur = s.duracaoMinutos ?? s.treinoAgendado?.treinoProgramado?.duracao ?? null;
      const titulo = s.treinoAgendado?.treinoProgramado?.nome ?? s.treinoAgendado?.titulo ?? "Treino";

      return {
        tipo: "Treino" as const,
        status: "Concluído",
        data: new Date(s.criadoEm ?? Date.now()).toLocaleDateString("pt-BR"),
        ts: +new Date(s.criadoEm ?? Date.now()),
        duracao: typeof dur === "number" && dur > 0 ? `${dur} min` : undefined,
        titulo,
        pontuacao: Number(pontos) || 0,
      };
    });

    const subsDesafio = await prisma.submissaoDesafio.findMany({
      where: { atletaId: atleta.id, aprovado: true as any },
      include: { desafio: true },
      orderBy: { createdAt: "desc" },
    });

    const historicoDesafios = subsDesafio.map((s: any) => ({
      tipo: "Desafio" as const,
      status: "Concluído",
      data: new Date(s.createdAt ?? Date.now()).toLocaleDateString("pt-BR"),
      ts: +new Date(s.createdAt ?? Date.now()),
      titulo: s.desafio?.titulo ?? "Desafio",
      pontuacao: Number(s.desafio?.pontuacao ?? 0),
    }));

    const disciplinaFromHistorico = historicoTreinos.length * 2;

    const parts = await getParticipacoesGrupo(usuarioId, atleta.id);
    const historicoGrupo = parts.map(mapGrupoToHistorico);

    const historico = [...historicoTreinos, ...historicoDesafios, ...historicoGrupo]
      .sort((a, b) => (b as any).ts - (a as any).ts)
      .slice(0, 20)
      .map(({ ts, ...rest }) => rest);

    const performanceFromHistorico = historico.reduce(
      (acc: number, h: any) => acc + (Number((h as any).pontuacao) || 0),
      0
    );
    const responsabilidadeFromHistorico = (historicoDesafios.length + historicoGrupo.length) * 2;

    const postagensVideo = await prisma.postagem.findMany({
      where: { usuarioId, videoUrl: { not: null } },
      select: { videoUrl: true },
      orderBy: { dataCriacao: "desc" },
      take: 30,
    });

    const videos = postagensVideo.flatMap((p) => (p.videoUrl ? [p.videoUrl] : []));

    const performanceAtual =
      Number(
        atleta.pontuacao?.pontuacaoPerformance ??
        performanceFromHistorico ??
        0
      );

    const disciplinaAtual =
      Number(
        atleta.pontuacao?.pontuacaoDisciplina ??
        disciplinaFromHistorico ??
        0
      );

    const responsabilidadeAtual =
      Number(
        atleta.pontuacao?.pontuacaoResponsabilidade ??
        responsabilidadeFromHistorico ??
        0
      );

    const totalCalculado =
      performanceAtual +
      disciplinaAtual +
      responsabilidadeAtual;

    const totalAtual =
      Number(
        atleta.pontuacao?.pontuacaoTotal ??
        totalCalculado ??
        atleta.pontosTotal ??
        0
      );

    return res.json({
      totalAtual,

      performance: performanceAtual,
      disciplina: disciplinaAtual,
      responsabilidade: responsabilidadeAtual,

      historico,
      videos,
    });
  } catch (err) {
    console.error("getPontuacaoPerfil error:", err);
    return res.status(500).json({ message: "Erro ao carregar pontuação." });
  }
}

export async function getDeltaPontuacaoPerfil(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const viewerUsuarioId =
      String(
        (req as any).userId ??
        (req as any).user?.id ??
        ""
      ).trim();

    const perfilUsuarioId =
      String(
        req.params.usuarioId ??
        ""
      ).trim();

    if (!viewerUsuarioId) {
      return res
        .status(401)
        .json({
          error:
            "Usuário não autenticado.",
        });
    }

    if (!perfilUsuarioId) {
      return res
        .status(400)
        .json({
          error:
            "Perfil não informado.",
        });
    }

    if (
      viewerUsuarioId ===
      perfilUsuarioId
    ) {
      return res.json({
        delta: 0,
        primeiraVisualizacao: false,
        proprioPerfil: true,
        registrarVisualizacao: false,
      });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        perfilUsuarioId
      );

    if (!acesso) {
      return;
    }

    const totalAtual =
      await calcularTotalAtualDoPerfil(
        perfilUsuarioId
      );

    if (totalAtual === null) {
      return res.json({
        delta: 0,
        primeiraVisualizacao: true,
        proprioPerfil: false,
        registrarVisualizacao: false,
      });
    }

    const anterior =
      await prisma
        .perfilPontuacaoVisualizacao
        .findUnique({
          where: {
            viewerUsuarioId_perfilUsuarioId:
              {
                viewerUsuarioId,
                perfilUsuarioId,
              },
          },
        });

    if (!anterior) {
      return res.json({
        delta: 0,
        totalAtual,
        primeiraVisualizacao: true,
        proprioPerfil: false,
        registrarVisualizacao: true,
      });
    }

    const delta =
      totalAtual -
      anterior.ultimaPontuacaoVista;

    return res.json({
      delta,
      totalAtual,

      ultimaPontuacaoVista:
        anterior
          .ultimaPontuacaoVista,

      visualizadoEm:
        anterior.visualizadoEm,

      primeiraVisualizacao:
        false,

      proprioPerfil: false,

      registrarVisualizacao:
        true,
    });
  } catch (error) {
    console.error(
      "[getDeltaPontuacaoPerfil]",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao calcular evolução da pontuação.",
      });
  }
}

export async function confirmarVisualizacaoPontuacaoPerfil(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const viewerUsuarioId =
      String(
        (req as any).userId ??
        (req as any).user?.id ??
        ""
      ).trim();

    const perfilUsuarioId =
      String(
        req.params.usuarioId ??
        ""
      ).trim();

    if (!viewerUsuarioId) {
      return res
        .status(401)
        .json({
          error:
            "Usuário não autenticado.",
        });
    }

    if (!perfilUsuarioId) {
      return res
        .status(400)
        .json({
          error:
            "Perfil não informado.",
        });
    }

    if (
      viewerUsuarioId ===
      perfilUsuarioId
    ) {
      return res.json({
        ok: true,
        proprioPerfil: true,
      });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        perfilUsuarioId
      );

    if (!acesso) {
      return;
    }

    const totalAtual =
      await calcularTotalAtualDoPerfil(
        perfilUsuarioId
      );

    if (totalAtual === null) {
      return res.json({
        ok: true,
        registrado: false,
      });
    }

    const agora =
      new Date();

    await prisma
      .perfilPontuacaoVisualizacao
      .upsert({
        where: {
          viewerUsuarioId_perfilUsuarioId:
            {
              viewerUsuarioId,
              perfilUsuarioId,
            },
        },

        create: {
          viewerUsuarioId,
          perfilUsuarioId,

          ultimaPontuacaoVista:
            totalAtual,

          visualizadoEm:
            agora,
        },

        update: {
          ultimaPontuacaoVista:
            totalAtual,

          visualizadoEm:
            agora,
        },
      });

    return res.json({
      ok: true,
      registrado: true,
      totalRegistrado:
        totalAtual,
    });
  } catch (error) {
    console.error(
      "[confirmarVisualizacaoPontuacaoPerfil]",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Erro ao registrar visualização da pontuação.",
      });
  }
}

export const getPerfilUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        foto: true,
        nomeDeUsuario: true,
        verified: true,
        configuracoesPrivacidade: true,
        cep: true,
        cidade: true,
        estado: true,
        pais: true,
        logradouro: true,
        cpf: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const viewerId = (req as any)?.userId ? String((req as any).userId) : null;
    const isOwnProfile = !!viewerId && viewerId === usuario.id;
    const isAdmin = isAdminFromReq(req);
    const acesso =
      await avaliarPrivacidadePerfil(
        viewerId,
        usuario.id
      );

    if (!acesso.podeVerPerfil) {
      return res.status(403).json({
        code: "PROFILE_PRIVATE",
        message:
          "Este perfil está privado e disponível apenas para pessoas vinculadas.",
      });
    }

    let dadosEspecificos: any = null;
    let tipoPerfil: "Atleta" | "Professor" | "Clube" | "Escolinha" | "Olheiro" | "Federacao" | "Marca" | "Learning" | null = null;
    let vinculos: any = null;

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      select: {
        id: true,
        nome: true,
        sobrenome: true,
        idade: true,
        pontosTotal: true,
        pontuacao: {
          select: {
            pontuacaoTotal: true,
          },
        },
        email: true,
        telefone1: true,
        telefone2: true,
        nacionalidade: true,
        naturalidade: true,
        posicao: true,
        altura: true,
        peso: true,
        seloQualidade: true,
        foto: true,
        categoria: true,
        escolinhaId: true,
        clubeId: true,
      },
    });

    if (atleta) {
      const vinculosRows = await prisma.relacaoTreinamento.findMany({
        where: { atletaId: atleta.id, encerradoEm: null },
        include: {
          professor: { select: { id: true, nome: true } },
          escolinha: { select: { id: true, nome: true } },
          clube: { select: { id: true, nome: true } },
        },
      });

      let escolaMin: { id: string; nome: string } | null = null;
      let clubeMin: { id: string; nome: string } | null = null;

      const profsMap = new Map<string, { id: string; nome: string }>();
      for (const v of vinculosRows) {
        if (v.professor?.id) profsMap.set(v.professor.id, v.professor);
        if (v.escolinha) escolaMin = v.escolinha;
        if (v.clube) clubeMin = v.clube;
      }

      const professores = Array.from(profsMap.values());
      const professorPrincipal = professores[0] ?? null;

      dadosEspecificos = {
        atletaId: atleta.id,
        nome: atleta.nome,
        sobrenome: atleta.sobrenome,
        idade: atleta.idade,
        email: atleta.email,
        telefone1: atleta.telefone1,
        nacionalidade: atleta.nacionalidade,
        naturalidade: atleta.naturalidade,
        posicao: atleta.posicao,
        altura: atleta.altura,
        peso: atleta.peso,
        seloQualidade: atleta.seloQualidade,
        foto: atleta.foto,
        escola: escolaMin?.nome ?? null,
        clube: clubeMin?.nome ?? null,
        professor: professorPrincipal?.nome ?? null,
        professores: professores,
        professorIds: professores.map((p) => p.id),
        categoria: atleta.categoria,
      };

      tipoPerfil = "Atleta";

      vinculos = {
        escolinhaId: atleta.escolinhaId ?? null,
        clubeId: atleta.clubeId ?? null,
        professorId: professorPrincipal?.id ?? null,
        professor: professorPrincipal,
        professores,
        professoresIds: professores.map((p) => p.id),
        escola: escolaMin,
        clube: clubeMin,
      };
    }

    const professor = await prisma.professor.findUnique({ where: { usuarioId: id } });
    if (professor) {
      dadosEspecificos = {
        nome: professor.nome,
        codigo: professor.codigo,
        cref: professor.cref,
        areaFormacao: professor.areaFormacao,
        escola: professor.escola,
        qualificacoes: professor.qualificacoes,
        certificacoes: professor.certificacoes,
        foto: professor.fotoUrl,
      };
      tipoPerfil = "Professor";
    }

    const escolinha = await prisma.escolinha.findUnique({ where: { usuarioId: id } });
    if (escolinha) {
      dadosEspecificos = {
        nome: escolinha.nome,
        email: escolinha.email,
        cnpj: escolinha.cnpj,
        telefone1: escolinha.telefone1,
        telefone2: escolinha.telefone2,
        logo: escolinha.logo,
        siteOficial: escolinha.siteOficial,
        logradouro: escolinha.logradouro ?? null,
        cidade: escolinha.cidade ?? null,
        estado: escolinha.estado ?? null,
        pais: escolinha.pais ?? null,
        cep: escolinha.cep ?? null,
      };
      tipoPerfil = "Escolinha";
    }

    const clube = await prisma.clube.findUnique({ where: { usuarioId: id } });
      if (clube) {
        dadosEspecificos = {
          nome: clube.nome,
          email: clube.email,
          cnpj: clube.cnpj,
          telefone1: clube.telefone1,
          telefone2: clube.telefone2,
          estadio: clube.estadio,
          logo: clube.logo,
          siteOficial: clube.siteOficial,
          logradouro: clube.logradouro ?? null,
          cidade: clube.cidade ?? null,
          estado: clube.estado ?? null,
          pais: clube.pais ?? null,
          cep: clube.cep ?? null,
          categorias: Array.isArray((clube as any).categorias) ? (clube as any).categorias : [],
        };
        tipoPerfil = "Clube";
      }

    const olheiro = await prisma.olheiro.findUnique({
      where: { usuarioId: id },
      select: {
        id: true,
        fotoUrl: true,
        headline: true,
        areaAtuacao: true,
        anosExperiencia: true,
        descricao: true,
        emailPublico: true,
        telefonePublico: true,
        colaboracaoClube: { select: { id: true, nome: true, logo: true, usuarioId: true } },
      },
    });

    if (olheiro) {
      dadosEspecificos = {
        id: olheiro.id,
        foto: olheiro.fotoUrl,
        headline: olheiro.headline,
        areaAtuacao: olheiro.areaAtuacao,
        anosExperiencia: olheiro.anosExperiencia,
        descricao: olheiro.descricao,
        emailPublico: olheiro.emailPublico,
        telefonePublico: olheiro.telefonePublico,
        colaboracaoClube: olheiro.colaboracaoClube
          ? { id: olheiro.colaboracaoClube.id, nome: olheiro.colaboracaoClube.nome, logo: olheiro.colaboracaoClube.logo }
          : null,
      };
      tipoPerfil = "Olheiro";
    }

    if (!tipoPerfil) {
      const olheiro2 = await prisma.olheiro.findUnique({
        where: { usuarioId: id },
        select: {
          id: true,
          fotoUrl: true,
          headline: true,
          areaAtuacao: true,
          anosExperiencia: true,
        },
      });
      if (olheiro2) {
        dadosEspecificos = {
          id: olheiro2.id,
          foto: olheiro2.fotoUrl,
          headline: olheiro2.headline,
          areaAtuacao: olheiro2.areaAtuacao,
          anosExperiencia: olheiro2.anosExperiencia,
        };
        tipoPerfil = "Olheiro";
      }
    }

    if (!tipoPerfil) {
      const federacao = await prisma.federacao.findFirst({
        where: { OR: [{ usuarioId: id }, { id }] },
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          email: true,
          cnpj: true,
          telefone1: true,
          telefone2: true,
          siteOficial: true,
          sede: true,
          cidade: true,
          estado: true,
          pais: true,
          cep: true,
          logo: true,
          descricao: true,
        },
      });

      if (federacao) {
        dadosEspecificos = {
          id: federacao.id,
          nome: federacao.nome,
          email: federacao.email,
          cnpj: federacao.cnpj,
          telefone1: federacao.telefone1,
          telefone2: federacao.telefone2,
          siteOficial: federacao.siteOficial,
          sede: federacao.sede,
          cidade: federacao.cidade,
          estado: federacao.estado,
          pais: federacao.pais,
          cep: federacao.cep,
          logo: federacao.logo,
          descricao: federacao.descricao,
        };

        tipoPerfil = "Federacao";
      }
    }

    if (!tipoPerfil) {
      const marca = await prisma.marca.findFirst({
        where: { OR: [{ usuarioId: id }, { id }] },
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          email: true,
          cnpj: true,
          telefone1: true,
          telefone2: true,
          siteOficial: true,
          sede: true,
          cidade: true,
          estado: true,
          pais: true,
          cep: true,
          logo: true,
          descricao: true,
        },
      });

      if (marca) {
        dadosEspecificos = {
          id: marca.id,
          nome: marca.nome,
          email: marca.email,
          cnpj: marca.cnpj,
          telefone1: marca.telefone1,
          telefone2: marca.telefone2,
          siteOficial: marca.siteOficial,
          cidade: marca.cidade,
          estado: marca.estado,
          pais: marca.pais,
          cep: marca.cep,
          logo: marca.logo,
          sede: marca.sede,
          descricao: marca.descricao,
        };

        tipoPerfil = "Marca";
      }
    }

    if (!tipoPerfil) {
      const learning = await prisma.learningProfile.findFirst({
        where: { OR: [{ usuarioId: id }, { id }] },
        select: {
          id: true,
          usuarioId: true,
          bio: true,
          objetivo: true,
          interesses: true,
          criadoEm: true,
          updatedAt: true,
        },
      });

      if (learning) {
        dadosEspecificos = {
          id: learning.id,
          learningProfileId: learning.id,
          usuarioId: learning.usuarioId,
          bio: learning.bio ?? null,
          objetivo: learning.objetivo ?? null,
          interesses: Array.isArray(learning.interesses) ? learning.interesses : [],
          criadoEm: learning.criadoEm,
          updatedAt: learning.updatedAt,
        };

        tipoPerfil = "Learning";
      }
    }

  if (
    dadosEspecificos &&
    !acesso.podeMostrarEmail
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        dadosEspecificos,
        "email"
      )
    ) {
      dadosEspecificos.email = null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        dadosEspecificos,
        "emailPublico"
      )
    ) {
      dadosEspecificos.emailPublico = null;
    }
  }

  const usuarioPayload: any = {
    id: usuario.id,
    nome: usuario.nome,
    nomeDeUsuario: usuario.nomeDeUsuario,
    email: acesso.podeMostrarEmail
      ? usuario.email
      : null,
    foto: usuario.foto,
    verified: (usuario as any).verified ?? false, 
  };

  if (isOwnProfile) {
    usuarioPayload.cep = usuario.cep;
    usuarioPayload.cidade = usuario.cidade;
    usuarioPayload.estado = usuario.estado;
    usuarioPayload.pais = usuario.pais;
    usuarioPayload.logradouro = (usuario as any).logradouro ?? null;
    usuarioPayload.cpf = (usuario as any).cpf ?? null;
  }

  const fotoBase =
    absUrl(usuario.foto) ||
    (tipoPerfil === "Clube" ? absUrl((clube as any)?.logo) : null) ||
    (tipoPerfil === "Escolinha" ? absUrl((escolinha as any)?.logo) : null) ||
    (tipoPerfil === "Professor" ? absUrl((professor as any)?.fotoUrl) : null) ||
    (tipoPerfil === "Atleta" ? absUrl((atleta as any)?.foto) : null) ||
    (tipoPerfil === "Olheiro" ? absUrl((olheiro as any)?.fotoUrl) : null) ||
    (tipoPerfil === "Federacao" ? absUrl((dadosEspecificos as any)?.logo) : null) ||
    (tipoPerfil === "Marca" ? absUrl((dadosEspecificos as any)?.logo) : null) ||
    null;

  const perfilVerificado = calcularPerfilVerificado({
    usuario: {
      verified: (usuario as any).verified,
      nome: usuario.nome ?? null,
      nomeDeUsuario: usuario.nomeDeUsuario ?? null,
      email: usuario.email ?? null,
      foto: fotoBase,
    },
    tipo: String(tipoPerfil ?? "").toLowerCase(),

    atleta: tipoPerfil === "Atleta" ? {
      posicao: atleta?.posicao ?? null,
      categoria: atleta?.categoria ?? null,
      idade: atleta?.idade ?? null,
      telefone1: atleta?.telefone1 ?? null,
      nacionalidade: atleta?.nacionalidade ?? null,
      naturalidade: atleta?.naturalidade ?? null,
      altura: atleta?.altura ?? null,
      peso: atleta?.peso ?? null,
      seloQualidade: atleta?.seloQualidade ?? null,
    } : null,

    professor: tipoPerfil === "Professor" ? {
      areaFormacao: (professor as any)?.areaFormacao ?? null,
      cref: (professor as any)?.cref ?? null,
      statusCref: (professor as any)?.statusCref ?? null,
      dataNascimento: (professor as any)?.dataNascimento ?? null,
      escola: (professor as any)?.escola ?? null,
      qualificacoes: (professor as any)?.qualificacoes ?? null,
      certificacoes: (professor as any)?.certificacoes ?? null,
      fotoUrl: absUrl((professor as any)?.fotoUrl) ?? null,
    } : null,

    clube: tipoPerfil === "Clube" ? {
      nome: (clube as any)?.nome ?? null,
      cnpj: (clube as any)?.cnpj ?? null,
      email: (clube as any)?.email ?? usuario.email ?? null,
      telefone1: (clube as any)?.telefone1 ?? null,
      siteOficial: (clube as any)?.siteOficial ?? null,
      sede: (clube as any)?.sede ?? null,
      cidade: (clube as any)?.cidade ?? null,
      estado: (clube as any)?.estado ?? null,
      bairro: (clube as any)?.bairro ?? null,
      pais: (clube as any)?.pais ?? null,
      cep: (clube as any)?.cep ?? null,
      logo: absUrl((clube as any)?.logo) ?? null,
    } : null,

    escolinha: tipoPerfil === "Escolinha" ? {
      nome: (escolinha as any)?.nome ?? null,
      cnpj: (escolinha as any)?.cnpj ?? null,
      email: (escolinha as any)?.email ?? usuario.email ?? null,
      telefone1: (escolinha as any)?.telefone1 ?? null,
      siteOficial: (escolinha as any)?.siteOficial ?? null,
      cidade: (escolinha as any)?.cidade ?? null,
      estado: (escolinha as any)?.estado ?? null,
      bairro: (escolinha as any)?.bairro ?? null,
      pais: (escolinha as any)?.pais ?? null,
      cep: (escolinha as any)?.cep ?? null,
      logo: absUrl((escolinha as any)?.logo) ?? null,
    } : null,

    olheiro: tipoPerfil === "Olheiro" ? {
      areaAtuacao: (olheiro as any)?.areaAtuacao ?? null,
      anosExperiencia: Number.isFinite(Number((olheiro as any)?.anosExperiencia))
        ? Number((olheiro as any)?.anosExperiencia)
        : null,
      emailPublico: (olheiro as any)?.emailPublico ?? null,
      telefonePublico: (olheiro as any)?.telefonePublico ?? null,
      descricao: (olheiro as any)?.descricao ?? null,
      fotoUrl: absUrl((olheiro as any)?.fotoUrl) ?? null,
    } : null,
  });

  return res.json({
    tipo: tipoPerfil,
    usuario: usuarioPayload,
    dadosEspecificos,
    vinculos,
    perfilVerificado,
    pontuacaoTotal:
      tipoPerfil === "Atleta"
        ? Number(
            atleta?.pontuacao?.pontuacaoTotal ??
            atleta?.pontosTotal ??
            0
          )
        : 0,
  });
    } catch (error) {
      console.error("Erro ao buscar perfil:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

export const atualizarPerfil = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userIdFromToken = req.userId;

  if (!userIdFromToken || id !== userIdFromToken) {
    return res.status(403).json({ error: "Você só pode editar o seu próprio perfil." });
  }

  let { usuario, tipo, tipoUsuario } = req.body;

  try {
    if (typeof usuario === "string") {
      try {
        usuario = JSON.parse(usuario);
      } catch (e) {
        return res.status(400).json({ error: "Dados do usuário em formato inválido." });
      }
    }
    if (typeof tipo === "string") {
      try {
        tipo = JSON.parse(tipo);
      } catch (e) {
        return res.status(400).json({ error: "Dados do tipo de perfil em formato inválido." });
      }
    }

    if (!usuario || !tipoUsuario) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    if (!tipo || typeof tipo !== "object") {
      tipo = {};
    }

    const usuarioAtual = await prisma.usuario.findUnique({
      where: { id },
      select: { foto: true },
    });

    const file = req.file as any; 
    let fotoFinal: string | null = usuarioAtual?.foto ?? null;

    if (file && file.location) {
      fotoFinal = file.location;
      if (usuarioAtual?.foto && usuarioAtual.foto.includes("amazonaws.com")) {
        await deleteFromS3(usuarioAtual.foto);
      }
    } else if (usuario.foto === null) {
      fotoFinal = null;
      if (usuarioAtual?.foto && usuarioAtual.foto.includes("amazonaws.com")) {
        await deleteFromS3(usuarioAtual.foto);
      }
    }

    const raw = typeof usuario?.nomeDeUsuario === "string" ? usuario.nomeDeUsuario.trim() : "";
    const novoUsername = raw ? raw.toLowerCase() : null;

    if (novoUsername && !/^[a-z0-9._]{3,30}$/.test(novoUsername)) {
      return res.status(400).json({ error: "Nome de usuário inválido." });
    }

    if (novoUsername) {
      const existe = await prisma.usuario.findFirst({
        where: { nomeDeUsuario: novoUsername, NOT: { id } },
        select: { id: true },
      });
      if (existe) return res.status(400).json({ error: "Esse nome de usuário já está em uso." });
    }

    const cepDigits = usuario?.cep != null ? String(usuario.cep).replace(/\D/g, "") : "";

    await prisma.usuario.update({
      where: { id },
      data: {
        nome: usuario.nome,
        email: usuario.email,
        nomeDeUsuario: novoUsername,
        foto: fotoFinal,
        cep: cepDigits || null,
        cidade: usuario.cidade ?? null,
        estado: usuario.estado ?? null,
        pais: usuario.pais ?? null,
        logradouro: usuario.logradouro ?? null,
        cpf: usuario.cpf ?? null,
      },
    });

    const tipoKey = String(tipoUsuario).toLowerCase();
    const tipoNorm = tipoKey === "escolinha" ? "escola" : tipoKey;

    switch (tipoNorm) {
      case "atleta": {
        const rawEscolinha = tipo.escolinhaId ?? tipo.escolaId ?? tipo.escolinha ?? tipo.escola ?? null;
        const rawClube = tipo.clubeId ?? tipo.clube ?? null;
        const escolinhaId = pickId(rawEscolinha);
        const clubeId = pickId(rawClube);
        const limparEscolinha = !rawEscolinha || String(rawEscolinha).toLowerCase() === "nenhum";
        const limparClube = !rawClube || String(rawClube).toLowerCase() === "nenhum";
        const rawProfessorMulti = tipo.professorIds ?? tipo.professoresIds ?? null;
        const rawProfessorSingle = tipo.professorId ?? tipo.professor ?? null;
        const professorIds = Array.from(new Set([...pickIds(rawProfessorMulti), ...(pickId(rawProfessorSingle) ? [pickId(rawProfessorSingle)!] : [])])).filter(Boolean);
        const data: any = {
          nome: tipo.nome,
          sobrenome: tipo.sobrenome,
          idade: parseInt(tipo.idade) || undefined,
          posicao: tipo.posicao,
          altura: parseFloat(tipo.altura) || undefined,
          peso: parseFloat(tipo.peso) || undefined,
          foto: fotoFinal,
          escolinhaId: limparEscolinha ? null : escolinhaId,
          clubeId: limparClube ? null : clubeId,
        };

        const atletaRow = await prisma.atleta.findUnique({ where: { usuarioId: id }, select: { id: true } });
        if (!atletaRow) return res.status(404).json({ error: "Atleta não encontrado." });

        await prisma.$transaction(async (tx: any) => {
          await tx.atleta.update({
            where: { usuarioId: id },
            data: {
              ...data,
              clubeId: undefined,
              escolinhaId: undefined,
            },
          });

          const atuais = await tx.relacaoTreinamento.findMany({
            where: {
              atletaId: atletaRow.id,
              ativo: true,
              encerradoEm: null,
            },
            select: {
              id: true,
              professorId: true,
              clubeId: true,
              escolinhaId: true,
            },
          });

          const atuaisProfessorIds = atuais.map((r: any) => r.professorId).filter(Boolean);
          const atualClubeId = atuais.find((r: any) => r.clubeId)?.clubeId ?? null;
          const atualEscolinhaId = atuais.find((r: any) => r.escolinhaId)?.escolinhaId ?? null;

          const professorIdsRemover = atuaisProfessorIds.filter(
            (profId: string) => !professorIds.includes(profId)
          );

          if (professorIdsRemover.length > 0) {
            await tx.relacaoTreinamento.updateMany({
              where: {
                atletaId: atletaRow.id,
                professorId: { in: professorIdsRemover },
                ativo: true,
                encerradoEm: null,
              },
              data: {
                ativo: false,
                encerradoEm: new Date(),
              },
            });
          }

          if (limparClube && atualClubeId) {
            await tx.relacaoTreinamento.updateMany({
              where: {
                atletaId: atletaRow.id,
                clubeId: atualClubeId,
                ativo: true,
                encerradoEm: null,
              },
              data: {
                ativo: false,
                encerradoEm: new Date(),
              },
            });

            await tx.atleta.update({
              where: { id: atletaRow.id },
              data: { clubeId: null },
            });
          }

          if (limparEscolinha && atualEscolinhaId) {
            await tx.relacaoTreinamento.updateMany({
              where: {
                atletaId: atletaRow.id,
                escolinhaId: atualEscolinhaId,
                ativo: true,
                encerradoEm: null,
              },
              data: {
                ativo: false,
                encerradoEm: new Date(),
              },
            });

            await tx.atleta.update({
              where: { id: atletaRow.id },
              data: { escolinhaId: null },
            });
          }

          async function criarSolicitacaoSeNaoExiste(destinatarioUsuarioId: string) {
            const existe = await tx.solicitacaoTreino.findFirst({
              where: {
                remetenteId: id,
                destinatarioId: destinatarioUsuarioId,
                status: {
                  in: ["pendente", "ativa"]
                }
              }
            });

            if (!existe) {
              await tx.solicitacaoTreino.create({
                data: {
                  remetenteId: id,
                  destinatarioId: destinatarioUsuarioId,
                  status: "pendente"
                }
              });
            }
          }

          for (const professorId of professorIds) {
            if (atuaisProfessorIds.includes(professorId)) continue;

            const prof = await tx.professor.findUnique({
              where: { id: professorId },
              select: { usuarioId: true },
            });

            if (prof?.usuarioId) {
              await criarSolicitacaoSeNaoExiste(prof.usuarioId);
            }
          }

          if (!limparClube && clubeId && clubeId !== atualClubeId) {
            const clube = await tx.clube.findUnique({
              where: { id: clubeId },
              select: { usuarioId: true },
            });

            if (clube?.usuarioId) {
              await criarSolicitacaoSeNaoExiste(clube.usuarioId);
            }
          }

          if (!limparEscolinha && escolinhaId && escolinhaId !== atualEscolinhaId) {
            const escolinha = await tx.escolinha.findUnique({
              where: { id: escolinhaId },
              select: { usuarioId: true },
            });

            if (escolinha?.usuarioId) {
              await criarSolicitacaoSeNaoExiste(escolinha.usuarioId);
            }
          }
        });
        break;
      }

      case "professor":
        await prisma.professor.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            cref: tipo.cref,
            areaFormacao: tipo.areaFormacao,
            escola: tipo.escola,
            qualificacoes: Array.isArray(tipo.qualificacoes) ? tipo.qualificacoes : tipo.qualificacoes?.split(",").map((q: any) => q.trim()),
            certificacoes: Array.isArray(tipo.certificacoes) ? tipo.certificacoes : tipo.certificacoes?.split(",").map((c: any) => c.trim()),
            fotoUrl: fotoFinal,
          },
        });
        break;

      case "clube":
        await prisma.clube.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2 ?? null,
            email: tipo.email,
            siteOficial: tipo.siteOficial,
            sede: tipo.sede ?? null,
            estadio: tipo.estadio ?? null,
            cnpj: tipo.cnpj ?? null,
            logradouro: usuario.logradouro ?? null,
            cidade: usuario.cidade ?? null,
            estado: usuario.estado ?? null,
            pais: usuario.pais ?? null,
            cep: cepDigits || null,
            logo: fotoFinal,
            descricao: tipo.descricao ?? null,
            categorias: Array.isArray(tipo.categorias)
              ? { set: normalizarCategorias(tipo.categorias) }
              : undefined,
          },
        });
        break;

      case "olheiro":
        const anos = typeof tipo.anosExperiencia === "string" ? Number(tipo.anosExperiencia) : tipo.anosExperiencia;
        await prisma.olheiro.update({
          where: { usuarioId: id },
          data: {
            headline: tipo.headline,
            descricao: tipo.descricao,
            areaAtuacao: tipo.areaAtuacao,
            anosExperiencia: Number.isFinite(anos) ? anos : undefined,
            fotoUrl: fotoFinal,
            emailPublico: tipo.emailPublico,
            telefonePublico: tipo.telefonePublico,
          },
        });
        break;

      case "escola":
      case "escolinha":
        await prisma.escolinha.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2 ?? null,
            email: tipo.email,
            siteOficial: tipo.siteOficial,
            sede: tipo.sede ?? null,
            cnpj: tipo.cnpj ?? null,
            logradouro: usuario.logradouro ?? null,
            cidade: usuario.cidade ?? null,
            estado: usuario.estado ?? null,
            pais: usuario.pais ?? null,
            cep: cepDigits || null,
            logo: fotoFinal,
            descricao: tipo.descricao ?? null,
            categorias: Array.isArray(tipo.categorias)
              ? { set: normalizarCategorias(tipo.categorias) }
              : undefined,
          },
        });
      break;

      case "learning": {
        const interesses =
          Array.isArray(tipo.interesses)
            ? tipo.interesses
            : typeof tipo.interesses === "string"
            ? tipo.interesses
                .split(",")
                .map((i: string) => i.trim())
                .filter(Boolean)
            : [];

        await prisma.learningProfile.upsert({
          where: { usuarioId: id },
          create: {
            usuarioId: id,
            bio: tipo.bio ?? null,
            objetivo: tipo.objetivo ?? null,
            interesses,
          },
          update: {
            bio: tipo.bio ?? null,
            objetivo: tipo.objetivo ?? null,
            interesses,
          },
        });

        break;
      }

      case "federacao": {
          await prisma.federacao.upsert({
            where: { usuarioId: id },
            create: {
              usuarioId: id,
              nome: tipo.nome || usuario.nome || "Federação",
              email: tipo.email || usuario.email || null,
              cnpj: tipo.cnpj || null,
              telefone1: tipo.telefone1 || null,
              telefone2: tipo.telefone2 || null,
              siteOficial: tipo.siteOficial || null,
              sede: tipo.sede || null,
              cidade: tipo.cidade || usuario.cidade || null,
              estado: tipo.estado || usuario.estado || null,
              pais: tipo.pais || usuario.pais || null,
              cep: tipo.cep || cepDigits || null,
              logo: tipo.logo || fotoFinal || null,
              descricao: tipo.descricao || null,
            } as any,
            update: {
              nome: tipo.nome || usuario.nome || undefined,
              cnpj: tipo.cnpj || null,
              telefone1: tipo.telefone1 || null,
              telefone2: tipo.telefone2 || null,
              siteOficial: tipo.siteOficial || null,
              sede: tipo.sede || null,
              cidade: tipo.cidade || usuario.cidade || null,
              estado: tipo.estado || usuario.estado || null,
              pais: tipo.pais || usuario.pais || null,
              cep: tipo.cep || cepDigits || null,
              logo: tipo.logo || fotoFinal || null,
              descricao: tipo.descricao || null,
            } as any,
          });

          break;
      }

      case "marca": {
        await prisma.marca.upsert({
            where: { usuarioId: id },
            create: {
              usuarioId: id,
              nome: tipo.nome || usuario.nome || "Marca",
              email: tipo.email || usuario.email || null,
              cnpj: tipo.cnpj || null,
              telefone1: tipo.telefone1 || null,
              telefone2: tipo.telefone2 || null,
              siteOficial: tipo.siteOficial || null,
              cidade: tipo.cidade || usuario.cidade || null,
              estado: tipo.estado || usuario.estado || null,
              pais: tipo.pais || usuario.pais || null,
              cep: tipo.cep || cepDigits || null,
              logo: tipo.logo || fotoFinal || null,
              descricao: tipo.descricao || null,
              sede: tipo.sede || null,
            } as any,
            update: {
              nome: tipo.nome || usuario.nome || undefined,
              cnpj: tipo.cnpj || null,
              sede: tipo.sede || null,
              telefone1: tipo.telefone1 || null,
              telefone2: tipo.telefone2 || null,
              siteOficial: tipo.siteOficial || null,
              cidade: tipo.cidade || usuario.cidade || null,
              estado: tipo.estado || usuario.estado || null,
              pais: tipo.pais || usuario.pais || null,
              cep: tipo.cep || cepDigits || null,
              logo: tipo.logo || fotoFinal || null,
              descricao: tipo.descricao || null,
            } as any,
        });
        break;
     }
      default:
        return res.status(400).json({ error: "Tipo de usuário inválido." });
    }

    return res.status(200).json({ message: "Perfil atualizado com sucesso. Solicitações enviadas." });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar perfil." });
  }
};

export const getProgressoTreinos = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId: id },
      include: {
        treinosRecebidos: {
          include: {
            treino: {
              include: {
                exercicios: {
                  include: { exercicio: true }
                }
              }
            }
          }
        }
      }
    });

    if (!atleta) {
      return res.status(404).json({ error: "Atleta não encontrado" });
    }

    const categoriaContagem: Record<string, number> = {
      fisico: 0, tecnico: 0, tatico: 0, mental: 0,
    };

    for (const recebido of atleta.treinosRecebidos) {
      const rawTipo = recebido.treino?.tipoTreino ?? "";
      const norm = String(rawTipo)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

      if (norm.startsWith("fis")) categoriaContagem.fisico++;
      else if (norm.startsWith("tec")) categoriaContagem.tecnico++;
      else if (norm.startsWith("tat")) categoriaContagem.tatico++;
      else if (norm.startsWith("men")) categoriaContagem.mental++;
    }

    const desafiosIndividuais = await prisma.submissaoDesafio.count({
      where: { atletaId: atleta.id, aprovado: true },
    });

    const partsGrupo = await getParticipacoesGrupo(id, atleta.id);
    const totalPontosGrupo = partsGrupo.reduce((acc: number, item: any) => acc + pontosGrupo(item), 0);

    const pontuacao = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId: atleta.id } });
    const pontosConquistadosBase = pontuacao
      ? pontuacao.pontuacaoDisciplina + pontuacao.pontuacaoPerformance + pontuacao.pontuacaoResponsabilidade
      : 0;

    const pontosConquistados = pontosConquistadosBase + totalPontosGrupo;

    const desafiosGrupo = partsGrupo.length;
    const desafiosCompletos = desafiosIndividuais + desafiosGrupo;

    return res.json({
      ...categoriaContagem,
      totalTreinos: atleta.treinosRecebidos.length,
      horasTreinadas: Number((atleta.treinosRecebidos.length * 0.5).toFixed(1)),
      desafiosCompletos,
      pontosConquistados
    });
  } catch (err) {
    console.error("Erro ao buscar progresso dos treinos:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const getTreinosResumo = async (req: any, res: Response) => {
  try {
    const usuarioId =
      req.params?.id ?? req.params?.usuarioId ?? req.userId;

    if (!usuarioId) {
      return res.status(400).json({ error: "usuarioId ausente" });
    }

    const atleta = await prisma.atleta.findFirst({
      where: { usuarioId },
      select: { id: true },
    });

    if (!atleta) {
      return res.status(200).json({
        completos: 0,
        horas: 0,
        desafios: 0,
        categorias: { Fisico: 0, Tecnico: 0, Tatico: 0, Mental: 0 },
      });
    }

    const [subsTreino, desafios] = await Promise.all([
      prisma.submissaoTreino.findMany({
        where: { atletaId: atleta.id, aprovado: true },
        include: { treinoAgendado: { include: { treinoProgramado: true } } },
        orderBy: { criadoEm: "desc" },
      }),
      prisma.submissaoDesafio.count({
        where: { atletaId: atleta.id, aprovado: true },
      }),
    ]);

    const completos = subsTreino.length;

    let minutos = 0;
    const categorias = { Fisico: 0, Tecnico: 0, Tatico: 0, Mental: 0 };

    for (const s of subsTreino as any[]) {
      const dur =
        Number(s?.duracaoMinutos) ||
        Number(s?.duracao) ||
        Number(s?.treinoAgendado?.treinoProgramado?.duracao) ||
        0;
      minutos += isFinite(dur) ? dur : 0;

      const rawTipo =
        s?.tipoTreinoSnapshot ??
        s?.treinoAgendado?.treinoProgramado?.tipoTreino ??
        "";

      const norm = String(rawTipo)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

      if (norm.startsWith("fis")) categorias.Fisico++;
      else if (norm.startsWith("tec")) categorias.Tecnico++;
      else if (norm.startsWith("tat")) categorias.Tatico++;
      else if (norm.startsWith("men")) categorias.Mental++;
    }

    const horas = Math.round((minutos / 60) * 10) / 10;

    const desafiosGrupo = await prisma.submissaoDesafioEmGrupo.count({
      where: {
        OR: [
          { usuarioId: usuarioId },
          { submissaoDesafio: { atletaId: atleta.id } },
        ],
      },
    });

      return res.status(200).json({
        completos,
        horas,
        desafios: desafios + desafiosGrupo,
        categorias,
      });
  } catch (e) {
    console.error("[getTreinosResumo] erro:", e);
    return res.status(500).json({ error: "Erro ao buscar resumo de treinos" });
  }
};

export const getPosicaoAtualAtleta = async (req: AuthenticatedRequest, res: Response) => {
  const usuarioId = req.params?.id || req.userId;

  if (!usuarioId) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },
      select: { id: true, posicao: true },
    });

    if (!atleta) {
      return res.status(404).json({ error: "Atleta não encontrado para este usuário." });
    }

    const vinculoMaisRecente = await prisma.atletaElenco.findFirst({
      where: { atletaId: atleta.id, elenco: { ativo: true } },
      include: {
        elenco: { select: { id: true, nome: true, ativo: true, dataCriacao: true } },
      },
      orderBy: [
        { elenco: { dataCriacao: "desc" } },
        { updatedAt: "desc" },
      ],
    });

    if (vinculoMaisRecente && vinculoMaisRecente.posicao) {
      return res.json({
        origem: "elenco" as const,
        posicao: vinculoMaisRecente.posicao,
        atletaId: atleta.id,
        usuarioId,
        elenco: vinculoMaisRecente.elenco
          ? {
              id: vinculoMaisRecente.elenco.id,
              nome: vinculoMaisRecente.elenco.nome,
              ativo: vinculoMaisRecente.elenco.ativo,
            }
          : undefined,
        numeroCamisa: vinculoMaisRecente.numeroCamisa ?? null,
        updatedAt: vinculoMaisRecente.updatedAt?.toISOString?.() ?? null,
      });
    }

    return res.json({
      origem: "atleta" as const,
      posicao: (atleta.posicao as PosicaoCampo) ?? null,
      atletaId: atleta.id,
      usuarioId,
    });
  } catch (error) {
    console.error("Erro ao obter posição atual do atleta:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export async function getPerfilProfessor(req: AuthenticatedRequest, res: Response) {
  try {
    let { id } = req.params; 

    if (id === "me") {
      const prof = await prisma.professor.findFirst({
        where: { usuarioId: req.userId },
        select: { id: true },
      });
      if (!prof) return res.status(404).json({ message: "Professor não encontrado" });
      id = prof.id;
    }

    const prof = await resolveByUsuarioOrEntity({
      entity: "professor",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        codigo: true,
        cref: true,
        areaFormacao: true,
        escola: true,
        qualificacoes: true,
        certificacoes: true,
        fotoUrl: true,
        statusCref: true,
        clubeId: true,
        escolinhaId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true, nomeDeUsuario: true, verified: true } },
        treinosProgramados: { select: { id: true } },
        relacoesTreinamento: { select: { atletaId: true, clubeId: true, escolinhaId: true } },
      },
    });

    if (!prof) return res.status(404).json({ error: "Professor não encontrado" });

    if (!prof.usuarioId) {
      return res.status(404).json({
        error:
          "Professor sem usuário associado."
      });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        prof.usuarioId
      );

    if (!acesso) return;

    const rels = await prisma.relacaoTreinamento.findMany({
      where: { professorId: prof.id, atletaId: { not: null } },
      select: { atletaId: true },
    });

    const atletasDiretosClube = (prof as any).clubeId
      ? await prisma.atleta.findMany({ where: { clubeId: (prof as any).clubeId }, select: { id: true } })
      : [];
    const atletasDiretosEscolinha = (prof as any).escolinhaId
      ? await prisma.atleta.findMany({ where: { escolinhaId: (prof as any).escolinhaId }, select: { id: true } })
      : [];

    const uniq = new Set<string>([
      ...rels.map(r => r.atletaId!).filter(Boolean),
      ...atletasDiretosClube.map(a => a.id),
      ...atletasDiretosEscolinha.map(a => a.id),
    ]);
    const alunosRelacionados = uniq.size;
    const treinosCount = (prof as any).treinosProgramados?.length ?? 0;

    const unlocked: string[] = [];
    if (treinosCount >= 1)  unlocked.push("primeiro_treino_programado");
    if (treinosCount >= 5)  unlocked.push("serie_de_treinos");
    if (treinosCount >= 10) unlocked.push("planejamento_solido");
    if (alunosRelacionados >= 5) unlocked.push("grupo_inicial");

    let gruposCriados = 0;
    try {
      gruposCriados = await prisma.desafioEmGrupo.count({
        where: {
          OR: [
            { criadoPorId: prof.usuarioId ?? "" },
            { grupo: { ownerId: prof.usuarioId ?? "" } },
          ],
        },
      });
    } catch {}

    let conquistas = unlocked.length;
    if (gruposCriados > 0) conquistas += 1;

    const usuarioMin =
      sanitizarUsuarioPerfil(
        (prof as any).usuario,
        acesso.podeMostrarEmail
      );
    const fotoPerfil = withDefaultImg((prof as any).fotoUrl ?? usuarioMin?.foto);

    return res.json({
      tipo: "Professor" as const,
      usuario: usuarioMin,
      professor: {
        id: prof.id,
        usuarioId: prof.usuarioId,
        nome: prof.nome,
        codigo: prof.codigo,
        cref: prof.cref,
        areaFormacao: prof.areaFormacao,
        escola: prof.escola,
        qualificacoes: prof.qualificacoes ?? [],
        certificacoes: prof.certificacoes ?? [],
        fotoUrl: fotoPerfil,
        statusCref: prof.statusCref ?? null,
        clubeId: (prof as any).clubeId ?? null,       
        escolinhaId: (prof as any).escolinhaId ?? null, 
      },
      metrics: {
        treinosProgramados: treinosCount,
        alunosRelacionados,
        conquistas,
        conquistasUnlocked: unlocked,
        gruposCriados,
      },
    });

  } catch (e) {
    console.error("getPerfilProfessor error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar professor" });
  }
}

export async function getPerfilClube(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const clube = await resolveByUsuarioOrEntity({
      entity: "clube",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true, nomeDeUsuario: true, verified: true } },
        nome: true,
        cnpj: true,
        telefone1: true,
        telefone2: true,
        email: true,
        siteOficial: true,
        sede: true,
        estadio: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        dataCriacao: true,
        descricao: true,
        responsavel: true,
        categorias: true,
      },
    });

    if (!clube) return res.status(404).json({ error: "Clube não encontrado" });

    const [diretos, relacoes, elencos, aceitos] = await Promise.all([
      prisma.atleta.findMany({ where: { clubeId: clube.id }, select: { id: true } }),
      prisma.relacaoTreinamento.findMany({ where: { clubeId: clube.id, atletaId: { not: null } }, select: { atletaId: true } }),
      prisma.atletaElenco.findMany({ where: { elenco: { clubeId: clube.id } }, select: { atletaId: true } }),
      prisma.solicitacaoVinculo.findMany({
        where: { tipoEntidade: "clube", entidadeId: clube.id, status: "aceito" },
        select: { atletaId: true },
      }),
    ]);

    const ids = new Set<string>([
      ...diretos.map(a => a.id),
      ...relacoes.map(r => r.atletaId!),
      ...elencos.map(e => e.atletaId),
      ...aceitos.map(s => s.atletaId),
    ]);

    const acesso = await avaliarPrivacidadePerfil(
      (req as any).userId,
      clube.usuarioId
    );

    if (!acesso.podeVerPerfil) {
      return res.status(403).json({
        code: "PROFILE_PRIVATE",
        message: "Este perfil está privado.",
      });
    }

    const usuarioMin = (clube as any).usuario
      ? {
          ...(clube as any).usuario,
          email: acesso.podeMostrarEmail
            ? (clube as any).usuario.email
            : null,
        }
      : null;
    const logoOuFoto = withDefaultImg((clube as any).logo ?? usuarioMin?.foto);

    return res.json({
      tipo: "Clube" as const,
      usuario: usuarioMin,
      clube: {
        id: clube.id,
        usuarioId: clube.usuarioId,
        nome: clube.nome,
        cnpj: clube.cnpj,
        telefone1: clube.telefone1,
        telefone2: clube.telefone2,
        email: acesso.podeMostrarEmail
          ? clube.email
          : null,
        siteOficial: clube.siteOficial,
        sede: clube.sede,
        estadio: clube.estadio,
        logradouro: clube.logradouro,
        numero: clube.numero,
        complemento: clube.complemento,
        bairro: clube.bairro,
        cidade: clube.cidade,
        estado: clube.estado,
        pais: clube.pais,
        cep: clube.cep,
        logo: logoOuFoto,
        dataCriacao: clube.dataCriacao,
        descricao: (clube as any).descricao ?? null,
        responsavel: (clube as any).responsavel ?? null,
        categorias: (clube as any).categorias ?? [],
      },
      metrics: {
        atletas: ids.size,
        eventos: 0,
        conquistas: 0,
      },
    });
  } catch (e) {
    console.error("getPerfilClube error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar clube" });
  }
}

export async function getPerfilEscola(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const escola = await resolveByUsuarioOrEntity({
      entity: "escolinha",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { id: true, nome: true, email: true, foto: true, nomeDeUsuario: true, verified: true } },
        nome: true,
        cnpj: true,
        telefone1: true,
        telefone2: true,
        email: true,
        siteOficial: true,
        sede: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        dataCriacao: true,
        descricao: true,
        categorias: true,
      },
    });

    if (!escola) return res.status(404).json({ error: "Escolinha não encontrada" });

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        escola.usuarioId
      );

    if (!acesso) return;
    const atletasCount = await countAtletasPorEntidade({ escolinhaId: escola.id });
    const treinosCount = await prisma.treinoProgramado.count({ where: { escolinhaId: escola.id } });

    const usuarioMin =
      sanitizarUsuarioPerfil(
        (escola as any).usuario,
        acesso.podeMostrarEmail
      );
    const logoOuFoto = withDefaultImg((escola as any).logo ?? usuarioMin?.foto);

    return res.json({
      tipo: "Escolinha" as const,
      usuario: usuarioMin,
      escolinha: {
        id: escola.id,
        usuarioId: escola.usuarioId,
        nome: escola.nome,
        cnpj: escola.cnpj,
        telefone1: escola.telefone1,
        telefone2: escola.telefone2,
        email: acesso.podeMostrarEmail
          ? escola.email
          : null,
        siteOficial: escola.siteOficial,
        sede: escola.sede,
        logradouro: escola.logradouro,
        numero: escola.numero,
        complemento: escola.complemento,
        bairro: escola.bairro,
        cidade: escola.cidade,
        estado: escola.estado,
        pais: escola.pais,
        cep: escola.cep,
        logo: logoOuFoto,
        dataCriacao: escola.dataCriacao,
        descricao: (escola as any).descricao ?? null,
        categorias: (escola as any).categorias ?? [],
      },
      metrics: {
        atletas: atletasCount,
        treinosProgramados: treinosCount,
        postagens: 0,
        conquistas: 0,
      },
    });
  } catch (e) {
    console.error("getPerfilEscola error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar escolinha" });
  }
}

export async function getPerfilOlheiro(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const olheiro: any = await resolveByUsuarioOrEntity({
      entity: "olheiro",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true,
            nomeDeUsuario: true,
            verified: true,
          },
        },
        fotoUrl: true,
        headline: true,
        descricao: true,
        areaAtuacao: true,
        anosExperiencia: true,
        emailPublico: true,
        telefonePublico: true,
        reputacaoScore: true,
        totalIndicacoes: true,
        colaboracaoClube: {
          select: { id: true, usuarioId: true, nome: true, logo: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!olheiro) {
      return res.status(404).json({ error: "Olheiro não encontrado" });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        olheiro.usuarioId
      );

    if (!acesso) return;
    const viewerIsOlheiro = req.user?.tipo === "Olheiro";
    const isOwnProfile = !!req.userId && req.userId === olheiro.usuarioId;

    if (viewerIsOlheiro && !isOwnProfile) {
      const ok = await requireUsage(req, res, "perfis_vistos_dia");
      if (!ok) return;
    }

    const [
      observadosCount,
      indicacoesTotais,
      indicacoesAprovadas,
    ] = await Promise.all([
      prisma.atletaObservado.count({
        where: {
          olheiroId: olheiro.id,
        },
      }),

      prisma.indicacao.count({
        where: {
          olheiroId: olheiro.id,
        },
      }),

      prisma.indicacao.count({
        where: {
          olheiroId: olheiro.id,
          status: "APROVADA",
        },
      }),
    ]);

    const taxaAprovacao =
      indicacoesTotais > 0 ? indicacoesAprovadas / indicacoesTotais : 0;

    const reputacaoCalculada =
      indicacoesAprovadas *
      PONTOS_POR_INDICACAO_APROVADA;

    if (
      Number(
        olheiro.reputacaoScore ?? 0
      ) !== reputacaoCalculada ||
      Number(
        olheiro.totalIndicacoes ?? 0
      ) !== indicacoesTotais
    ) {
      await prisma.olheiro.update({
        where: {
          id: olheiro.id,
        },

        data: {
          reputacaoScore:
            reputacaoCalculada,

          totalIndicacoes:
            indicacoesTotais,
        },
      });
    }

    const usuarioMin =
      sanitizarUsuarioPerfil(
        olheiro.usuario,
        acesso.podeMostrarEmail
      );

    return res.json({
      tipo: "Olheiro" as const,
      usuario: usuarioMin,
      olheiro: {
        id: olheiro.id,
        usuarioId: olheiro.usuarioId,
        fotoUrl: olheiro.fotoUrl ?? null,
        headline: olheiro.headline ?? null,
        descricao: olheiro.descricao ?? null,
        areaAtuacao: olheiro.areaAtuacao ?? null,
        anosExperiencia: olheiro.anosExperiencia ?? 0,
        emailPublico:
          acesso.podeMostrarEmail
            ? olheiro.emailPublico ?? null
            : null,
        telefonePublico: olheiro.telefonePublico ?? null,
        reputacaoScore: reputacaoCalculada,
        totalIndicacoes: indicacoesTotais,
        colaboracaoClube: olheiro.colaboracaoClube
          ? {
              id: olheiro.colaboracaoClube.id,
              usuarioId: olheiro.colaboracaoClube.usuarioId,
              nome: olheiro.colaboracaoClube.nome,
              logo: olheiro.colaboracaoClube.logo ?? null,
            }
          : null,
        createdAt: olheiro.createdAt,
        updatedAt: olheiro.updatedAt,
      },
      metrics: {
        atletasAcompanhados: observadosCount,
        observados: observadosCount,

        indicacoesEnviadas: indicacoesTotais,
        indicacoes: indicacoesTotais,

        reputacaoScore: reputacaoCalculada,
        reputacao: reputacaoCalculada,

        indicacoesAprovadas,
        taxaAprovacao,
        atletasAssinados: null,
      },
    });
  } catch (e) {
    console.error("getPerfilOlheiro error:", e);
    return res.status(500).json({ error: "Erro interno ao buscar olheiro" });
  }
}

export const getUltimasSubmissoesDesafioVideos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.params.id || req.userId;
    if (!userId) return res.status(401).json({ error: "Não autenticado." });

    const atleta = await prisma.atleta.findFirst({
      where: { OR: [{ usuarioId: userId }, { id: userId }] },
      select: { id: true },
    });
    if (!atleta) return res.json([]);

    const subs = await prisma.submissaoDesafio.findMany({
      where: {
        atletaId: atleta.id,
        aprovado: true as any,       
      },
      select: {
        id: true,
        videoUrl: true,
        createdAt: true,
        desafio: { select: { titulo: true, imagemUrl: true } },
        curtidas: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const itens = subs
      .filter((s) => typeof s.videoUrl === "string" && s.videoUrl.trim() !== "")
      .map((s) => ({
        id: s.id,
        videoUrl: s.videoUrl,
        titulo: s.desafio?.titulo ?? "Desafio",
        thumb: s.desafio?.imagemUrl ?? null,
        createdAt: s.createdAt,
        curtidas: s.curtidas.length,
      }));

    return res.json(itens);
  } catch (e) {
    console.error("getUltimasSubmissoesDesafioVideos error:", e);
    return res.status(500).json({ error: "Erro ao buscar submissões de desafio." });
  }
};

export const getUltimasSubmissoesDesafioVideosMe = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.userId;
  if (!id) return res.status(401).json({ error: "Sem autenticação" });
  (req as any).params = { id };
  return getUltimasSubmissoesDesafioVideos(req as any, res);
};

export const getPerfilFederacao = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "").trim();

    const federacao = await resolveByUsuarioOrEntity({
      entity: "federacao",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        cnpj: true,
        email: true,
        telefone1: true,
        telefone2: true,
        siteOficial: true,
        sede: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        logo: true,
        descricao: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true,
            nomeDeUsuario: true,
            verified: true,
            cep: true,
            pais: true,
            estado: true,
            cidade: true,
            logradouro: true,
          },
        },
        _count: {
          select: {
            eventos: true,
            Metodologia: true,
            MetodologiaAvulsa: true,
          },
        },
      },
    });

    if (!federacao) {
      return res.status(404).json({ message: "Federação não encontrada." });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        federacao.usuarioId
      );

    if (!acesso) return;

    const [conquistasCount, certificadosCount] = await Promise.all([
      prisma.conquistaVinculo.count({
        where: {
          ownerTipo: "Federacao" as any,
          ownerId: federacao.id,
          concluida: true,
        },
      }),
      (prisma as any).certificadoMetodologia.count({
        where: {
          usuarioId: federacao.usuarioId,
        },
      }),
    ]);

    const usuarioMin =
      sanitizarUsuarioPerfil(
        federacao.usuario,
        acesso.podeMostrarEmail
      );

    const federacaoPayload = {
      ...federacao,

      email: acesso.podeMostrarEmail
        ? federacao.email
        : null,

      usuario: usuarioMin,
    };

    return res.json({
      tipo: "Federacao",
      usuario: usuarioMin,
      federacao: federacaoPayload,
      metricas: {
        eventos: federacao._count?.eventos ?? 0,
        conteudos:
          (federacao._count?.Metodologia ?? 0) +
          (federacao._count?.MetodologiaAvulsa ?? 0),
        conquistas: conquistasCount,
        certificados: certificadosCount,
        conquistasCertificados: conquistasCount + certificadosCount,
      },
    });
  } catch (e) {
    console.error("getPerfilFederacao error:", e);
    return res.status(500).json({ message: "Erro ao carregar federação." });
  }
};

export const getPerfilMarca = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "").trim();

    const marca = await resolveByUsuarioOrEntity({
      entity: "marca",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        nome: true,
        cnpj: true,
        email: true,
        telefone1: true,
        telefone2: true,
        siteOficial: true,
        cidade: true,
        estado: true,
        pais: true,
        cep: true,
        sede: true,
        logo: true,
        descricao: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true,
            nomeDeUsuario: true,
            verified: true,
            cep: true,
            pais: true,
            estado: true,
            cidade: true,
            logradouro: true,
          },
        },
        _count: {
          select: {
            eventos: true,
            Metodologia: true,
            MetodologiaAvulsa: true,
          },
        },
      }
    });

    if (!marca) {
      return res.status(404).json({ message: "Marca não encontrada." });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        marca.usuarioId
      );

    if (!acesso) return;

    const [conquistasCount, certificadosCount] = await Promise.all([
      prisma.conquistaVinculo.count({
        where: {
          ownerTipo: "Marca" as any,
          ownerId: marca.id,
          concluida: true,
        },
      }),
      (prisma as any).certificadoMetodologia.count({
        where: {
          usuarioId: marca.usuarioId,
        },
      }),
    ]);

    const usuarioMin =
      sanitizarUsuarioPerfil(
        marca.usuario,
        acesso.podeMostrarEmail
      );

    const marcaPayload = {
      ...marca,

      email: acesso.podeMostrarEmail
        ? marca.email
        : null,

      usuario: usuarioMin,
    };

    return res.json({
      tipo: "Marca",
      usuario: usuarioMin,
      marca: marcaPayload,
      metricas: {
        eventos: marca._count?.eventos ?? 0,
        conteudos:
          (marca._count?.Metodologia ?? 0) +
          (marca._count?.MetodologiaAvulsa ?? 0),
        conquistas: conquistasCount,
        certificados: certificadosCount,
        conquistasCertificados: conquistasCount + certificadosCount,
      },
    });
  } catch (e) {
    console.error("getPerfilMarca error:", e);
    return res.status(500).json({ message: "Erro ao carregar marca." });
  }
};

export const getPerfilLearning = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id || "").trim();

    const learning = await resolveByUsuarioOrEntity({
      entity: "learning",
      usuarioOrEntityId: id,
      select: {
        id: true,
        usuarioId: true,
        bio: true,
        objetivo: true,
        interesses: true,
        criadoEm: true,
        updatedAt: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            foto: true,
            nomeDeUsuario: true,
            verified: true,
            cep: true,
            cidade: true,
            estado: true,
            pais: true,
            logradouro: true,
          },
        },
      },
    });

    if (!learning) {
      return res.status(404).json({ message: "Perfil Learning não encontrado." });
    }

    const acesso =
      await obterAcessoPerfil(
        req,
        res,
        learning.usuarioId
      );

    if (!acesso) return;

    const solicitanteId =
      String(
        req.userId ||
          req.user?.id ||
          ""
      ).trim();

    const podeVerConteudos =
      solicitanteId ===
        learning.usuarioId ||
      isAdminFromReq(req);
      
    const assinaturas =
      podeVerConteudos
        ? await prisma
            .metodologiaAssinante
            .findMany({
              where: {
                usuarioId:
                  learning.usuarioId,

                status: {
                  in: [
                    MetodologiaAssinaturaStatus.ATIVA,
                    MetodologiaAssinaturaStatus.CONCLUIDA,
                  ],
                },
              },

              orderBy: {
                iniciouEm:
                  "desc",
              },

              include: {
                metodologia:
                  true,

                metodologiaAvulsa:
                  true,
              },
            })
        : [];

    const totalSeguidores = await prisma.seguidor.count({
      where: {
        seguidoUsuarioId: learning.usuarioId,
      },
    });

    const conteudos = assinaturas.map((a: any) => {
      const item = a.metodologia ?? a.metodologiaAvulsa ?? null;

      const progressoRaw =
        typeof a.progresso === "object" && a.progresso !== null
          ? a.progresso
          : {};

      const progressoPercentual =
        Number((progressoRaw as any)?.percentual) ||
        Number((progressoRaw as any)?.progressoPercentual) ||
        Number(a.progressoPercentual) ||
        0;

      return {
        id: a.id,
        assinaturaId: a.id,
        metodologiaId: a.metodologiaId ?? null,
        metodologiaAvulsaId: a.metodologiaAvulsaId ?? null,
        origem: a.origem ?? null,
        status: a.status ?? null,
        iniciouEm: a.iniciouEm ?? null,
        concluiuEm: a.concluiuEm ?? null,
        titulo: item?.titulo ?? item?.nome ?? "Curso",
        nome: item?.nome ?? item?.titulo ?? "Curso",
        imagemUrl: item?.imagemUrl ?? item?.capaUrl ?? item?.thumbUrl ?? null,
        progresso: progressoPercentual,
        progressoPercentual,
        assinatura: {
          status: a.status ?? null,
        },
      };
    });

    const finalizados = conteudos.filter((c: any) => {
      const status = String(c.status || "").toUpperCase();
      const progresso = Number(c.progressoPercentual || c.progresso || 0);

      return status === "CONCLUIDA" || status === "CONCLUÍDA" || progresso >= 100;
    });

    const emAndamento = conteudos.filter((c: any) => {
      const status = String(c.status || "").toUpperCase();
      const progresso = Number(c.progressoPercentual || c.progresso || 0);

      return status !== "CONCLUIDA" && status !== "CONCLUÍDA" && progresso < 100;
    });

    const usuarioMin =
      sanitizarUsuarioPerfil(
        learning.usuario,
        acesso.podeMostrarEmail
      );
      
    return res.json({
      tipo: "Learning",
      usuario: usuarioMin,
      learning: {
        id: learning.id,
        usuarioId: learning.usuarioId,
        bio: learning.bio ?? null,
        objetivo: learning.objetivo ?? null,
        interesses: Array.isArray(learning.interesses) ? learning.interesses : [],
        criadoEm: learning.criadoEm,
        updatedAt: learning.updatedAt,
      },
      dadosEspecificos: {
        id: learning.id,
        learningProfileId: learning.id,
        usuarioId: learning.usuarioId,
        bio: learning.bio ?? null,
        objetivo: learning.objetivo ?? null,
        interesses: Array.isArray(learning.interesses) ? learning.interesses : [],
        criadoEm: learning.criadoEm,
        updatedAt: learning.updatedAt,
      },
      conteudos,
      metricas: {
        cursos: conteudos.length,
        learnings: finalizados.length,
        emAndamento: emAndamento.length,
        finalizados: finalizados.length,
        certificados: finalizados.length,
        conquistas: 0,
        seguidores: totalSeguidores,
        progresso:
          conteudos.length > 0
            ? Math.round(
                conteudos.reduce(
                  (acc: number, c: any) =>
                    acc + Number(c.progressoPercentual || c.progresso || 0),
                  0
                ) / conteudos.length
              )
            : 0,
      }
    });
  } catch (e) {
    console.error("getPerfilLearning error:", e);
    return res.status(500).json({ message: "Erro ao carregar Learning." });
  }
};

function normalizarNomeDeUsuarioUpgrade(
  valor: unknown
) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(
      /[^a-z0-9._]/g,
      ""
    )
    .replace(/_{2,}/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(
      /^[._]+|[._]+$/g,
      ""
    )
    .slice(0, 30);
}

export const upgradeLearningProfile =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const usuarioId =
        req.userId ||
        req.user?.id;

      if (!usuarioId) {
        return res.status(401).json({
          message:
            "Não autenticado.",
        });
      }

      const usuario =
        await prisma.usuario.findUnique({
          where: {
            id: usuarioId,
          },

          select: {
            id: true,
            nome: true,
            email: true,
            nomeDeUsuario: true,
            tipo: true,
          },
        });

      if (!usuario) {
        return res.status(404).json({
          message:
            "Usuário não encontrado.",
        });
      }

      if (
        usuario.tipo !== "Learning"
      ) {
        return res.status(400).json({
          message:
            "Apenas contas Learning podem mudar o tipo por este fluxo.",
        });
      }

      const novoTipo = String(
        req.body?.tipo || ""
      )
        .trim()
        .toUpperCase();

      const mapaTipos = {
        ATLETA: "Atleta",
        PROFESSOR: "Professor",
        OLHEIRO: "Olheiro",
        CLUBE: "Clube",
        ESCOLINHA: "Escolinha",
        FEDERACAO: "Federacao",
        MARCA: "Marca",
      } as const;

      type NovoTipo =
        keyof typeof mapaTipos;

      if (
        !Object.prototype.hasOwnProperty.call(
          mapaTipos,
          novoTipo
        )
      ) {
        return res.status(400).json({
          message:
            "Tipo de perfil inválido.",
        });
      }

      const tipoValidado =
        novoTipo as NovoTipo;

      const tipoUsuarioFinal =
        mapaTipos[tipoValidado];

      const tiposOrganizacao =
        new Set<NovoTipo>([
          "CLUBE",
          "ESCOLINHA",
          "FEDERACAO",
          "MARCA",
        ]);

      const isOrganizacao =
        tiposOrganizacao.has(
          tipoValidado
        );

      const nomeOrganizacao =
        String(
          req.body
            ?.nomeOrganizacao || ""
        ).trim();

      if (
        isOrganizacao &&
        !nomeOrganizacao
      ) {
        return res.status(400).json({
          message:
            "Informe o nome da organização.",
        });
      }

      const nomeNovoInformado =
        isOrganizacao
          ? nomeOrganizacao
          : String(
              req.body?.nome || ""
            ).trim();

      const escolhaNomePerfil =
        req.body
          ?.escolhaNomePerfil ===
        "NOVO"
          ? "NOVO"
          : "ANTIGO";

      const nomeFinal =
        escolhaNomePerfil ===
        "NOVO"
          ? nomeNovoInformado
          : String(
              usuario.nome || ""
            ).trim();

      if (!nomeFinal) {
        return res.status(400).json({
          message:
            "Não foi possível definir o nome do novo perfil.",
        });
      }

      const usernameRecebido =
        normalizarNomeDeUsuarioUpgrade(
          req.body
            ?.nomeDeUsuario
        );

      const usernameAtual =
        normalizarNomeDeUsuarioUpgrade(
          usuario.nomeDeUsuario ||
            usuario.nome
        );

      const nomeDeUsuarioFinal =
        usernameRecebido ||
        usernameAtual ||
        normalizarNomeDeUsuarioUpgrade(
          nomeFinal
        );

      if (
        !/^[a-z0-9._]{3,30}$/.test(
          nomeDeUsuarioFinal
        )
      ) {
        return res.status(400).json({
          message:
            "Nome de usuário inválido. Use entre 3 e 30 caracteres com letras, números, ponto ou underline.",
        });
      }

      const usernameEmUso =
        await prisma.usuario.findFirst({
          where: {
            nomeDeUsuario:
              nomeDeUsuarioFinal,

            NOT: {
              id: usuarioId,
            },
          },

          select: {
            id: true,
          },
        });

      if (usernameEmUso) {
        return res.status(409).json({
          message:
            "Esse nome de usuário já está sendo utilizado.",
        });
      }

      const tipoUsuarioId =
        await prisma.$transaction(
          async (tx) => {
            await tx.usuario.update({
              where: {
                id: usuarioId,
              },

              data: {
                tipo:
                  tipoUsuarioFinal as any,

                nome:
                  nomeFinal,

                nomeDeUsuario:
                  nomeDeUsuarioFinal,
              },
            });

            switch (
              tipoValidado
            ) {
              case "ATLETA": {
                const nascimento =
                  parseDataNascimentoObrigatoria(
                    req.body
                      .dataNascimento
                  );

                const categorias =
                  normalizarCategorias(
                    req.body
                      .categoria
                  );

                const atleta =
                  await tx.atleta.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeFinal,

                      dataNascimento:
                        nascimento
                          .dataNascimento,

                      idade:
                        nascimento
                          .idade,

                      categoria:
                        categorias,

                      posicao:
                        req.body
                          .posicao ||
                        null,
                    } as any,
                  });

                return atleta.id;
              }

              case "PROFESSOR": {
                const nascimento =
                  parseDataNascimentoObrigatoria(
                    req.body
                      .dataNascimento
                  );

                const professor =
                  await tx.professor.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeFinal,

                      email:
                        usuario.email,

                      dataNascimento:
                        nascimento
                          .dataNascimento,

                      areaFormacao:
                        req.body
                          .areaFormacao ||
                        null,

                      cref:
                        req.body.cref ||
                        null,

                      statusCref:
                        req.body
                          .statusCref ||
                        null,
                    } as any,
                  });

                return professor.id;
              }

              case "OLHEIRO": {
                const nascimento =
                  parseDataNascimentoObrigatoria(
                    req.body
                      .dataNascimento
                  );

                const olheiro =
                  await tx.olheiro.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeFinal,

                      email:
                        usuario.email,

                      dataNascimento:
                        nascimento
                          .dataNascimento,

                      areaAtuacao:
                        req.body
                          .areaAtuacao ||
                        null,

                      anosExperiencia:
                        req.body
                          .anosExperiencia
                          ? Number(
                              req.body
                                .anosExperiencia
                            )
                          : null,

                      headline:
                        req.body
                          .headline ||
                        null,

                      descricao:
                        req.body
                          .descricao ||
                        null,
                    } as any,
                  });

                return olheiro.id;
              }

              case "CLUBE": {
                const clube =
                  await tx.clube.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeOrganizacao,

                      email:
                        usuario.email,

                      cnpj:
                        req.body.cnpj ||
                        null,

                      cidade:
                        req.body
                          .cidade ||
                        null,

                      estado:
                        req.body
                          .estado ||
                        null,
                    } as any,
                  });

                return clube.id;
              }

              case "ESCOLINHA": {
                const escolinha =
                  await tx.escolinha.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeOrganizacao,

                      email:
                        usuario.email,

                      cnpj:
                        req.body.cnpj ||
                        null,

                      cidade:
                        req.body
                          .cidade ||
                        null,

                      estado:
                        req.body
                          .estado ||
                        null,
                    } as any,
                  });

                return escolinha.id;
              }

              case "FEDERACAO": {
                const federacao =
                  await tx.federacao.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeOrganizacao,

                      email:
                        usuario.email,

                      cnpj:
                        req.body.cnpj ||
                        null,

                      cidade:
                        req.body
                          .cidade ||
                        null,

                      estado:
                        req.body
                          .estado ||
                        null,
                    } as any,
                  });

                return federacao.id;
              }

              case "MARCA": {
                const marca =
                  await tx.marca.create({
                    data: {
                      usuarioId,

                      nome:
                        nomeOrganizacao,

                      email:
                        usuario.email,

                      cnpj:
                        req.body.cnpj ||
                        null,

                      cidade:
                        req.body
                          .cidade ||
                        null,

                      estado:
                        req.body
                          .estado ||
                        null,
                    } as any,
                  });

                return marca.id;
              }

              default: {
                throw new Error(
                  "Tipo de perfil inválido."
                );
              }
            }
          }
        );

      return res.json({
        ok: true,
        message:
          "Tipo de perfil atualizado com sucesso.",
        tipo:
          tipoValidado,
        tipoUsuarioId,
        usuario: {
          id:
            usuarioId,
          nome:
            nomeFinal,
          nomeDeUsuario:
            nomeDeUsuarioFinal,
          tipo:
            tipoUsuarioFinal,
        },
      });
    } catch (error: any) {
      return sendError(
        res,
        error,
        "Erro ao mudar tipo de perfil."
      );
    }
  };