import { PrismaClient, Categoria, PosicaoCampo } from "@prisma/client";

const prisma = new PrismaClient();

type DonoVinculo =
  | { tipo: "Clube"; id: string }
  | { tipo: "Professor"; id: string }
  | { tipo: "Escolinha"; id: string };

export async function salvarHistoricoAtletaVinculo(opts: {
  atletaId: string;
  dono: DonoVinculo;
  inicioVinculo?: Date | null;
  fimVinculo?: Date | null;
}) {
  const { atletaId, dono, inicioVinculo, fimVinculo } = opts;

  const atleta = await prisma.atleta.findUnique({
    where: { id: atletaId },
  });

  if (!atleta) return;

  const expiraEm = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await prisma.atletaHistoricoVinculo.create({
    data: {
      atletaId: atleta.id,

      professorId: dono.tipo === "Professor" ? dono.id : null,
      escolinhaId: dono.tipo === "Escolinha" ? dono.id : null,
      clubeId: dono.tipo === "Clube" ? dono.id : null,

      nome: atleta.nome,
      sobrenome: atleta.sobrenome,
      email: atleta.email,
      cpf: atleta.cpf,
      foto: atleta.foto,
      idade: atleta.idade,
      posicao: atleta.posicao,
      nacionalidade: atleta.nacionalidade,
      naturalidade: atleta.naturalidade,
      altura: atleta.altura,
      peso: atleta.peso,
      categoria: atleta.categoria,
      seloQualidade: atleta.seloQualidade,

      inicioVinculo: inicioVinculo ?? atleta.dataCriacao,
      fimVinculo: fimVinculo ?? new Date(),

      expiraEm,
    },
  });
}