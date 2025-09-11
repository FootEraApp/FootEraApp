import { Request, Response } from "express";
import { PrismaClient, TipoUsuario, Nivel, StatusCref } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

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

    const BASE_URL = process.env.BASE_URL || process.env.APP_BASE_URL || "";

    const normProfessor = (rows: any[]) =>
      rows.map((p) => ({
        id: p.id as string,
        tipo: "Professor" as const,
        nome: p.nome as string,
        username: p.usuario?.nomeDeUsuario ?? "",
        fotoUrl:
          p.fotoUrl
            ? `${BASE_URL}${p.fotoUrl}`
            : p.usuario?.foto
              ? `${BASE_URL}${p.usuario.foto}`
              : null,
      }));

    const normClube = (rows: any[]) =>
      rows.map((c) => ({
        id: c.id as string,
        tipo: "Clube" as const,
        nome: c.nome as string,
        username: c.usuario?.nomeDeUsuario ?? "",
        fotoUrl:
          c.logo
            ? `${BASE_URL}${c.logo}`
            : c.usuario?.foto
              ? `${BASE_URL}${c.usuario.foto}`
              : null,
      }));

    const normEscolinha = (rows: any[]) =>
      rows.map((e) => ({
        id: e.id as string,
        tipo: "Escolinha" as const,
        nome: e.nome as string,
        username: e.usuario?.nomeDeUsuario ?? "",
        fotoUrl:
          e.logo
            ? `${BASE_URL}${e.logo}`
            : e.usuario?.foto
              ? `${BASE_URL}${e.usuario.foto}`
              : null,
      }));

    const normOlheiro = (rows: any[]) =>
      rows.map((o) => ({
        id: o.id as string,
        tipo: "Olheiro" as const,
        nome: o.usuario?.nome ?? "",
        username: o.usuario?.nomeDeUsuario ?? "",
        fotoUrl:
          o.fotoUrl
            ? `${BASE_URL}${o.fotoUrl}`
            : o.usuario?.foto
              ? `${BASE_URL}${o.usuario.foto}`
              : null,
      }));

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
          usuario: { select: { nomeDeUsuario: true, foto: true } },
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
          usuario: { select: { nomeDeUsuario: true, foto: true } },
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
          usuario: { select: { nomeDeUsuario: true, foto: true } },
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
          usuario: { select: { nome: true, nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });
      results.push(...normOlheiro(olheiros));
    }

    results.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    return res.json(results);
  } catch (e) {
    console.error("buscarPerfisPublico error:", e);
    return res.status(500).json([]);
  }
}

export const cadastrarUsuario = async (req: Request, res: Response) => {
  const {
    nome, email, senha, tipo,
    nomeDeUsuario, cidade, estado, pais, bairro, cpf,

    idade,
    categoria,

    areaFormacao,
    cref,
    statusCref,

    nomeClube,
    cnpjClube, telefone1Clube, telefone2Clube, emailClube,
    siteOficialClube, sedeClube, logradouroClube, numeroClube,
    complementoClube, bairroClube, cidadeClube, estadoClube, paisClube, cepClube, estadio,

    nomeEscolinha,
    cnpjEscolinha, telefone1Escolinha, telefone2Escolinha, emailEscolinha,
    siteOficialEscolinha, sedeEscolinha, logradouroEscolinha, numeroEscolinha,
    complementoEscolinha, bairroEscolinha, cidadeEscolinha, estadoEscolinha, paisEscolinha, cepEscolinha,

    areaAtuacao, anosExperiencia, headline, siteOuLinkedin,
    telefonePublico, emailPublico, descricao, colaboracaoClubeId,
  } = req.body ?? {};

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, email, senha, tipo." });
  }

  try {
    const tipoEnum = stringParaTipoUsuario(tipo);
    if (!tipoEnum) return res.status(400).json({ error: "Tipo de usuário inválido." });

    const emailNorm = String(email).trim().toLowerCase();
    const usernameFinal = (nomeDeUsuario ? String(nomeDeUsuario) : String(nome).toLowerCase().replace(/\s+/g, "_"))
      .trim().toLowerCase();

    const [jaEmail, jaUser] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: emailNorm } }),
      prisma.usuario.findUnique({ where: { nomeDeUsuario: usernameFinal } }),
    ]);
    if (jaEmail) return res.status(400).json({ error: "E-mail já cadastrado." });
    if (jaUser)  return res.status(400).json({ error: "Nome de usuário indisponível." });

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email: emailNorm,
        nomeDeUsuario: usernameFinal,
        senhaHash,
        tipo: tipoEnum,
        cidade: cidade ?? null,
        estado: estado ?? null,
        pais:   pais ?? null,
        bairro: bairro ?? null,
        cpf:    cpf ?? null,
      },
      select: { id: true, tipo: true, nome: true, email: true },
    });

    let tipoUsuarioId: string | null = null;

    switch (tipoEnum) {
      case TipoUsuario.Atleta: {
        const atleta = await prisma.atleta.create({
          data: {
            usuarioId: usuario.id,
            idade: typeof idade === "number" ? idade : 0,
            categoria: Array.isArray(categoria) ? categoria : [],
          },
          select: { id: true },
        });
        await prisma.pontuacaoAtleta.create({ data: { atletaId: atleta.id } });
        tipoUsuarioId = atleta.id;
        break;
      }

      case TipoUsuario.Professor: {
        const professor = await prisma.professor.create({
          data: {
            nome,
            codigo: gerarCodigo("PRF"),
            areaFormacao: areaFormacao ?? "Educação Física",
            cref: cref ?? null,
            statusCref: mapStatusCref(statusCref) ?? StatusCref.Pendente,
            qualificacoes: [],
            certificacoes: [],
            fotoUrl: null,
            usuarioId: usuario.id,
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
            nome: (nomeClube ?? nome),
            cnpj: cnpjClube ?? null,
            telefone1: telefone1Clube ?? null,
            telefone2: telefone2Clube ?? null,
            email: emailClube ?? null,
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
        const escolinha = await prisma.escolinha.create({
          data: {
            usuarioId: usuario.id,
            nome: (nomeEscolinha ?? nome),
            cnpj: cnpjEscolinha ?? null,
            telefone1: telefone1Escolinha ?? null,
            telefone2: telefone2Escolinha ?? null,
            email: emailEscolinha ?? null,
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
            emailPublico: emailPublico ?? null,
            telefonePublico: telefonePublico ?? null,
            siteOuLinkedin: siteOuLinkedin ?? null,
            colaboracaoClubeId: colaboracaoClubeId || null,
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

    // token
    let token: string | null = null;
    if (process.env.JWT_SECRET) {
      token = jwt.sign(
        { userId: usuario.id, tipo: usuario.tipo },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
    }

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso.",
      usuarioId: usuario.id,
      tipoUsuarioId,
      tipo: usuario.tipo,
      token,
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
  return `${prefixo}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")}`;
}
