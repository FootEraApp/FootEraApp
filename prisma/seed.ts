import { PrismaClient, TipoUsuario, Nivel, Categoria } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {

  let usuarioProfessor = await prisma.usuario.findUnique({
    where: { email: 'arthur.persio@example.com' },
  });

  if (!usuarioProfessor) {
    usuarioProfessor = await prisma.usuario.create({
      data: {
        nome: 'Arthur Persio de Azevedo',
        nomeDeUsuario: 'arthur.persio',
        email: 'arthur.persio@example.com',
        senhaHash: 'hashArthur123',
        tipo: TipoUsuario.Professor,
        cidade: 'Vitória',
        estado: 'ES',
        pais: 'Brasil',
        bairro: 'Centro',
      },
    });
  }

  let atleta1 = await prisma.usuario.findUnique({
    where: { email: 'lucas.ferreira@example.com' },
  });

  if (!atleta1) {
    atleta1 = await prisma.usuario.create({
      data: {
        nomeDeUsuario: "lucas.ferreira",
        nome: "Lucas Silva",
        email: "lucas.ferreira@example.com",
        senhaHash: "hashLucas123",
        tipo: TipoUsuario.Atleta,
        atleta: {
          create: {
            idade: 16,
            cpf: "12345678900",
            telefone1: "27999990000",
            nacionalidade: "Brasileiro",
            naturalidade: "Vitória - ES",
            posicao: "Meio-Campista",
            altura: 1.75,
            peso: 65.0,
            seloQualidade: "Prata",
            categoria: ['Sub17'],
            foto: "https://example.com/foto-lucas.jpg"
          }
        }
      }
    });
  }

  let atleta2 = await prisma.usuario.findUnique({
    where: { email: 'ana.mendes@example.com' },
  });

  if (!atleta2) {
    atleta2 = await prisma.usuario.create({
      data: {
        nomeDeUsuario: "ana.mendes",
        nome: "Ana Beatriz",
        email: "ana.mendes@example.com",
        senhaHash: "hashAna123",
        tipo: TipoUsuario.Atleta,
        atleta: {
          create: {
            idade: 15,
            cpf: "98765432100",
            telefone1: "27988880000",
            nacionalidade: "Brasileira",
            naturalidade: "Vila Velha - ES",
            posicao: "Atacante",
            altura: 1.65,
            peso: 58.0,
            seloQualidade: "Ouro",
            categoria: ['Sub15'],
            foto: "https://example.com/foto-ana.jpg"
          }
        }
      }
    });
  }

  const exercicios = [
    {
      codigo: 'EX005',
      nome: 'Sprint com Mudança de Direção',
      descricao: 'Velocidade e agilidade com mudanças bruscas',
      nivel: Nivel.Performance,
      categorias: [Categoria.Sub15],
      videoDemonstrativoUrl: 'https://example.com/sprint-direcao'
    },
    {
      codigo: 'EX006',
      nome: 'Cabeceio Defensivo',
      descricao: 'Técnica de cabeceio para defesa',
      nivel: Nivel.Avancado,
      categorias: [Categoria.Sub13],
      videoDemonstrativoUrl: 'https://example.com/cabeceio-defensivo'
    }
  ];

  for (const ex of exercicios) {
    const exists = await prisma.exercicio.findUnique({ where: { codigo: ex.codigo } });
    if (!exists) {
      await prisma.exercicio.create({ data: ex });
    }
  }

  const desafios = [
    {
      titulo: 'Desafio Controle Aéreo',
      descricao: 'Mantenha a bola no ar pelo maior tempo possível usando diferentes partes do corpo.',
      imagemUrl: 'https://example.com/controle-aereo.jpg',
      nivel: Nivel.Avancado,
      pontos: 10,
      categoria: [Categoria.Sub15]
    },
    {
      titulo: 'Desafio Equilíbrio e Agilidade',
      descricao: 'Supere um percurso de obstáculos mantendo o controle da bola.',
      imagemUrl: 'https://example.com/equilibrio-agilidade.jpg',
      nivel: Nivel.Avancado,
      pontos: 8,
      categoria: [Categoria.Sub13]
    }
  ];

  for (const desafio of desafios) {
    const exists = await prisma.desafioOficial.findFirst({
      where: { titulo: desafio.titulo }
    });
    if (!exists) {
      await prisma.desafioOficial.create({ data: desafio });
    }
  }

  const atletaEntity1 = await prisma.atleta.findFirst({
    where: { usuario: { nomeDeUsuario: "lucas.ferreira" } }
  });

  if (atletaEntity1) {
    const pontuacao1 = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId: atletaEntity1.id } });
    if (!pontuacao1) {
      await prisma.pontuacaoAtleta.create({
        data: {
          atletaId: atletaEntity1.id,
          pontuacaoTotal: 80,
          pontuacaoPerformance: 30,
          pontuacaoDisciplina: 25,
          pontuacaoResponsabilidade: 25,
        }
      });
    }
  }

  const atletaEntity2 = await prisma.atleta.findFirst({
    where: { usuario: { nomeDeUsuario: "ana.mendes" } }
  });

  if (atletaEntity2) {
    const pontuacao2 = await prisma.pontuacaoAtleta.findUnique({ where: { atletaId: atletaEntity2.id } });
    if (!pontuacao2) {
      await prisma.pontuacaoAtleta.create({
        data: {
          atletaId: atletaEntity2.id,
          pontuacaoTotal: 92,
          pontuacaoPerformance: 40,
          pontuacaoDisciplina: 30,
          pontuacaoResponsabilidade: 22,
        }
      });
    }
  }

  const usuario = await prisma.usuario.upsert({
    where: { nome: "Usuário Teste", nomeDeUsuario: "usuario_teste" },
    update: {},
    create: {
      nome: "Usuário Teste",
      tipo: "Admin",
      foto: "footera-logo.png", 
      nomeDeUsuario: "usuario_teste",
      senhaHash: "hashTeste123",
      email: " usuarioteste@gmail.com"

    },
  });

  await prisma.postagem.create({
    data: {
      conteudo: "Nosso ranking semanal de treinos está no ar! 🏆",
      tipoMidia: "Imagem",
      imagemUrl: "Ranking-treinos.png", 
      usuarioId: usuario.id,
    },
  });

  console.log('Seed finalizado com sucesso!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
