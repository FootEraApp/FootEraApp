// server/controllers/googleAuthController.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Nivel, StatusCref, TipoUsuario, AuthProvider, NotificacaoTipo } from "@prisma/client";
import { prisma } from "../prisma.js";
import { validateGoogleCredential } from "../services/googleTokenService.js";
import { recomputeAndEmitBadge } from "./notificacoesController.js";

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || "footera_secret";

function stringParaTipoUsuario(tipo: string): TipoUsuario | null {
  const t = String(tipo || "").trim().toUpperCase();

  switch (t) {
    case "ATLETA":
      return TipoUsuario.Atleta;
    case "PROFESSOR":
      return TipoUsuario.Professor;
    case "CLUBE":
      return TipoUsuario.Clube;
    case "ESCOLINHA":
      return TipoUsuario.Escolinha;
    case "OLHEIRO":
      return TipoUsuario.Olheiro;
    case "ADMIN":
      return TipoUsuario.Admin;
    case "LEARNING":
      return TipoUsuario.Learning;
    case "FEDERACAO":
    case "FEDERAÇÃO":
      return TipoUsuario.Federacao;
    case "MARCA":
      return TipoUsuario.Marca;
    default:
      return null;
  }
}

function mapStatusCref(status?: string | null): StatusCref | null {
  const s = String(status || "").trim().toLowerCase();

  if (s === "ativo") return StatusCref.Ativo;
  if (s === "desativo") return StatusCref.Desativo;
  if (s === "pendente") return StatusCref.Pendente;

  return null;
}

function gerarCodigo(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

function calcularIdade(dataNascimento: Date) {
  const hoje = new Date();
  return (
    hoje.getFullYear() -
    dataNascimento.getFullYear() -
    (
      hoje.getMonth() < dataNascimento.getMonth() ||
      (hoje.getMonth() === dataNascimento.getMonth() &&
        hoje.getDate() < dataNascimento.getDate())
        ? 1
        : 0
    )
  );
}

function gerarJwt(usuario: {
  id: string;
  tipo: any;
  tokenVersion?: number | null;
}) {
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

async function montarRespostaAuth(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      atleta: { select: { id: true } },
      professor: { select: { id: true } },
      clube: { select: { id: true } },
      escolinha: { select: { id: true } },
      olheiro: { select: { id: true } },
      learningProfile: { select: { id: true } },
      federacao: { select: { id: true } },
      marca: { select: { id: true } },
      administrador: { select: { id: true } },
    },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado após autenticação.");
  }

  const tipoUsuarioId =
    usuario.atleta?.id ??
    usuario.professor?.id ??
    usuario.clube?.id ??
    usuario.escolinha?.id ??
    usuario.olheiro?.id ??
    usuario.administrador?.id ??
    usuario.learningProfile?.id ??
    usuario.federacao?.id ??
    usuario.marca?.id ??
    null;

  const token = gerarJwt(usuario);

  await prisma.loginEvent.create({
    data: { usuarioId: usuario.id },
  });

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { lastLoginAt: new Date(), lastSeenAt: new Date() },
  });

  return {
    ok: true,
    message: "Login bem-sucedido",
    token,
    tipo: usuario.tipo,
    nomeDeUsuario: usuario.nomeDeUsuario,
    id: usuario.id,
    tipoUsuarioId,
    usuario: {
      id: usuario.id,
      nomeDeUsuario: usuario.nomeDeUsuario,
      tipo: usuario.tipo,
      email: usuario.email,
      verified: usuario.verified,
    },
  };
}

