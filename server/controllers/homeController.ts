import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { sendMail } from "../utils/sendMail";
const prisma = new PrismaClient();

export const escolha = (_req: Request, res: Response) => {
  res.send("Escolha de perfil");
};

export const loginView = (_req: Request, res: Response) => {
  res.send("Login page");
};

export const index = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token não enviado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret") as any;
    const usuarioId = decoded.id;

    const seguindo = await prisma.seguidor.findMany({
      where: { seguidorUsuarioId: usuarioId },
      select: { seguidoUsuarioId: true },
    });
    const ids = seguindo.map(s => s.seguidoUsuarioId);
    ids.push(usuarioId);

    const postagens = await prisma.postagem.findMany({
      where: { usuarioId: { in: ids } },
      include: {
        usuario: true,
        comentarios: { include: { usuario: true } },
        curtidas: true,
      },
      orderBy: { dataCriacao: "desc" },
    });

    res.json(postagens);
  } catch (err) {
    res.status(401).json({ message: "Token inválido" });
  }
};

export const indexLogin = async (req: Request, res: Response) => {
  const { nomeDeUsuario, senha } = req.body;
  if (!nomeDeUsuario || !senha) {
    return res.status(400).json({ message: "Usuário e senha obrigatórios" });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { nomeDeUsuario } });
    if (!usuario) return res.status(401).json({ message: "Credenciais inválidas" });

    const match = await bcrypt.compare(senha, usuario.senhaHash);
    if (!match) return res.status(401).json({ message: "Senha incorreta" });

    const token = jwt.sign({ id: usuario.id, tipo: usuario.tipo }, process.env.JWT_SECRET || "defaultsecret", {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Erro interno" });
  }
};

export const curtir = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token não enviado" });
  try {
    const { postagemId } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret") as any;
    const usuarioId = decoded.id;

    const curtida = await prisma.curtida.findFirst({ where: { postagemId, usuarioId } });

    if (curtida) {
      await prisma.curtida.delete({ where: { id: curtida.id } });
    } else {
      await prisma.curtida.create({ data: { postagemId, usuarioId } });
    }

    const total = await prisma.curtida.count({ where: { postagemId } });
    res.json({ sucesso: true, curtidas: total });
  } catch (err) {
    res.status(500).json({ message: "Erro ao curtir" });
  }
};

export const comentar = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { postagemId, conteudo } = req.body;
  if (!token || !conteudo) return res.status(400).json({ message: "Dados inválidos" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret") as any;
    const usuarioId = decoded.id;

    await prisma.comentario.create({
      data: {
        postagemId,
        usuarioId,
        conteudo,
        dataCriacao: new Date(),
      },
    });

    res.status(201).json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ message: "Erro ao comentar" });
  }
};

export const postar = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { conteudo } = req.body;
  const file = (req as any).file;
  if (!token || !conteudo) return res.status(400).json({ message: "Conteúdo obrigatório" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret") as any;
    const usuarioId = decoded.id;

    const postagem = await prisma.postagem.create({
      data: {
        conteudo,
        usuarioId,
        dataCriacao: new Date(),
        tipoMidia: file ? (file.mimetype.includes("video") ? "Video" : "Imagem") : undefined,
        imagemUrl: file ? `/uploads/posts/${file.filename}` : undefined,
      },
    });

    res.status(201).json(postagem);
  } catch (err) {
    res.status(500).json({ message: "Erro ao postar" });
  }
};

export const faleConosco = async (req: Request, res: Response) => {
  const { nome, email, assunto, mensagem } = req.body;

  if (!nome || !email || !mensagem) {
    return res.status(400).json({ message: "Todos os campos são obrigatórios" });
  }

  try {
    await sendMail(
        "contato@footera.com.br",
        assunto,
        `Nome: ${nome}\nEmail: ${email}\nMensagem:\n${mensagem}`
    );


    res.json({ message: "Mensagem enviada com sucesso." });
  } catch (err) {
    res.status(500).json({ message: "Erro ao enviar a mensagem." });
  }
};
