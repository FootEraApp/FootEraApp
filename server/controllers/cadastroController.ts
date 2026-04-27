//server/controllers/cadastroController
import { Request, Response } from "express";
import { TipoUsuario, Nivel, StatusCref, NotificacaoTipo} from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmailVerification } from "../utils/mailer.js";
import { prisma } from "../prisma.js";
import { calcularPerfilVerificado } from "../utils/perfilVerificado.js";
import { recomputeAndEmitBadge } from "./notificacoesController.js";

const FRONTEND_URL = (process.env.WEB_BASE_URL || "https://footera.app.br").replace(/\/+$/, "");

const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.APP_BASE_URL ||
  "http://localhost:3001"
).replace(/\/+$/, "");

const JWT_SECRET: jwt.Secret = (process.env.JWT_SECRET || "defaultsecret");

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

function absUrl(p?: string | null) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = p.startsWith("/uploads") ? API_BASE_URL : FRONTEND_URL;
  return `${base}${p}`;
}

function verificationEmailHtml(link: string) {
  return `
    <div style="font-family:Arial,sans-serif">
      <h2>Confirme seu e-mail</h2>
      <p>Para finalizar seu cadastro na FootEra, clique no botão abaixo:</p>
      <p><a href="${link}" style="background:#0a5f2e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Validar e-mail</a></p>
      <p>Ou copie e cole este link no navegador:<br/>${link}</p>
    </div>
  `;
}

async function issueEmailVerification(params: {
  userId: string;
  emailDestino: string;
  isResponsavel: boolean;
  nome: string;
  username: string;
  tipo: string;
  cidade?: string | null;
  estado?: string | null;
}) {
  const raw = crypto.randomBytes(32).toString("hex");

  await prisma.emailVerification.upsert({
    where: { usuarioId: params.userId },
    update: { token: raw, expiraEm: addHours(new Date(), 24), usadoEm: null },
    create: { usuarioId: params.userId, token: raw, expiraEm: addHours(new Date(), 24) },
  });

  const verifyUrl = `${FRONTEND_URL}/verificar-email?token=${encodeURIComponent(raw)}`;

  await sendEmailVerification({
    to: params.emailDestino,
    verifyUrl,
    isResponsavel: params.isResponsavel,
    nome: params.nome,
    username: params.username,
    tipo: params.tipo,
    cidade: params.cidade,
    estado: params.estado,
  });
}

export const getCadastroIndex = async (_req: Request, res: Response) => {
  res.json({ message: "Tela de cadastro inicial" });
};

export const getEscolhaTipo = async (_req: Request, res: Response) => {
  res.json({
    message:
      "Escolha o tipo de usuário: Atleta, Clube, Escolinha, Professor, Olheiro ou Admin",
  });
};

export const getCriar = async (_req: Request, res: Response) => {
  res.json({ message: "Formulário de criação de usuário" });
};

export const checarEmail = async (req: Request, res: Response) => {
  const email = String(req.query.email ?? "").trim().toLowerCase();
  if (!email) return res.status(400).json({ ok: false, error: "Informe o email" });
  const existe = await prisma.usuario.findUnique({ where: { email } });
  res.json({ ok: true, disponivel: !existe });
};

export const checarUsername = async (req: Request, res: Response) => {
  const nomeDeUsuario = String(req.query.username ?? "").trim().toLowerCase();
  if (!nomeDeUsuario) return res.status(400).json({ ok: false, error: "Informe o username" });
  const existe = await prisma.usuario.findUnique({ where: { nomeDeUsuario } });
  res.json({ ok: true, disponivel: !existe });
};

export const deletarUsuario = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.usuario.delete({ where: { id } });
    return res.json({ message: "Usuário deletado com sucesso!" });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    return res.status(500).json({ message: "Erro interno" });
  }
};