export async function googleLogin(req: Request, res: Response) {
  try {
    const { credential } = req.body ?? {};

    if (!credential) {
      return res.status(400).json({ message: "credential é obrigatória." });
    }

    const googleData = await validateGoogleCredential(String(credential));

    const usuarioComGoogle = await prisma.usuario.findUnique({
      where: { googleSub: googleData.sub },
    });

    if (usuarioComGoogle) {
      if (usuarioComGoogle.deletedAt) {
        return res.status(410).json({
          ok: false,
          code: "ACCOUNT_DELETED",
          message: "Sua conta foi excluída.",
        });
      }

      const status = String(usuarioComGoogle.status ?? "").toUpperCase();
      if (status === "BLOQUEADO" || usuarioComGoogle.blockedAt) {
        return res.status(403).json({
          ok: false,
          code: "ACCOUNT_BLOCKED",
          message:
            "Sua conta foi bloqueada pelo admin. Se quiser saber mais informações clique abaixo.",
          blockedReason: usuarioComGoogle.blockedReason ?? null,
        });
      }

      const authResp = await montarRespostaAuth(usuarioComGoogle.id);
      return res.json(authResp);
    }

    const usuarioMesmoEmail = await prisma.usuario.findUnique({
      where: { email: googleData.email },
    });

    if (usuarioMesmoEmail && !usuarioMesmoEmail.googleSub) {
      return res.status(409).json({
        ok: false,
        code: "EMAIL_ALREADY_EXISTS",
        message:
          "Já existe uma conta com esse e-mail. Entre com o login e a senha e conecte com o Google na parte de segurança nas configurações do perfil.",
      });
    }

    const preToken = crypto.randomBytes(32).toString("hex");

    await prisma.googlePreCadastro.create({
      data: {
        token: preToken,
        googleSub: googleData.sub,
        email: googleData.email,
        emailVerified: googleData.emailVerified,
        nome: googleData.name || null,
        foto: googleData.picture || null,
        expiresAt: addHours(new Date(), 2),
      },
    });

    return res.json({
      ok: true,
      needsCompletion: true,
      preCadastroToken: preToken,
      googleProfile: {
        email: googleData.email,
        name: googleData.name,
        picture: googleData.picture,
      },
    });
  } catch (error: any) {
    console.error("Erro no googleLogin:", error);
    return res.status(500).json({
      ok: false,
      message: error?.message || "Erro ao autenticar com Google.",
    });
  }
}

