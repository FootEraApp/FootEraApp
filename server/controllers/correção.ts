
import { Request, Response } from "express";
import { Categoria, PosicaoCampo } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { requireUsage } from "server/lib/usage.js";
import { validarJanelaAtleta, getRangeFromQuery, PlanoAtleta } from "../utils/analyticsWindow.js";
import { prisma } from "../prisma.js";
import { calcularPerfilVerificado } from "../utils/perfilVerificado.js";
import { deleteFromS3 } from "../middlewares/s3Upload.js";

type AtividadeUI = {
  id: string;
  tipo: string;         
  titulo: string;      
  createdAt: string;    
  imagemUrl?: string | null;
  link?: string | null; 
};

const DEFAULT_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

function absUrl(path?: string | null) {
  const s = typeof path === "string" ? path.trim() : "";
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `${s.startsWith("/uploads") ? API_BASE_URL : FRONTEND_URL}${s}`;
}

function readPrivacidadeFlags(config: any) {
  const c = (config && typeof config === "object") ? config : {};
  return {
    perfilVisivel: c.perfilVisivel !== false,         
    mostrarEmail: c.mostrarEmail === true,            
    permitirMensagens: c.permitirMensagens !== false, 
  };
}

function isAdminFromReq(req: any) {
  const t = String(req?.user?.tipo ?? req?.authUser?.tipo ?? "").toLowerCase();
  return t === "admin";
}

function withDefaultImg(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : DEFAULT_AVATAR;
}