export async function buscarPerfisPublico(req: Request, res: Response) {
  try {
    const tipo = String(req.query.tipo ?? "").trim();
    const q = String(req.query.query ?? "").trim();
    if (!q) return res.json([]);

    const normProfessor = (rows: any[]) =>
    rows.map((p) => {
      const usuario = p.usuario || {};
      const perfilVerificado = calcularPerfilVerificado({
        usuario: {
          verified: usuario.verified,
          nome: p.nome ?? usuario.nome ?? null,
          nomeDeUsuario: usuario.nomeDeUsuario ?? null,
          email: usuario.email ?? null,
          foto: absUrl(p.fotoUrl) ?? absUrl(usuario.foto),
        },
        tipo: "professor",
        professor: {
          areaFormacao: p.areaFormacao ?? null,
          cref: p.cref ?? null,
          statusCref: p.statusCref ?? null,
          dataNascimento: p.dataNascimento ?? null,
          escola: p.escola ?? null,
          qualificacoes: p.qualificacoes ?? null,
          certificacoes: p.certificacoes ?? null,
          fotoUrl: absUrl(p.fotoUrl) ?? null,
        },
      });

      return {
        id: p.id as string,
        usuarioId: p.usuario?.id as string,
        tipo: "Professor" as const,
        nome: p.nome as string,
        username: usuario?.nomeDeUsuario ?? "",
        fotoUrl: absUrl(p.fotoUrl) ?? absUrl(usuario?.foto),
        perfilVerificado,
      };
    });

    const normClube = (rows: any[]) =>
      rows.map((c) => {
        const usuario = c.usuario || {};

        const perfilVerificado = calcularPerfilVerificado({
          usuario: {
            verified: usuario.verified,
            nome: c.nome ?? usuario.nome ?? null,
            nomeDeUsuario: usuario.nomeDeUsuario ?? null,
            email: c.email ?? usuario.email ?? null,
            foto: absUrl(c.logo) ?? absUrl(usuario.foto),
          },
          tipo: "clube",
          clube: {
            nome: c.nome ?? null,
            cnpj: c.cnpj ?? null,
            email: c.email ?? usuario.email ?? null,
            telefone1: c.telefone1 ?? null,
            siteOficial: c.siteOficial ?? null,
            sede: c.sede ?? null,
            cidade: c.cidade ?? null,
            estado: c.estado ?? null,
            bairro: c.bairro ?? null,
            pais: c.pais ?? null,
            cep: c.cep ?? null,
            logo: absUrl(c.logo) ?? null,
          },
        });

        return {
          id: c.id as string,
          usuarioId: c.usuario?.id as string,
          tipo: "Clube" as const,
          nome: c.nome as string,
          username: usuario?.nomeDeUsuario ?? "",
          fotoUrl: absUrl(c.logo) ?? absUrl(usuario?.foto),
          perfilVerificado,
        };
      });

    const normEscolinha = (rows: any[]) =>
      rows.map((e) => {
        const usuario = e.usuario || {};

        const perfilVerificado = calcularPerfilVerificado({
          usuario: {
            verified: usuario.verified,
            nome: e.nome ?? usuario.nome ?? null,
            nomeDeUsuario: usuario.nomeDeUsuario ?? null,
            email: e.email ?? usuario.email ?? null,
            foto: absUrl(e.logo) ?? absUrl(usuario.foto),
          },
          tipo: "escolinha",
          escolinha: {
            nome: e.nome ?? null,
            cnpj: e.cnpj ?? null,
            email: e.email ?? usuario.email ?? null,
            telefone1: e.telefone1 ?? null,
            siteOficial: e.siteOficial ?? null,
            cidade: e.cidade ?? null,
            estado: e.estado ?? null,
            bairro: e.bairro ?? null,
            pais: e.pais ?? null,
            cep: e.cep ?? null,
            logo: absUrl(e.logo) ?? null,
          },
        });

        return {
          id: e.id as string,
          usuarioId: e.usuario?.id as string,
          tipo: "Escolinha" as const,
          nome: e.nome as string,
          username: usuario?.nomeDeUsuario ?? "",
          fotoUrl: absUrl(e.logo) ?? absUrl(usuario?.foto),
          perfilVerificado,
        };
      });

    const normOlheiro = (rows: any[]) =>
      rows.map((o) => {
        const usuario = o.usuario || {};

        const perfilVerificado = calcularPerfilVerificado({
          usuario: {
            verified: usuario.verified,
            nome: usuario.nome ?? null,
            nomeDeUsuario: usuario.nomeDeUsuario ?? null,
            email: usuario.email ?? null,
            foto: absUrl(o.fotoUrl) ?? absUrl(usuario.foto),
          },
          tipo: "olheiro",
          olheiro: {
            areaAtuacao: o.areaAtuacao ?? null,
            anosExperiencia: Number.isFinite(Number(o.anosExperiencia))
              ? Number(o.anosExperiencia)
              : null,
            emailPublico: (o.emailPublico ?? o.emailNorm) || null,
            telefonePublico: o.telefonePublico ?? null,
            descricao: o.descricao ?? null,
            fotoUrl: absUrl(o.fotoUrl) ?? null,
          },
        });

        return {
          id: o.id as string,
          usuarioId: o.usuario?.id as string,
          tipo: "Olheiro" as const,
          nome: usuario?.nome ?? "",
          username: usuario?.nomeDeUsuario ?? "",
          fotoUrl: absUrl(o.fotoUrl) ?? absUrl(o.usuario?.foto),
          perfilVerificado,
        };
      });

    const results: any[] = [];

    if (!tipo || tipo === "Todos" || tipo === "Professor") {
      const profs = await prisma.professor.findMany({
        where: {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { usuario: { nomeDeUsuario: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          nome: true,
          fotoUrl: true,
          areaFormacao: true,
          cref: true,
          statusCref: true,
          dataNascimento: true,
          escola: true,
          qualificacoes: true,
          certificacoes: true,
          usuario: {
            select: {
              id: true,
              verified: true,
              nome: true,
              email: true,
              nomeDeUsuario: true,
              foto: true,
            },
          },
        },
        take: 20,
      });
      results.push(...normProfessor(profs));
    }

    if (!tipo || tipo === "Todos" || tipo === "Clube") {
      const clubes = await prisma.clube.findMany({
        where: {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { usuario: { nomeDeUsuario: { contains: q, mode: "insensitive" } } },
          ],
        },
       select: {
          id: true,
          nome: true,
          logo: true,
          cnpj: true,
          email: true,
          telefone1: true,
          telefone2: true,
          siteOficial: true,
          cidade: true,
          estado: true,
          sede: true,
          bairro: true,
          pais: true,
          cep: true,
          usuario: { select: { id: true, verified: true, nome: true, email: true, nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });
      results.push(...normClube(clubes));
    }

    if (!tipo || tipo === "Todos" || tipo === "Escolinha") {
      const escolas = await prisma.escolinha.findMany({
        where: {
          OR: [
            { nome: { contains: q, mode: "insensitive" } },
            { usuario: { nomeDeUsuario: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          nome: true,
          logo: true,
          cnpj: true,
          email: true,
          telefone1: true,
          telefone2: true,
          siteOficial: true,
          cidade: true,
          estado: true,
          bairro: true,
          pais: true,
          cep: true,
          usuario: { select: { id: true, verified: true, nome: true, email: true, nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });
      results.push(...normEscolinha(escolas));
    }

    if (!tipo || tipo === "Todos" || tipo === "Olheiro") {
      const olheiros = await prisma.olheiro.findMany({
        where: {
          usuario: {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { nomeDeUsuario: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        select: {
          id: true,
          fotoUrl: true,
          areaAtuacao: true,
          anosExperiencia: true,
          descricao: true,
          emailPublico: true,
          telefonePublico: true,
          usuario: { select: { id: true, verified: true, nome: true, email: true, nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });
      results.push(...normOlheiro(olheiros));
    }

    if (!tipo || tipo === "Todos" || tipo === "Atleta") {
      const atletas = await prisma.atleta.findMany({
        where: {
          usuario: {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { nomeDeUsuario: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        select: {
          id: true,
          usuario: {
            select: {
              id: true,
              verified: true,
              nome: true,
              email: true,
              nomeDeUsuario: true,
              foto: true,
            },
          },
        },
        take: 20,
      });

      results.push(
        ...atletas.map((a) => ({
          id: a.id,
          usuarioId: a.usuario?.id,
          tipo: "Atleta" as const,
          nome: a.usuario?.nome ?? "",
          username: a.usuario?.nomeDeUsuario ?? "",
          fotoUrl: absUrl(a.usuario?.foto),
        }))
      );
    }
    results.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    return res.json(results);
  } catch (e) {
    console.error("buscarPerfisPublico error:", e);
    return res.status(500).json([]);
  }
}

async function criarSolicitacaoVinculoCadastro(params: {
  remetenteId: string;
  destinatarioId?: string;
}) {
  const remetenteId = String(params.remetenteId || "").trim();
  const destinatarioId = String(params.destinatarioId || "").trim();

  if (!remetenteId || !destinatarioId || remetenteId === destinatarioId) return;

  const [remetente, destinatario] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: remetenteId }, select: { id: true } }),
    prisma.usuario.findUnique({ where: { id: destinatarioId }, select: { id: true } }),
  ]);

  if (!remetente || !destinatario) return;

  const existente = await prisma.solicitacaoTreino.findFirst({
    where: {
      status: { in: ["pendente", "ativa"] },
      OR: [
        { remetenteId, destinatarioId },
        { remetenteId: destinatarioId, destinatarioId: remetenteId },
      ],
    },
  });

  if (!existente) {
    await prisma.solicitacaoTreino.create({
      data: {
        remetenteId,
        destinatarioId,
        status: "pendente",
      },
    });
  }

  await prisma.notificacao.create({
    data: {
      usuarioId: destinatarioId,
      actorId: remetenteId,
      tipo: NotificacaoTipo.GENERICA,
      titulo: "Solicitação de vínculo",
      mensagem: "quer se vincular/treinar junto com você",
      link: "/notificacoes",
      lida: false,
    },
  });

  await recomputeAndEmitBadge(destinatarioId);
}

export const cadastrarUsuario = async (req: Request, res: Response) => {
  const {
    nome, email, senha, tipo,
    nomeDeUsuario, cidade, estado, pais, bairro, cpf,
    idade, categoria, logradouro, vinculo,
    areaFormacao, cref, statusCref,
    nomeClube, cnpjClube, telefone1Clube, telefone2Clube, emailClube, siteOficialClube, sedeClube, logradouroClube, numeroClube,
    complementoClube, bairroClube, cidadeClube, estadoClube, paisClube, cepClube, estadio,
    nomeEscolinha, cnpjEscolinha, telefone1Escolinha, telefone2Escolinha, emailEscolinha, siteOficialEscolinha, sedeEscolinha,
    logradouroEscolinha, numeroEscolinha, complementoEscolinha, bairroEscolinha, cidadeEscolinha, estadoEscolinha, paisEscolinha, cepEscolinha,
    areaAtuacao, anosExperiencia,
    telefonePublico, emailPublico, descricao, colaboracaoClubeId, colaboracaoProfessorId,
    colaboracaoEscolinhaId, dataNascimento, responsavel, siteOuLinkedin, headline
  } = req.body ?? {};

  if (!email || !senha || !tipo || !nomeDeUsuario) {
    return res.status(400).json({
      error: "Campos obrigatórios: nomeDeUsuario, email, senha, tipo.",
    });
  }

  try {
    const tipoEnum = stringParaTipoUsuario(tipo);
    if (!tipoEnum) return res.status(400).json({ error: "Tipo de usuário inválido." });

    const precisaNascimento =
      tipoEnum === TipoUsuario.Atleta ||
      tipoEnum === TipoUsuario.Olheiro ||
      tipoEnum === TipoUsuario.Professor;

    const dataNascFinal = precisaNascimento && dataNascimento
      ? new Date(dataNascimento)
      : null;

    const emailNorm = String(email).trim().toLowerCase();
    const usernameFinal = String(nomeDeUsuario).trim().toLowerCase();
    // ✅ nome agora é opcional: se não vier, usa o username como nome
    const nomeFinal = String(nome ?? "").trim() || usernameFinal;
    const [jaEmail, jaUser] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: emailNorm } }),
      prisma.usuario.findUnique({ where: { nomeDeUsuario: usernameFinal } }),
    ]);
    if (jaEmail) return res.status(400).json({ error: "E-mail já cadastrado." });
    if (jaUser)  return res.status(400).json({ error: "Nome de usuário indisponível." });

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome: nomeFinal,
        email: emailNorm,
        nomeDeUsuario: usernameFinal,
        senhaHash,
        tipo: tipoEnum,
        cidade: cidade ?? null,
        estado: estado ?? null,
        pais:   pais ?? null,
        logradouro: logradouro ?? null,
        cpf:    cpf ?? null,
        dataNascimento: dataNascFinal,
        responsavelNome: responsavel?.nome ?? null,
        responsavelEmail: responsavel?.email ?? null,
        responsavelTelefone: responsavel?.telefone ?? null,
      },
      select: { id: true, tipo: true, nome: true, email: true },
    });

    let tipoUsuarioId: string | null = null;

    switch (tipoEnum) {
      case TipoUsuario.Atleta: {
        const categorias = Array.isArray((req.body as any)?.categorias)
          ? (req.body as any).categorias
          : Array.isArray((req.body as any)?.categoria)
          ? (req.body as any).categoria
          : [];

        const idadeFinal = dataNascFinal
          ? (new Date().getFullYear() - dataNascFinal.getFullYear()
              - ((new Date().getMonth() < dataNascFinal.getMonth()
                  || (new Date().getMonth() === dataNascFinal.getMonth()
                      && new Date().getDate() < dataNascFinal.getDate()))
                ? 1
                : 0))
          : (typeof idade === "number" ? idade : 0);

        const atleta = await prisma.atleta.create({
          data: {
            usuarioId: usuario.id,
            idade: Math.max(0, idadeFinal),
            categoria: categorias,
            email: emailNorm,
          },
          select: { id: true },
        });

        if (
          tipo === "ATLETA" &&
          vinculo?.desejaVinculo &&
          vinculo?.destinatarioId
        ) {
          const destinatarioId = String(vinculo.destinatarioId || "").trim();

          const destinatarioExiste = await prisma.usuario.findUnique({
            where: { id: destinatarioId },
            select: { id: true },
          });

          if (destinatarioExiste) {
            const existente = await prisma.solicitacaoTreino.findFirst({
              where: {
                status: { in: ["pendente", "ativa"] },
                OR: [
                  { remetenteId: usuario.id, destinatarioId },
                  { remetenteId: destinatarioId, destinatarioId: usuario.id },
                ],
              },
            });

            if (!existente) {
              await prisma.solicitacaoTreino.create({
                data: {
                  remetenteId: usuario.id,
                  destinatarioId,
                  status: "pendente",
                },
              });
            }

            await prisma.notificacao.create({
              data: {
                usuarioId: destinatarioId,
                actorId: usuario.id,
                tipo: "GENERICA",
                titulo: "Solicitação de treino",
                mensagem: "quer se vincular/treinar junto com você",
                link: "/notificacoes",
                lida: false,
              },
            });

            await recomputeAndEmitBadge(destinatarioId);
          }
        }

        await prisma.pontuacaoAtleta.create({ data: { atletaId: atleta.id } });
        tipoUsuarioId = atleta.id;
        break;
      }
      case TipoUsuario.Professor: {
        const areaFormacaoFinal =
          typeof areaFormacao === "string" && areaFormacao.trim()
            ? areaFormacao.trim()
            : null;

        const crefFinal =
          typeof cref === "string" && cref.trim()
            ? cref.trim()
            : null;

        const professor = await prisma.professor.create({
          data: {
            nome: nomeFinal,
            codigo: gerarCodigo("PRF"),
            areaFormacao: areaFormacaoFinal,
            cref: crefFinal,
            statusCref: crefFinal
              ? (mapStatusCref(statusCref) ?? StatusCref.Pendente)
              : null,
            qualificacoes: [],
            certificacoes: [],
            fotoUrl: null,
            usuarioId: usuario.id,
            email: emailNorm,
          },
          select: { id: true },
        });

        tipoUsuarioId = professor.id;
        break;
      }
      case TipoUsuario.Clube: {
        const emailNormLocal = String(email).trim().toLowerCase();
        const clube = await prisma.clube.create({
          data: {
            usuarioId: usuario.id,
            nome: String(nomeClube ?? nome ?? "").trim() || nomeFinal,
            cnpj: cnpjClube ?? null,
            telefone1: telefone1Clube ?? null,
            telefone2: telefone2Clube ?? null,
            email: (emailClube ?? emailNormLocal) || null,
            siteOficial: siteOficialClube ?? null,
            sede: sedeClube ?? null,
            logradouro: logradouroClube ?? null,
            numero: numeroClube ?? null,
            complemento: complementoClube ?? null,
            bairro: bairroClube ?? bairro ?? null,
            cidade: cidadeClube ?? cidade ?? null,
            estado: estadoClube ?? estado ?? null,
            pais:   paisClube ?? pais ?? null,
            cep: cepClube ?? null,
            estadio: estadio ?? null,
            logo: null,
          },
          select: { id: true },
        });
        tipoUsuarioId = clube.id;
        break;
      }

      case TipoUsuario.Escolinha: {
        const emailNormLocal = String(email).trim().toLowerCase();
        const escolinha = await prisma.escolinha.create({
          data: {
            usuarioId: usuario.id,
            nome: String(nomeEscolinha ?? nome ?? "").trim() || nomeFinal,
            cnpj: cnpjEscolinha ?? null,
            telefone1: telefone1Escolinha ?? null,
            telefone2: telefone2Escolinha ?? null,
            email: (emailEscolinha ?? emailNormLocal) || null,
            siteOficial: siteOficialEscolinha ?? null,
            sede: sedeEscolinha ?? null,
            logradouro: logradouroEscolinha ?? null,
            numero: numeroEscolinha ?? null,
            complemento: complementoEscolinha ?? null,
            bairro: bairroEscolinha ?? bairro ?? null,
            cidade: cidadeEscolinha ?? cidade ?? null,
            estado: estadoEscolinha ?? estado ?? null,
            pais:   paisEscolinha ?? pais ?? null,
            cep: cepEscolinha ?? null,
            logo: null,
          },
          select: { id: true },
        });
        tipoUsuarioId = escolinha.id;
        break;
      }

      case TipoUsuario.Olheiro: {
        const qtdColabs =
          Number(Boolean(colaboracaoClubeId)) +
          Number(Boolean(colaboracaoProfessorId)) +
          Number(Boolean(colaboracaoEscolinhaId));

        if (tipoEnum === TipoUsuario.Olheiro && qtdColabs > 1) {
          return res.status(400).json({
            error: "O olheiro só pode iniciar com um vínculo selecionado.",
          });
        }

        if (colaboracaoProfessorId) {
          const prof = await prisma.professor.findUnique({
            where: { id: colaboracaoProfessorId },
            select: { id: true },
          });
          if (!prof) {
            return res.status(400).json({
              error: "colaboracaoProfessorId inválido. Envie o id da entidade Professor.",
            });
          }
        }

        if (colaboracaoClubeId) {
          const clube = await prisma.clube.findUnique({
            where: { id: colaboracaoClubeId },
            select: { id: true },
          });
          if (!clube) {
            return res.status(400).json({
              error: "colaboracaoClubeId inválido. Envie o id da entidade Clube.",
            });
          }
        }

        if (colaboracaoEscolinhaId) {
          const escola = await prisma.escolinha.findUnique({
            where: { id: colaboracaoEscolinhaId },
            select: { id: true },
          });
          if (!escola) {
            return res.status(400).json({
              error: "colaboracaoEscolinhaId inválido. Envie o id da entidade Escolinha.",
            });
          }
        }

        const olheiro = await prisma.olheiro.create({
          data: {
            usuarioId: usuario.id,
            fotoUrl: null,
            headline: headline ?? null,
            descricao: descricao ?? null,
            areaAtuacao: areaAtuacao ?? null,
            anosExperiencia:
              typeof anosExperiencia === "number"
                ? anosExperiencia
                : (anosExperiencia ? Number(anosExperiencia) : 0),
            emailPublico: (emailPublico ?? emailNorm) || null,
            telefonePublico: telefonePublico ?? null,
            siteOuLinkedin: siteOuLinkedin ?? null,
            colaboracaoClubeId: colaboracaoClubeId || null,
            colaboracaoProfessorId: colaboracaoProfessorId || null,
            colaboracaoEscolinhaId: colaboracaoEscolinhaId || null,
          },
          select: { id: true },
        });
        tipoUsuarioId = olheiro.id;
        break;
      }
      case TipoUsuario.Admin: {
        const admin = await prisma.administrador.create({
          data: { usuarioId: usuario.id, cargo: "Administrador Geral", nivel: Nivel.Base },
          select: { id: true },
        });
        tipoUsuarioId = admin.id;
        break;
      }
    }

    try {
      let idadeCalc: number | null = null;
      if (dataNascFinal) {
        const d = new Date(dataNascFinal);
        const hoje = new Date();
        idadeCalc =
          hoje.getFullYear()
          - d.getFullYear()
          - ((hoje.getMonth() < d.getMonth()
              || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) ? 1 : 0);
      }

      if (vinculo?.desejaVinculo && vinculo?.destinatarioId) {
        await criarSolicitacaoVinculoCadastro({
          remetenteId: usuario.id,
          destinatarioId: vinculo.destinatarioId,
        });
      }

      const privacidadeDefault =
        idadeCalc !== null && idadeCalc < 12
          ? { perfil: "private",    dms: "closed",         geoloc: false, videosAudience: "private" }
          : idadeCalc !== null && idadeCalc < 18
          ? { perfil: "restricted", dms: "verified_only",  geoloc: false, videosAudience: "followers" }
          : { perfil: "public",     dms: "open",           geoloc: false, videosAudience: "public" };

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { configuracoesPrivacidade: privacidadeDefault as any },
      });
    } catch (e) {
      console.error("Falha ao setar privacidade default:", e);
    }

    let token: string | null = null;
    if (JWT_SECRET) {
      token = jwt.sign(
        { userId: usuario.id, tipo: usuario.tipo },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
    }

    try {
      const usr = await prisma.usuario.findUnique({ where: { id: usuario.id } });
      let idadeCalc: number | null = null;
      if (usr?.dataNascimento) {
        const d = new Date(usr.dataNascimento);
        const h = new Date();
        idadeCalc = h.getFullYear() - d.getFullYear() - (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate()) ? 1 : 0);
      }
      const isMenor = idadeCalc !== null && idadeCalc < 18;
      const destino = isMenor && usr?.responsavelEmail ? usr.responsavelEmail : usr!.email;

      await issueEmailVerification({
        userId: usuario.id,
        emailDestino: destino!,
        isResponsavel: Boolean(isMenor),
        nome: usuario.nome,
        username: usernameFinal,
        tipo: String(usuario.tipo),
        cidade: usr?.cidade ?? null,
        estado: usr?.estado ?? null,
      });
    } catch (e) {
      console.error("Falha ao enviar verificação:", e);
    }

    return res.status(201).json({
      message: "Usuário cadastrado. Enviamos um e-mail para verificação.",
      usuarioId: usuario.id,
      tipoUsuarioId,
      tipo: usuario.tipo,
      token,
      needsEmailVerification: true,
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const alvo = Array.isArray(err?.meta?.target) ? err.meta.target.join(", ") : "campo único";
      return res.status(409).json({ error: `Conflito: já existe registro com o mesmo ${alvo}.` });
    }
    console.error("Erro ao cadastrar usuário:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
};

export async function verificarEmail(req: Request, res: Response) {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).json({ ok: false, message: "Token ausente." });

  try {
    const rec = await prisma.emailVerification.findFirst({
      where: { token: String(token) },
    });

    if (!rec) return res.status(400).json({ ok: false, message: "Token inválido." });
    if (rec.expiraEm && rec.expiraEm < new Date()) {
      return res.status(410).json({ ok: false, message: "Token expirado. Solicite novo envio." });
    }

    if (rec.usadoEm) {
      return res.json({ ok: true, message: "E-mail já verificado.", alreadyVerified: true });
    }

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: rec.usuarioId },
        data: { verified: true },
      }),
      prisma.emailVerification.update({
        where: { usuarioId: rec.usuarioId },
        data: { usadoEm: new Date() },
      }),
    ]);

    return res.json({ ok: true, message: "E-mail verificado com sucesso!" });
  } catch (err) {
    console.error("Erro ao verificar e-mail:", err);
    return res.status(500).json({ ok: false, message: "Erro ao verificar e-mail." });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const rawUser = String(req.body?.nomeDeUsuario || "").trim().toLowerCase();
    const rawEmail = String(req.body?.email || "").trim().toLowerCase();
    if (!rawUser && !rawEmail) {
      return res.status(400).json({ message: "Informe nomeDeUsuario ou email." });
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          rawUser ? { nomeDeUsuario: rawUser } : undefined,
          rawEmail ? { email: rawEmail } : undefined,
        ].filter(Boolean) as any,
      },
    });
    if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });
    if (usuario.verified) return res.json({ message: "Usuário já verificado." });

    const raw = crypto.randomBytes(32).toString("hex");
    await prisma.emailVerification.upsert({
      where: { usuarioId: usuario.id },
      update: { token: raw, expiraEm: addHours(new Date(), 24), usadoEm: null },
      create: { usuarioId: usuario.id, token: raw, expiraEm: addHours(new Date(), 24) },
    });

    let idadeCalc: number | null = null;
    if (usuario.dataNascimento) {
      const d = new Date(usuario.dataNascimento);
      const h = new Date();
      idadeCalc = h.getFullYear() - d.getFullYear() - (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate()) ? 1 : 0);
    }
    const isMenor = idadeCalc !== null && idadeCalc < 18;
    const destino = (isMenor && usuario.responsavelEmail) ? usuario.responsavelEmail : usuario.email;
    if (!destino) return res.status(400).json({ message: "Usuário sem e-mail cadastrado." });

    const verifyUrl = `${FRONTEND_URL}/verificar-email?token=${encodeURIComponent(raw)}`;

    await sendEmailVerification({
      to: destino,
      verifyUrl,
      isResponsavel: Boolean(isMenor),
      nome: usuario.nome,
      username: usuario.nomeDeUsuario,
      tipo: String(usuario.tipo),
      cidade: usuario.cidade ?? null,
      estado: usuario.estado ?? null,
    });

    return res.json({ ok: true, message: "Reenviamos o e-mail de verificação.", emailDestino: destino });
  } catch (err) {
    console.error("Erro no resendVerification:", err);
    return res.status(500).json({ message: "Falha ao reenviar e-mail de verificação." });
  }
}

function stringParaTipoUsuario(v: any): TipoUsuario | null {
  const s = String(v ?? "").toLowerCase();
  if (s === "atleta") return TipoUsuario.Atleta;
  if (s === "professor") return TipoUsuario.Professor;
  if (s === "clube") return TipoUsuario.Clube;
  if (s === "escolinha") return TipoUsuario.Escolinha;
  if (s === "admin") return TipoUsuario.Admin;
  if (s === "olheiro") return TipoUsuario.Olheiro;
  return null;
}

function mapStatusCref(v: any): StatusCref | null {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s.startsWith("ati")) return StatusCref.Ativo;
  if (s.startsWith("des")) return StatusCref.Desativo;
  if (s.startsWith("pen")) return StatusCref.Pendente;
  return null;
}

function gerarCodigo(prefixo: string) {
  return `${prefixo}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
}