export async function googleCompleteRegistration(req: Request, res: Response) {
  const {
    preCadastroToken,
    nome,
    senha,
    tipo,
    nomeDeUsuario,
    cidade,
    estado,
    pais,
    bairro,
    cep,
    cpf,
    idade,
    categorias,
    areaFormacao,
    cref,
    statusCref,
    nomeClube,
    cnpjClube,
    telefone1Clube,
    telefone2Clube,
    emailClube,
    siteOficialClube,
    sedeClube,
    logradouroClube,
    numeroClube,
    complementoClube,
    bairroClube,
    cidadeClube,
    estadoClube,
    paisClube,
    cepClube,
    estadio,
    nomeEscolinha,
    cnpjEscolinha,
    telefone1Escolinha,
    telefone2Escolinha,
    emailEscolinha,
    siteOficialEscolinha,
    sedeEscolinha,
    logradouroEscolinha,
    numeroEscolinha,
    complementoEscolinha,
    bairroEscolinha,
    cidadeEscolinha,
    estadoEscolinha,
    paisEscolinha,
    cepEscolinha,
    areaAtuacao,
    anosExperiencia,
    telefonePublico,
    emailPublico,
    descricao,
    colaboracaoClubeId,
    dataNascimento,
    responsavel,
    vinculo,
    headline,
    siteOuLinkedin,
    nomeOrganizacao,
  } = req.body ?? {};

  if (!preCadastroToken || !senha || !tipo || !nomeDeUsuario) {
    return res.status(400).json({
      error: "Campos obrigatórios: preCadastroToken, senha, tipo, nomeDeUsuario.",
    });
  }

  function dataNascimentoPermitida(valor?: string | null) {
    if (!valor) return false;

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return false;

    const min = new Date("1900-01-01T00:00:00.000Z");
    const hoje = new Date();

    data.setHours(0, 0, 0, 0);
    hoje.setHours(23, 59, 59, 999);

    return data >= min && data <= hoje;
  }

  try {
    const pre = await prisma.googlePreCadastro.findUnique({
      where: { token: String(preCadastroToken) },
    });

    if (!pre) {
      return res.status(400).json({ error: "Pré-cadastro Google inválido." });
    }

    if (pre.expiresAt < new Date()) {
      await prisma.googlePreCadastro.delete({ where: { id: pre.id } }).catch(() => {});
      return res.status(400).json({ error: "Pré-cadastro Google expirado." });
    }

    const tipoEnum = stringParaTipoUsuario(tipo);
    if (!tipoEnum) {
      return res.status(400).json({ error: "Tipo de usuário inválido." });
    }

    const emailNorm = String(pre.email).trim().toLowerCase();
    const usernameFinal = String(nomeDeUsuario).trim().toLowerCase();
    const nomeFinal = String(nome ?? pre.nome ?? "").trim() || usernameFinal;

    const [jaEmail, jaUser, jaGoogle] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: emailNorm } }),
      prisma.usuario.findUnique({ where: { nomeDeUsuario: usernameFinal } }),
      prisma.usuario.findUnique({ where: { googleSub: pre.googleSub } }),
    ]);

    if (jaGoogle) {
      const authResp = await montarRespostaAuth(jaGoogle.id);
      return res.json(authResp);
    }

    if (jaEmail) {
      return res.status(400).json({
        error:
          "Já existe uma conta com esse e-mail. Entre com o login e a senha e conecte com o Google na parte de segurança nas configurações do perfil.",
      });
    }

    if (jaUser) {
      return res.status(400).json({ error: "Nome de usuário indisponível." });
    }

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const precisaNascimento =
      tipoEnum === TipoUsuario.Atleta ||
      tipoEnum === TipoUsuario.Olheiro ||
      tipoEnum === TipoUsuario.Professor;

    if (precisaNascimento && !dataNascimentoPermitida(dataNascimento)) {
      return res.status(400).json({
        error: "A data de nascimento deve estar entre 01/01/1900 e hoje.",
      });
    }

    const dataNascFinal =
      precisaNascimento && dataNascimento ? new Date(dataNascimento) : null;
    const idadeCalcInicial = dataNascFinal ? calcularIdade(dataNascFinal) : null;

    const precisaResponsavel =
      tipoEnum === TipoUsuario.Atleta &&
      idadeCalcInicial !== null &&
      idadeCalcInicial < 12;

    const usuario = await prisma.usuario.create({
      data: {
        nome: nomeFinal,
        email: emailNorm,
        nomeDeUsuario: usernameFinal,
        senhaHash,
        tipo: tipoEnum,
        cidade: cidade ?? null,
        estado: estado ?? null,
        pais: pais ?? null,
        cep: cep ?? null,
        cpf: cpf ?? null,
        dataNascimento: dataNascFinal,
        responsavelNome: precisaResponsavel ? responsavel?.nome ?? null : null,
        responsavelEmail: precisaResponsavel ? responsavel?.email ?? null : null,
        responsavelTelefone: precisaResponsavel ? responsavel?.telefone ?? null : null,

        googleSub: pre.googleSub,
        googleEmail: pre.email,
        googlePicture: pre.foto ?? null,
        authProvider: AuthProvider.GOOGLE,
        googleLinkedAt: new Date(),
        verified: pre.emailVerified,
        foto: pre.foto ?? null,
      },
      select: { id: true, tipo: true },
    });

    let tipoUsuarioId: string | null = null;

    switch (tipoEnum) {
      case TipoUsuario.Atleta: {
        const listaCategorias = Array.isArray(categorias) ? categorias : [];
        const idadeFinal = dataNascFinal
          ? Math.max(0, calcularIdade(dataNascFinal))
          : typeof idade === "number"
          ? idade
          : 0;

        const atleta = await prisma.atleta.create({
          data: {
            usuarioId: usuario.id,
            idade: idadeFinal,
            categoria: listaCategorias,
            email: emailNorm,
          },
          select: { id: true },
        });

        await prisma.pontuacaoAtleta.create({
          data: { atletaId: atleta.id },
        });

        tipoUsuarioId = atleta.id;
        break;
      }

      case TipoUsuario.Professor: {
        const professor = await prisma.professor.create({
          data: {
            nome: nomeFinal,
            codigo: gerarCodigo("PRF"),
            areaFormacao: areaFormacao ?? "Educação Física",
            cref: cref ?? null,
            statusCref: mapStatusCref(statusCref) ?? StatusCref.Pendente,
            qualificacoes: [],
            certificacoes: [],
            fotoUrl: pre.foto ?? null,
            usuarioId: usuario.id,
            email: emailNorm,
          },
          select: { id: true },
        });

        tipoUsuarioId = professor.id;
        break;
      }

      case TipoUsuario.Clube: {
        const clube = await prisma.clube.create({
          data: {
            usuarioId: usuario.id,
            nome: String(nomeClube ?? nomeFinal).trim(),
            cnpj: cnpjClube ?? null,
            telefone1: telefone1Clube ?? null,
            telefone2: telefone2Clube ?? null,
            email: emailClube ?? emailNorm,
            siteOficial: siteOficialClube ?? null,
            sede: sedeClube ?? null,
            logradouro: logradouroClube ?? null,
            numero: numeroClube ?? null,
            complemento: complementoClube ?? null,
            bairro: bairroClube ?? bairro ?? null,
            cidade: cidadeClube ?? cidade ?? null,
            estado: estadoClube ?? estado ?? null,
            pais: paisClube ?? pais ?? null,
            cep: cepClube ?? null,
            estadio: estadio ?? null,
            logo: pre.foto ?? null,
          },
          select: { id: true },
        });

        tipoUsuarioId = clube.id;
        break;
      }

      case TipoUsuario.Escolinha: {
        const escolinha = await prisma.escolinha.create({
          data: {
            usuarioId: usuario.id,
            nome: String(nomeEscolinha ?? nomeFinal).trim(),
            cnpj: cnpjEscolinha ?? null,
            telefone1: telefone1Escolinha ?? null,
            telefone2: telefone2Escolinha ?? null,
            email: emailEscolinha ?? emailNorm,
            siteOficial: siteOficialEscolinha ?? null,
            sede: sedeEscolinha ?? null,
            logradouro: logradouroEscolinha ?? null,
            numero: numeroEscolinha ?? null,
            complemento: complementoEscolinha ?? null,
            bairro: bairroEscolinha ?? bairro ?? null,
            cidade: cidadeEscolinha ?? cidade ?? null,
            estado: estadoEscolinha ?? estado ?? null,
            pais: paisEscolinha ?? pais ?? null,
            cep: cepEscolinha ?? null,
            logo: pre.foto ?? null,
          },
          select: { id: true },
        });

        tipoUsuarioId = escolinha.id;
        break;
      }

      case TipoUsuario.Olheiro: {
        const olheiro = await prisma.olheiro.create({
          data: {
            usuarioId: usuario.id,
            fotoUrl: pre.foto ?? null,
            descricao: descricao ?? null,
            areaAtuacao: areaAtuacao ?? null,
            anosExperiencia:
              typeof anosExperiencia === "number"
                ? anosExperiencia
                : anosExperiencia
                ? Number(anosExperiencia)
                : 0,
            emailPublico: emailPublico ?? emailNorm,
            telefonePublico: telefonePublico ?? null,
            colaboracaoClubeId: colaboracaoClubeId || null,
            headline: headline ?? null,
            siteOuLinkedin: siteOuLinkedin ?? null,
          },
          select: { id: true },
        });

        tipoUsuarioId = olheiro.id;
        break;
      }

      case TipoUsuario.Admin: {
        const admin = await prisma.administrador.create({
          data: {
            usuarioId: usuario.id,
            cargo: "Administrador Geral",
            nivel: Nivel.Base,
          },
          select: { id: true },
        });

        tipoUsuarioId = admin.id;
        break;
      }

      case TipoUsuario.Learning: {
        const learning = await prisma.learningProfile.create({
          data: {
            usuarioId: usuario.id,
          },
          select: { id: true },
        });

        tipoUsuarioId = learning.id;
        break;
      }

      case TipoUsuario.Federacao: {
        const federacao = await prisma.federacao.create({
          data: {
            usuarioId: usuario.id,
            nome: nomeOrganizacao || nomeClube || nomeEscolinha || nomeFinal,
            cnpj: cnpjClube || cnpjEscolinha || null,
            telefone1: telefone1Clube || telefone1Escolinha || null,
            telefone2: telefone2Clube || telefone2Escolinha || null,
            email: emailClube || emailEscolinha || emailNorm,
            siteOficial: siteOficialClube || siteOficialEscolinha || null,
            sede: sedeClube || sedeEscolinha || null,
            cidade: cidadeClube || cidadeEscolinha || cidade || null,
            estado: estadoClube || estadoEscolinha || estado || null,
            pais: paisClube || paisEscolinha || pais || null,
            cep: cepClube || cepEscolinha || null,
            descricao: descricao ?? null,
            logo: pre.foto ?? null,
          },
          select: { id: true },
        });

        await prisma.creator.upsert({
          where: { usuarioId: usuario.id },
          update: {
            tipo: "INSTITUCIONAL",
            instituicaoOficial: true,
            ativo: true,
          },
          create: {
            usuarioId: usuario.id,
            tipo: "INSTITUCIONAL",
            instituicaoOficial: true,
            ativo: true,
            nomePublico: nomeOrganizacao || nomeFinal,
            headline: "Canal oficial FootEra",
          },
        });

        tipoUsuarioId = federacao.id;
        break;
      }

      case TipoUsuario.Marca: {
        const marca = await prisma.marca.create({
          data: {
            usuarioId: usuario.id,
            nome: nomeOrganizacao || nomeClube || nomeEscolinha || nomeFinal,
            cnpj: cnpjClube || cnpjEscolinha || null,
            telefone1: telefone1Clube || telefone1Escolinha || null,
            telefone2: telefone2Clube || telefone2Escolinha || null,
            email: emailClube || emailEscolinha || emailNorm,
            siteOficial: siteOficialClube || siteOficialEscolinha || null,
            cidade: cidadeClube || cidadeEscolinha || cidade || null,
            estado: estadoClube || estadoEscolinha || estado || null,
            pais: paisClube || paisEscolinha || pais || null,
            cep: cepClube || cepEscolinha || null,
            descricao: descricao ?? null,
            logo: pre.foto ?? null,
          },
          select: { id: true },
        });

        await prisma.creator.upsert({
          where: { usuarioId: usuario.id },
          update: {
            tipo: "INSTITUCIONAL",
            instituicaoOficial: true,
            ativo: true,
          },
          create: {
            usuarioId: usuario.id,
            tipo: "INSTITUCIONAL",
            instituicaoOficial: true,
            ativo: true,
            nomePublico: nomeOrganizacao || nomeFinal,
            headline: "Canal oficial FootEra",
          },
        });

        tipoUsuarioId = marca.id;
        break;
      }
    }

    try {
      let idadeCalc: number | null = null;

      if (dataNascFinal) {
        idadeCalc = calcularIdade(dataNascFinal);
      }

      const privacidadeDefault =
        idadeCalc !== null && idadeCalc < 12
          ? {
              perfil: "private",
              dms: "closed",
              geoloc: false,
              videosAudience: "private",
            }
          : idadeCalc !== null && idadeCalc < 18
          ? {
              perfil: "restricted",
              dms: "verified_only",
              geoloc: false,
              videosAudience: "followers",
            }
          : {
              perfil: "public",
              dms: "open",
              geoloc: false,
              videosAudience: "public",
            };

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          configuracoesPrivacidade: privacidadeDefault,
        },
      });
    } catch (e) {
      console.warn("Falha ao criar privacidade padrão:", e);
    }

    if (vinculo?.desejaVinculo && vinculo?.destinatarioId) {
      try {
        await criarSolicitacaoVinculoCadastro({
          remetenteId: usuario.id,
          destinatarioId: vinculo.destinatarioId,
        });
      } catch (e) {
        console.warn("Falha ao criar solicitação de vínculo:", e);
      }
    }

    await prisma.googlePreCadastro.delete({
      where: { id: pre.id },
    });

    const authResp = await montarRespostaAuth(usuario.id);

    return res.json({
      ...authResp,
      tipoUsuarioId,
    });
  } catch (error: any) {
    console.error("Erro em googleCompleteRegistration:", error);
    return res.status(500).json({
      error: error?.message || "Erro ao finalizar cadastro com Google.",
    });
  }
}

