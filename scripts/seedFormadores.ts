import { PrismaClient, TipoUsuario, Categoria, OrigemFormador } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const escolaUser = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'escola_formadores_seed' },
    update: {},
    create: {
      nome: 'Escola Seed Formadores',
      nomeDeUsuario: 'escola_formadores_seed',
      email: 'escola.formadores@seed.test',
      senhaHash: await bcrypt.hash('seed123', 10),
      tipo: TipoUsuario.Escolinha,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/escola-futebol.png',
      escolinha: {
        create: {
          nome: 'Escola Seed Formadores',
          cidade: 'São Paulo',
          estado: 'SP',
          pais: 'Brasil',
          email: 'escola.formadores@seed.test',
          cnpj: '00.000.000/0000-00',
          telefone1: '11999990000',
          logo: '/assets/usuarios/escola-futebol.png',
        },
      },
    },
  });

  const escolinha = await prisma.escolinha.findFirst({
    where: { usuarioId: escolaUser.id },
  });

  const atletaUser = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'formadores.atleta' },
    update: {},
    create: {
      nome: 'Atleta Seed',
      nomeDeUsuario: 'formadores.atleta',
      email: 'atleta.formadores@seed.test',
      senhaHash: await bcrypt.hash('atleta123', 10),
      tipo: TipoUsuario.Atleta,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/atleta-formadores.png',
      atleta: {
        create: {
          nome: 'Atleta',
          sobrenome: 'Seed',
          email: 'atleta.formadores@seed.test',
          idade: 17,
          posicao: 'MEI',
          altura: 1.76,
          peso: 66,
          nacionalidade: 'Brasileira',
          naturalidade: 'São Paulo - SP',
          telefone1: '11999990011',
          seloQualidade: 'Prata',
          categoria: [Categoria.Sub17],
          foto: '/assets/usuarios/atleta-formadores.png',
        },
      },
    },
  });

  const atleta = await prisma.atleta.findUnique({
    where: { usuarioId: atletaUser.id },
  });

  if (atleta && escolinha) {
    const jaTem = await prisma.vinculoFormacao.findFirst({
      where: {
        atletaId: atleta.id,
        origem: OrigemFormador.Escolinha,
        origemId: escolinha.id,
      },
    });

    if (!jaTem) {
      await prisma.vinculoFormacao.create({
        data: {
          atletaId: atleta.id,
          origem: OrigemFormador.Escolinha,
          origemId: escolinha.id,
          inicio: new Date(new Date().getFullYear() - 2, 0, 15),
          observacoes: 'Vínculo criado no seed de demonstração do módulo Formadores.',
        },
      });
    }
  }

  console.log('✅ Seed Formadores: 1 atleta + 1 vínculo criado(s). Abra /formadores e veja o dashboard.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });