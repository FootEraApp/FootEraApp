// server/controllers/cadastroController.ts
import { Request, Response } from "express";
import { PrismaClient, TipoUsuario, Nivel, StatusCref } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

export const getCadastroIndex = async (_req: Request, res: Response) => {
  res.json({ message: "Tela de cadastro inicial" });
};

export const getEscolhaTipo = async (_req: Request, res: Response) => {
  res.json({ message: "Escolha o tipo de usuário: Atleta, Clube, Escolinha, Professor ou Admin" });
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

/**
 * Busca pública para Etapa 3 (vínculo do atleta):
 * - query por nome / @username
 * - filtra por tipo (Professor | Clube | Escolinha | Todos)
 * - retorna SEMPRE id = usuarioId (para usar como destinatarioId)
 * - inclui foto/logo normalizada em fotoUrl
 */

export async function buscarPerfisPublico(req: Request, res: Response) {
  try {
    const tipo = String(req.query.tipo ?? "").trim(); // "Professor" | "Clube" | "Escolinha" | "Todos" | ""
    const q = String(req.query.query ?? "").trim();
    if (q.length < 2) return res.json([]);

    const BASE = process.env.BASE_URL || process.env.APP_BASE_URL || "";

    const whereCommon = {
      OR: [
        { nome: { contains: q, mode: "insensitive" as const } },
        { usuario: { nomeDeUsuario: { contains: q, mode: "insensitive" as const } } },
      ],
    };

    const buildFoto = (path?: string | null) =>
      path ? (path.startsWith("http") ? path : `${BASE}${path}`) : null;

    type Item = {
      id: string; // sempre o usuarioId (para destinatarioId)
      tipo: "Professor" | "Clube" | "Escolinha";
      nome: string | null;
      username: string | null;
      fotoUrl: string | null;
    };

    const items: Item[] = [];

    // Professores
    if (!tipo || tipo === "Todos" || tipo === "Professor") {
      const rows = await prisma.professor.findMany({
        where: whereCommon,
        select: {
          id: true,
          usuarioId: true, // string | null no tipo do Prisma
          nome: true,
          fotoUrl: true,
          usuario: { select: { nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });

      for (const r of rows) {
        if (!r.usuarioId) continue; // garante string
        items.push({
          id: r.usuarioId!, // ok após o guard
          tipo: "Professor",
          nome: r.nome,
          username: r.usuario?.nomeDeUsuario ?? null,
          fotoUrl: buildFoto(r.fotoUrl || r.usuario?.foto || null),
        });
      }
    }

    // Clubes
    if (!tipo || tipo === "Todos" || tipo === "Clube") {
      const rows = await prisma.clube.findMany({
        where: whereCommon,
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          logo: true,
          usuario: { select: { nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });

      for (const r of rows) {
        if (!r.usuarioId) continue;
        items.push({
          id: r.usuarioId!,
          tipo: "Clube",
          nome: r.nome,
          username: r.usuario?.nomeDeUsuario ?? null,
          fotoUrl: buildFoto(r.logo || r.usuario?.foto || null),
        });
      }
    }

    // Escolinhas
    if (!tipo || tipo === "Todos" || tipo === "Escolinha") {
      const rows = await prisma.escolinha.findMany({
        where: whereCommon,
        select: {
          id: true,
          usuarioId: true,
          nome: true,
          logo: true,
          usuario: { select: { nomeDeUsuario: true, foto: true } },
        },
        take: 20,
      });

      for (const r of rows) {
        if (!r.usuarioId) continue;
        items.push({
          id: r.usuarioId!,
          tipo: "Escolinha",
          nome: r.nome,
          username: r.usuario?.nomeDeUsuario ?? null,
          fotoUrl: buildFoto(r.logo || r.usuario?.foto || null),
        });
      }
    }

    items.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    return res.json(items);
  } catch (e) {
    console.error("buscarPerfisPublico error:", e);
    return res.status(500).json([]);
  }
}

export const cadastrarUsuario = async (req: Request, res: Response) => {
  const {
    // comuns
    nome, email, senha, tipo,
    nomeDeUsuario, cidade, estado, pais, bairro, cpf,

    // ATLETA
    idade,                // number (obrigatório p/ Atleta no seu schema)
    categoria,            // Categoria[] (ex.: ["Sub11", "Sub13"])

    // PROFESSOR
    areaFormacao,         // string (obrigatório no schema)
    cref,                 // string? (opcional)
    statusCref,           // "Ativo" | "Desativo" | "Pendente"

    // CLUBE
    nomeClube,            // opcional: se quiser diferenciar do "nome" do Usuario
    cnpjClube, telefone1Clube, telefone2Clube, emailClube,
    siteOficialClube, sedeClube, logradouroClube, numeroClube,
    complementoClube, bairroClube, cidadeClube, estadoClube, paisClube, cepClube, estadio,

    // ESCOLINHA
    nomeEscolinha,
    cnpjEscolinha, telefone1Escolinha, telefone2Escolinha, emailEscolinha,
    siteOficialEscolinha, sedeEscolinha, logradouroEscolinha, numeroEscolinha,
    complementoEscolinha, bairroEscolinha, cidadeEscolinha, estadoEscolinha, paisEscolinha, cepEscolinha,
  } = req.body ?? {};

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ error: "Campos obrigatórios: nome, email, senha, tipo." });
  }

  try {
    const tipoEnum = stringParaTipoUsuario(tipo);
    if (!tipoEnum) return res.status(400).json({ error: "Tipo de usuário inválido." });

    // normalizações
    const emailNorm = String(email).trim().toLowerCase();
    const usernameFinal = (nomeDeUsuario ? String(nomeDeUsuario) : String(nome).toLowerCase().replace(/\s+/g, "_"))
      .trim().toLowerCase();

    // checagem de duplicidade
    const [jaEmail, jaUser] = await Promise.all([
      prisma.usuario.findUnique({ where: { email: emailNorm } }),
      prisma.usuario.findUnique({ where: { nomeDeUsuario: usernameFinal } }),
    ]);
    if (jaEmail) return res.status(400).json({ error: "E-mail já cadastrado." });
    if (jaUser)  return res.status(400).json({ error: "Nome de usuário indisponível." });

    const senhaHash = await bcrypt.hash(String(senha), 10);

    // cria Usuario
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

    // cria o registro do TIPO (atenção aos @unique do schema)
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

        await prisma.pontuacaoAtleta.create({
          data: { atletaId: atleta.id },
        });

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

      case TipoUsuario.Admin: {
        const admin = await prisma.administrador.create({
          data: { usuarioId: usuario.id, cargo: "Administrador Geral", nivel: Nivel.Base },
          select: { id: true },
        });
        tipoUsuarioId = admin.id;
        break;
      }
    }

    // token (útil para a Etapa 3 de solicitação autenticada)
    let token: string | null = null;
    if (process.env.JWT_SECRET) {
      token = jwt.sign({ userId: usuario.id, tipo: usuario.tipo }, process.env.JWT_SECRET, { expiresIn: "7d" });
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

// ===== helpers =====
function stringParaTipoUsuario(v: any): TipoUsuario | null {
  const s = String(v ?? "").toLowerCase();
  if (s === "atleta") return TipoUsuario.Atleta;
  if (s === "professor") return TipoUsuario.Professor;
  if (s === "clube") return TipoUsuario.Clube;
  if (s === "escolinha") return TipoUsuario.Escolinha;
  if (s === "admin") return TipoUsuario.Admin;
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
  return `${prefixo}-${Math.floor(Math.random() * 10_000).toString().padStart(4, "0")}`;
}