export async function googleLinkAccount(req: any, res: Response) {
  try {
    const userId = req.userId;
    const { credential } = req.body ?? {};

    if (!userId) {
      return res.status(401).json({ message: "Não autenticado." });
    }

    if (!credential) {
      return res.status(400).json({ message: "credential é obrigatória." });
    }

    const googleData = await validateGoogleCredential(String(credential));

    const jaVinculado = await prisma.usuario.findUnique({
      where: { googleSub: googleData.sub },
      select: { id: true, nomeDeUsuario: true },
    });

    if (jaVinculado && jaVinculado.id !== userId) {
      return res.status(409).json({
        ok: false,
        message:
          "Esta conta Google já está vinculada a outro usuário da FootEra.",
      });
    }

    const usuarioAtual = await prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuarioAtual) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const novoProvider =
      usuarioAtual.authProvider === AuthProvider.LOCAL
        ? AuthProvider.LOCAL_GOOGLE
        : AuthProvider.GOOGLE;

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        googleSub: googleData.sub,
        googleEmail: googleData.email,
        googlePicture: googleData.picture,
        googleLinkedAt: new Date(),
        authProvider: novoProvider,
        ...(usuarioAtual.verified ? {} : { verified: googleData.emailVerified }),
        ...(usuarioAtual.foto ? {} : { foto: googleData.picture ?? null }),
      },
    });

    return res.json({
      ok: true,
      message: "Conta Google vinculada com sucesso.",
    });
  } catch (error: any) {
    console.error("Erro em googleLinkAccount:", error);
    return res.status(500).json({
      ok: false,
      message: error?.message || "Erro ao vincular conta Google.",
    });
  }
}