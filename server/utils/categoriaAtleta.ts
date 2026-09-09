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
  let idade =
    hoje.getFullYear() -
    dataNascimento.getFullYear();

  const aindaNaoFezAniversario =
    hoje.getMonth() <
      dataNascimento.getMonth() ||
    (
      hoje.getMonth() ===
        dataNascimento.getMonth() &&
      hoje.getDate() <
        dataNascimento.getDate()
    );

  if (aindaNaoFezAniversario) {
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