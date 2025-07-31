import { Request, Response } from "express";
import { PrismaClient, TipoUsuario, Nivel } from "@prisma/client";
import bcrypt from "bcryptjs";

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

export const criarUsuario = async (req: Request, res: Response) => {
  const {
    nomeDeUsuario,
    nome,
    email,
    senha,
    tipo,
    cidade,
    estado,
    pais,
    bairro,
    cpf
  } = req.body;

  if (!nomeDeUsuario || !nome || !email || !senha || !tipo) {
    return res.status(400).json({ message: "Campos obrigatórios ausentes." });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nomeDeUsuario,
        nome,
        email,
        senhaHash,
        tipo: tipo as TipoUsuario,
        cidade,
        estado,
        pais,
        bairro,
        cpf
      }
    });

    return res.status(201).json({ message: "Usuário cadastrado com sucesso!", usuario: novoUsuario });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return res.status(500).json({ message: "Erro interno no servidor." });
  }
};

export const cadastrarUsuario = async (req: Request, res: Response) => {
  const { nome, email, senha, tipo } = req.body;

  if (!nome || !email || !senha || !tipo) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios." });
  }

  try {
    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });

    if (usuarioExistente) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        nomeDeUsuario: nome.toLowerCase().replace(/\s+/g, "_"),
        tipo,
      },
    });

    switch (tipo) {
      case TipoUsuario.Atleta:
        const novoAtleta = await prisma.atleta.create({
          data: {
            usuarioId: novoUsuario.id,
            nome: nome,
            sobrenome: "",
            idade: 0,
            cpf: "",
            telefone1: "",
            telefone2: "",
            nacionalidade: "",
            naturalidade: "",
            posicao: "",
            altura: 0,
            peso: 0,
            seloQualidade: "false",
            foto: null,
          },
        });

        await prisma.pontuacaoAtleta.create({
          data: {
            atletaId: novoAtleta.id,
            pontuacaoPerformance: 0,
            pontuacaoDisciplina: 0,
            pontuacaoResponsabilidade: 0,
          }
        });
        break;


      case TipoUsuario.Professor:
        await prisma.professor.create({
          data: {
            usuarioId: novoUsuario.id,
            nome,
            codigo: "PRF-" + Math.floor(Math.random() * 10000),
            cref: "000000-G/SP",
            areaFormacao: "Educação Física",
            statusCref: "Ativo",
            qualificacoes: [],
            certificacoes: [],
          },
        });
        break;

      case TipoUsuario.Clube:
        await prisma.clube.create({
          data: {
            usuarioId: novoUsuario.id,
            nome,
            cidade: "Cidade Exemplo",
            estado: "SP",
            pais: "Brasil",
            bairro: "Centro",
            telefone1: "(11) 99999-0000",
            telefone2: "(11) 98888-0000",
            estadio: "Estádio Padrão",
            siteOficial: "https://www.clubeexemplo.com",
          },
        });
        break;

      case TipoUsuario.Escolinha:
        await prisma.escolinha.create({
          data: {
            usuarioId: novoUsuario.id,
            nome,
            cidade: "Cidade Exemplo",
            estado: "SP",
            pais: "Brasil",
            bairro: "Bairro Exemplo",
            telefone1: "(11) 97777-0000",
            telefone2: "(11) 96666-0000",
            siteOficial: "https://www.escolinhaexemplo.com",
          },
        });
        break;

      case TipoUsuario.Admin:
        await prisma.administrador.create({
          data: {
            usuarioId: novoUsuario.id,
            cargo: "Administrador Geral",
            nivel: Nivel.Base, // Ou outro valor do enum que você definir
          },
        });
        break;

      default:
        return res.status(400).json({ error: "Tipo de usuário inválido." });
    }

    return res.status(201).json({ message: "Usuário cadastrado com sucesso." });
  } catch (err) {
    console.error("Erro ao cadastrar usuário:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
};