async function ensureSolicitacaoVinculo(
  tx: any,
  params: { atletaId: string; entidadeId: string; tipoEntidade: "clube" | "escolinha" | "professor" }
) {
  const { atletaId, entidadeId, tipoEntidade } = params;

  const existente = await tx.solicitacaoVinculo.findFirst({
    where: { atletaId, entidadeId, tipoEntidade },
  });

  if (!existente) {
    await tx.solicitacaoVinculo.create({
      data: {
        atletaId,
        entidadeId,
        tipoEntidade,
        status: "pendente",
      },
    });
  }
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



export const atualizarPerfil = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userIdFromToken = req.userId;
  if (!userIdFromToken || id !== userIdFromToken) {
    return res.status(403).json({ error: "Você só pode editar o seu próprio perfil." });
  }

  const { usuario, tipo, tipoUsuario } = req.body;
  if (!usuario || !tipoUsuario || !tipo) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  const fotoFinal: string | null = file ? `/uploads/${file.filename}` : (usuario.foto ?? null);

  const raw = typeof usuario?.nomeDeUsuario === "string" ? usuario.nomeDeUsuario.trim() : "";
  const novoUsername = raw ? raw.toLowerCase() : null;

  // valida formato (mesma regra do front)
  if (novoUsername && !/^[a-z0-9._]{3,30}$/.test(novoUsername)) {
    return res.status(400).json({
      error: "Nome de usuário inválido. Use letras, números, ponto e underline (3–30).",
    });
  }

  // checa duplicado (evita conflito)
  if (novoUsername) {
    const existe = await prisma.usuario.findFirst({
      where: {
        nomeDeUsuario: novoUsername,
        NOT: { id },
      },
      select: { id: true },
    });

    if (existe) {
      return res.status(400).json({ error: "Esse nome de usuário já está em uso." });
    }
  }
  try {
    const cepDigits =
  usuario?.cep != null ? String(usuario.cep).replace(/\D/g, "") : "";

    await prisma.usuario.update({
      where: { id },
      data: {
        nome: usuario.nome,
        email: usuario.email,
        nomeDeUsuario: novoUsername ?? undefined, // ✅ garante lowercase
        foto: fotoFinal,
        cep: cepDigits ? cepDigits : null,
        cidade: usuario.cidade,
        estado: usuario.estado,
        pais: usuario.pais,
        bairro: usuario.bairro,
      },
    });

    const tipoKey = String(tipoUsuario).toLowerCase();
    const tipoNorm = tipoKey === "escolinha" ? "escola" : tipoKey;

    switch (tipoNorm) {
      case "atleta": {
        const rawEscolinha =
          tipo.escolinhaId ??
          tipo.escolaId ??
          tipo.escolinha ??
          tipo.escola ??
          null;

        const rawClube = tipo.clubeId ?? tipo.clube ?? null;
        
        const escolinhaId = pickId(rawEscolinha);
        const clubeId = pickId(rawClube);

        const limparEscolinha =
          rawEscolinha === "" ||
          rawEscolinha === null ||
          String(rawEscolinha).toLowerCase() === "nenhum";

        const limparClube =
          rawClube === "" ||
          rawClube === null ||
          String(rawClube).toLowerCase() === "nenhum";

        const rawProfessorMulti =
          tipo.professorIds ??
          tipo.professoresIds ??
          tipo.professorIdsSelecionados ??
          null;

        const rawProfessorSingle = tipo.professorId ?? tipo.professor ?? null;

        const professorIds = Array.from(
          new Set([
            ...pickIds(rawProfessorMulti),
            ...(pickId(rawProfessorSingle) ? [pickId(rawProfessorSingle)!] : []),
          ])
        ).filter(Boolean);

        const limparProfessor =
          (rawProfessorMulti === "" ||
            rawProfessorMulti === null ||
            String(rawProfessorMulti).toLowerCase() === "nenhum") &&
          (rawProfessorSingle === "" ||
            rawProfessorSingle === null ||
            String(rawProfessorSingle).toLowerCase() === "nenhum" ||
            professorIds.length === 0);

        const data: any = {
          nome: tipo.nome,
          sobrenome: tipo.sobrenome,
          idade: isNaN(parseInt(tipo.idade)) ? undefined : parseInt(tipo.idade),
          telefone1: tipo.telefone1,
          telefone2: tipo.telefone2,
          email: usuario.email ?? null,
          nacionalidade: tipo.nacionalidade,
          naturalidade: tipo.naturalidade,
          posicao: tipo.posicao,
          altura: isNaN(parseFloat(tipo.altura))
            ? undefined
            : parseFloat(tipo.altura),
          peso: isNaN(parseFloat(tipo.peso))
            ? undefined
            : parseFloat(tipo.peso),
          seloQualidade: tipo.seloQualidade,
          foto: fotoFinal,
        };

        if (limparEscolinha) {
          data.escolinhaId = null;
        } else if (escolinhaId) {
          data.escolinhaId = escolinhaId;
        }

        if (limparClube) {
          data.clubeId = null;
        } else if (clubeId) {
          data.clubeId = clubeId;
        }

        const atletaRow = await prisma.atleta.findUnique({
          where: { usuarioId: id },
          select: { id: true },
        });

        if (!atletaRow) {
          return res
            .status(404)
            .json({ error: "Atleta não encontrado para este usuário." });
        }

        const atletaId = atletaRow.id;

        await prisma.$transaction(async (tx: any) => {
          await tx.atleta.update({ where: { usuarioId: id }, data });

          if (limparEscolinha) {
            await tx.relacaoTreinamento.deleteMany({
              where: { atletaId, escolinhaId: { not: null } },
            });
          } else if (escolinhaId) {
            await tx.relacaoTreinamento.deleteMany({
              where: {
                atletaId,
                escolinhaId: { not: escolinhaId },
              },
            });

            const existe = await tx.relacaoTreinamento.findFirst({
              where: { atletaId, escolinhaId },
            });

            if (!existe) {
              await tx.relacaoTreinamento.create({
                data: { atletaId, escolinhaId },
              });

              await ensureSolicitacaoVinculo(tx, {
                atletaId,
                entidadeId: escolinhaId,
                tipoEntidade: "escolinha",
              });
            }
          }

          if (limparClube) {
            await tx.relacaoTreinamento.deleteMany({
              where: { atletaId, clubeId: { not: null } },
            });
          } else if (clubeId) {
            await tx.relacaoTreinamento.deleteMany({
              where: {
                atletaId,
                clubeId: { not: clubeId },
              },
            });

            const existe = await tx.relacaoTreinamento.findFirst({
              where: { atletaId, clubeId },
            });

            if (!existe) {
              await tx.relacaoTreinamento.create({
                data: { atletaId, clubeId },
              });

              await ensureSolicitacaoVinculo(tx, {
                atletaId,
                entidadeId: clubeId,
                tipoEntidade: "clube",
              });
            }
          }

          if (limparProfessor) {
            await tx.relacaoTreinamento.deleteMany({
              where: { atletaId, professorId: { not: null } },
            });
          } else {
            await tx.relacaoTreinamento.deleteMany({
              where: {
                atletaId,
                professorId: { not: null, notIn: professorIds },
              },
            });

            for (const pid of professorIds) {
              const existe = await tx.relacaoTreinamento.findFirst({
                where: { atletaId, professorId: pid },
              });

              if (!existe) {
                await tx.relacaoTreinamento.create({
                  data: { atletaId, professorId: pid },
                });

                await ensureSolicitacaoVinculo(tx, {
                  atletaId,
                  entidadeId: pid,
                  tipoEntidade: "professor",
                });
              }
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
            qualificacoes: Array.isArray(tipo.qualificacoes)
              ? tipo.qualificacoes
              : tipo.qualificacoes?.split(",").map((q: string) => q.trim()),
            certificacoes: Array.isArray(tipo.certificacoes)
              ? tipo.certificacoes
              : tipo.certificacoes?.split(",").map((c: string) => c.trim()),
            fotoUrl: fotoFinal,
          },
        });
        break;

      case "clube": {
        const data: any = {
          nome: tipo.nome,
          telefone1: tipo.telefone1 ?? null,
          telefone2: tipo.telefone2 ?? null,
          email: tipo.email ?? null,
          siteOficial: tipo.siteOficial ?? null,
          sede: tipo.sede ?? null,
          estadio: tipo.estadio ?? null,
          logradouro: tipo.logradouro ?? null,
          numero: tipo.numero ?? null,
          complemento: tipo.complemento ?? null,
          bairro: tipo.bairro ?? null,
          cidade: tipo.cidade ?? null,
          estado: tipo.estado ?? null,
          pais: tipo.pais ?? null,
          cep: tipo.cep ?? null,
          descricao: tipo.descricao ?? null,
          responsavel: tipo.responsavel ?? null,
          logo: fotoFinal,
        };
        if (Array.isArray(tipo.categorias)) data.categorias = { set: tipo.categorias };

        await prisma.clube.update({ where: { usuarioId: id }, data });
        break;
      }

      case "olheiro": {
        const anos =
          typeof tipo.anosExperiencia === "string" && tipo.anosExperiencia !== ""
            ? Number(tipo.anosExperiencia)
            : tipo.anosExperiencia;

        await prisma.olheiro.update({
          where: { usuarioId: id },
          data: {
            headline: tipo.headline ?? null,
            descricao: tipo.descricao ?? null,
            areaAtuacao: tipo.areaAtuacao ?? null,
            anosExperiencia: Number.isFinite(anos) ? (anos as number) : undefined,
            emailPublico: tipo.emailPublico ?? null,
            telefonePublico: tipo.telefonePublico ?? null,
            fotoUrl: fotoFinal,
          },
        });
        break;
      }

      case "escola":
        await prisma.escolinha.update({
          where: { usuarioId: id },
          data: {
            nome: tipo.nome,
            telefone1: tipo.telefone1,
            telefone2: tipo.telefone2,
            email: tipo.email,
            siteOficial: tipo.siteOficial,
            sede: tipo.sede,
            logradouro: tipo.logradouro,
            numero: tipo.numero,
            complemento: tipo.complemento,
            bairro: tipo.bairro,
            cidade: tipo.cidade,
            estado: tipo.estado,
            pais: tipo.pais,
            cep: tipo.cep,
            logo: fotoFinal,
          },
        });
        break;

      default:
        return res.status(400).json({
          error: `Tipo de usuário inválido: ${tipoUsuario} (aceitos: atleta, professor, clube, escola/escolinha, olheiro)`,
        });
    }

    return res.status(200).json({ message: "Perfil atualizado com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar perfil." });
  }
};