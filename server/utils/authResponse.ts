// server/utils/authResponse.ts
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || "footera_secret";

export async function buildAuthResponse(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      atleta: { select: { id: true } },
      professor: { select: { id: true } },
      clube: { select: { id: true } },
      escolinha: { select: { id: true } },
      olheiro: { select: { id: true } },
      administrador: { select: { id: true } },
    },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado.");
  }

  const tipoUsuarioId =
    usuario.atleta?.id ??
    usuario.professor?.id ??
    usuario.clube?.id ??
    usuario.escolinha?.id ??
    usuario.olheiro?.id ??
    usuario.administrador?.id ??
    null;

  const token = jwt.sign(
    {
      id: usuario.id,
      tipo: usuario.tipo,
      tokenVersion: usuario.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

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