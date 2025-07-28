import { Request, Response } from "express";
import { PrismaClient, TipoUsuario, Categoria } from "@prisma/client";
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

export async function cadastrarUsuario(req: Request, res: Response) {
  const {
    tipo,
    nome,
    email,
    nomeDeUsuario,
    senha,
    idade,
    categoria,
    codigo,
    areaFormacao,
    nomeEscolinha,
    cnpjEscolinha,
    cidadeEscolinha,
    nomeClube,
    cnpjClube,
    cidadeClube,
  } = req.body;

  if (!tipo || !nome || !email || !nomeDeUsuario || !senha) {
    console.log("Dados incompletos:", { tipo, nome, email, nomeDeUsuario, senha });
    return res.status(400).json({ message: "Dados incompletos." });
  }

  const tipoLower = tipo.toLowerCase();
  console.log("Tipo de usuário (lowercase):", tipoLower);

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { nomeDeUsuario },
  });

  if (usuarioExistente) {
    console.log("Usuário já existe:", nomeDeUsuario);
    return res.status(400).json({ message: "Usuário já existe." });
  }

  const senhaHash = bcrypt.hashSync(senha, 10);

  try {
    
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        nomeDeUsuario,
        email,
        senhaHash,
        tipo,
      },
    });

    const { categoria } = req.body;

    if (tipoLower === "atleta") {
      console.log("Criando atleta para usuarioId:", usuario.id, "com idade:", idade, "e categoria:", categoria);

      if (idade === undefined) {
        console.log("Idade ausente para atleta");
        return res.status(400).json({ message: "Idade é obrigatória para atletas." });
      }

      if (!categoria || !Array.isArray(categoria)) {
        return res.status(400).json({ message: "Categoria é obrigatória e deve ser um array para atletas." });
      }

      await prisma.atleta.create({
        data: {
          usuarioId: usuario.id,
          idade: parseInt(idade),
          categoria,
        },
      });
      console.log("Atleta criado com sucesso.");
    } else if (tipoLower === "professor") {
      console.log("Criando professor para usuarioId:", usuario.id, "areaFormacao:", areaFormacao);

      if (!areaFormacao) {
        return res.status(400).json({ message: "Área de formação é obrigatória para professores." });
      }

      const totalProfessores = await prisma.professor.count();
      const codigoGerado = `PROF${String(totalProfessores + 1).padStart(3, "0")}`;

      await prisma.professor.create({
        data: {
          usuarioId: usuario.id,
          codigo: codigoGerado,
          areaFormacao,
          nome,
        },
      });
      console.log(`Professor criado com sucesso. Código: ${codigoGerado}`);
    } else if (tipoLower === "escolinha") {
      console.log("Criando escolinha para usuarioId:", usuario.id);

      if (!nomeEscolinha || !cnpjEscolinha || !cidadeEscolinha) {
        console.log("Dados incompletos para escolinha");
        return res.status(400).json({ message: "Dados da escolinha incompletos." });
      }

      await prisma.escolinha.create({
        data: {
          usuarioId: usuario.id,
          nome: nomeEscolinha,
          cnpj: cnpjEscolinha,
          cidade: cidadeEscolinha,
        },
      });
      console.log("Escolinha criada com sucesso.");
    } else if (tipoLower === "clube") {
      console.log("Criando clube para usuarioId:", usuario.id);

      if (!nomeClube || !cnpjClube || !cidadeClube) {
        console.log("Dados incompletos para clube");
        return res.status(400).json({ message: "Dados do clube incompletos." });
      }

      await prisma.clube.create({
        data: {
          usuarioId: usuario.id,
          nome: nomeClube,
          cnpj: cnpjClube,
          cidade: cidadeClube,
        },
      });
      console.log("Clube criado com sucesso.");
    }

    return res.status(201).json({ usuario });
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);
    return res.status(500).json({ message: "Erro ao cadastrar usuário." });
  }
}