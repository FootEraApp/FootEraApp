import { Categoria } from "@prisma/client";
import { prisma } from "../prisma.js";

export async function sincronizarCategoriaAtleta(
  usuarioId: string
) {
  const usuario =
    await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },

      select: {
        dataNascimento: true,

        atleta: {
          select: {
            id: true,
            idade: true,
            categoria: true,
          },
        },
      },
    });

  if (
    !usuario?.dataNascimento ||
    !usuario.atleta
  ) {
    return null;
  }

  const idade =
    calcularIdadePorNascimento(
      usuario.dataNascimento
    );

  const categoria =
    categoriaAtletaPorIdade(
      idade
    );

  const categoriaAtual =
    usuario.atleta
      .categoria?.[0];

  if (
    usuario.atleta.idade !==
      idade ||
    categoriaAtual !==
      categoria ||
    usuario.atleta
      .categoria.length !== 1
  ) {
    await prisma.atleta.update({
      where: {
        id:
          usuario.atleta.id,
      },

      data: {
        idade,
        categoria: [
          categoria,
        ],
      },
    });
  }

  return {
    idade,
    categoria,
  };
}

export function calcularIdadePorNascimento(
  dataNascimento: Date,
  hoje = new Date()
): number {
  if (
    !Number.isFinite(dataNascimento.getTime()) ||
    !Number.isFinite(hoje.getTime())
  ) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(hoje);

  const numero = (tipo: string): number =>
    Number(partes.find((p) => p.type === tipo)?.value);

  const anoAtual = numero("year");
  const mesAtual = numero("month");
  const diaAtual = numero("day");

  const anoNascimento = dataNascimento.getUTCFullYear();
  const mesNascimento = dataNascimento.getUTCMonth() + 1;
  const diaNascimento = dataNascimento.getUTCDate();

  let idade = anoAtual - anoNascimento;

  if (
    mesAtual < mesNascimento ||
    (mesAtual === mesNascimento &&
      diaAtual < diaNascimento)
  ) {
    idade--;
  }

  return Math.max(0, idade);
}

export function categoriaAtletaPorIdade(
  idade: number
): Categoria {
  if (idade <= 3) {
    return Categoria.Sub3;
  }

  if (idade <= 5) {
    return Categoria.Sub5;
  }

  if (idade <= 7) {
    return Categoria.Sub7;
  }

  if (idade <= 9) {
    return Categoria.Sub9;
  }

  if (idade <= 11) {
    return Categoria.Sub11;
  }

  if (idade <= 13) {
    return Categoria.Sub13;
  }

  if (idade <= 15) {
    return Categoria.Sub15;
  }

  if (idade === 16) {
    return Categoria.Sub16;
  }

  if (idade === 17) {
    return Categoria.Sub17;
  }

  if (idade <= 20) {
    return Categoria.Sub20;
  }

  return Categoria.Livre;
}