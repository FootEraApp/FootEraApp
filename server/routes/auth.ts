import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma"; 
import { TipoUsuario } from "@prisma/client"; 

const router = Router();

router.post("/auth/register", async (req, res) => {
  const {
    tipo,
    nome,
    email,
    nomeDeUsuario,
    senha,
    confirmarSenha,
    treinaEscolinha
  } = req.body;

  if (!nome || !email || !nomeDeUsuario || !senha || !confirmarSenha || !tipo) {
    return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });
  }

  if (senha !== confirmarSenha) {
    return res.status(400).json({ message: "As senhas não coincidem." });
  }

  try {
    const existeUsuario = await prisma.usuario.findFirst({
      where: {
        OR: [{ email }, { nomeDeUsuario }]
      }
    });

    if (existeUsuario) {
      return res.status(400).json({ message: "E-mail ou nome de usuário já está em uso." });
    }

    const hashed = await bcrypt.hash(senha, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        nomeDeUsuario,
        senhaHash: hashed,
        tipo: tipo as TipoUsuario,
      }
    });

   switch (tipo) {
      case "Atleta":
        await prisma.atleta.create({
          data: {
            usuarioId: novoUsuario.id,
            idade: 0, // Pode ser atualizado depois
            statusConexao: treinaEscolinha === "sim" ? "Pendente" : "Recusado"
          }
        });
        break;

 case "Clube":
        await prisma.clube.create({
          data: {
            usuarioId: novoUsuario.id,
            nome: nome,
            dataCriacao: new Date()
          }
        });
        break;

      case "Escolinha":
        await prisma.escolinha.create({
          data: {
            usuarioId: novoUsuario.id,
            nome: nome,
            dataCriacao: new Date()
          }
        });
        break;

      case "Professor":
        await prisma.professor.create({
          data: {
            usuarioId: novoUsuario.id,
            codigo: `PROF-${Date.now()}`,
            areaFormacao: "Não informado",
            nome: nome,
          }
        });
        break;

      default:
        return res.status(400).json({ message: "Tipo de usuário inválido." });
    }

    res.status(201).json({ message: "Conta criada com sucesso." });

  } catch (error) {
    console.error("Erro ao registrar:", error);
    res.status(500).json({ message: "Erro interno ao criar conta." });
  }
});

export default router;