import { Request, Response } from "express";
import { PrismaClient, TipoUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// GET /api/cadastro
export const getCadastroIndex = async (_req: Request, res: Response) => {
  res.json({ message: "Tela de cadastro inicial" });
};

// GET /api/cadastro/escolha
export const getEscolhaTipo = async (_req: Request, res: Response) => {
  res.json({ message: "Escolha o tipo de usuário: Atleta, Clube, Escolinha, Professor ou Admin" });
};

// GET /api/cadastro/criar
export const getCriar = async (_req: Request, res: Response) => {
  res.json({ message: "Formulário de criação de usuário" });
};

// DELETE /api/cadastro/deletar/:id
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

// POST /api/cadastro
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
