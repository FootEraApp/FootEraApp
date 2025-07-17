import { PrismaClient, TipoUsuario, Nivel, Categoria } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clube1 = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'clube_footera' },
    update: {},
    create: {
      nome: 'Clube FootEra FC',
      nomeDeUsuario: 'clube_footera',
      email: 'clube.footera@example.com',
      senhaHash: 'hashClube123',
      tipo: TipoUsuario.Clube,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      clube: {
        create: {
          nome: "Clube FootEra FC",
          cidade: "São Paulo",
          estado: "SP",
          sede: "São Paulo",
          pais: "Brasil",
          telefone1: "11999990000",
          telefone2: "11999990001",
          logradouro: "Rua do Futebol",
          numero: "123",
          estadio: "Estádio FootEra",
          bairro: "Jardim das Palmeiras",
          complemento: "Campo 1",
          cep: "01234-567",
          cnpj: "12.345.678/0001-90",
          siteOficial: "https://clubefootera.com",
          email: "clube.footera@example.com",
          }
      }
    }
  });

  const clube2 = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'clube_teste' },
    update: {},
    create: {
      nome: 'Clube de Teste',
      nomeDeUsuario: 'clube_teste',
      email: 'clube.teste@example.com',
      senhaHash: 'hashClubeTeste123',
      tipo: TipoUsuario.Clube,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
      clube: {
        create: {
          nome: "Clube de Teste",
          cidade: "São Paulo",
          estado: "SP",
          pais: "Brasil",
          sede: "São Paulo",
          telefone1: "27999990010",
          telefone2: "27999990011",
          logradouro: "Rua do Teste",
          numero: "456",
          bairro: "Futebol teste",
          complemento: "Campo de Teste",
          cep: "12345-678",
          estadio: "Estádio de Teste",
          cnpj: "98.765.432/0001-01",
          siteOficial: "https://clube.teste.com",
          email: "clube.teste@example.com",
         }
      }
    }
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'escola_estrelas' },
    update: {},
    create: {
      nome: "Escola Estrelas do Futebol",
      nomeDeUsuario: "escola_estrelas",
      email: "estrelas@futebol.com",
      senhaHash: "hashEstrelas123",
      tipo: TipoUsuario.Escolinha,
      cidade: "São Paulo",
      estado: "SP",
      pais: "Brasil",
      escolinha: {
        create: {
          nome: "Escola Estrelas do Futebol",
          cidade: "São Paulo",
          estado: "SP",
          pais: "Brasil",
          email: "estrelas@futebol.com",
          cnpj: "12.345.678/0001-01",
          telefone1: "11999990002",
          telefone2: "11999990003",
          logradouro: "Avenida das Estrelas",
          numero: "789",
          bairro: "Jardim das Estrelas",
          complemento: "Campo 2",
          cep: "01234-567",
          sede: "São Paulo",
          siteOficial: "https://escolaestrelas.com",
          }
      }
    }
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'academia_fc' },
    update: {},
    create: {
      nome: "Academia FC",
      nomeDeUsuario: "academia_fc",
      email: "academia@futebol.com",
      senhaHash: "hashAcademia123",
      tipo: TipoUsuario.Escolinha,
      cidade: "Rio de Janeiro",
      estado: "RJ",
      pais: "Brasil",
      escolinha: {
        create: {
          nome: "Academia FC",
          cidade: "Rio de Janeiro",
          estado: "RJ",
          pais: "Brasil",
          cnpj: "98.765.432/0001-02",
          telefone1: "21999990004",
          telefone2: "21999990005",
          logradouro: "Rua do Treino",
          numero: "321",
          bairro: "Zona Sul",
          complemento: "Campo de Treino",
          cep: "12345-678",
          siteOficial: "https://academiafc.com",
          sede: "Rio de Janeiro",
          email: "academia@futebol.com",
          }
      }
    }
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'arthur.persio' },
    update: {},
    create: {
      nome: 'Arthur Persio de Azevedo',
      nomeDeUsuario: 'arthur.persio',
      email: 'arthur.persio@example.com',
      senhaHash: 'hashArthur123',
      tipo: TipoUsuario.Professor,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
      bairro: 'Centro',
      foto: '/assets/usuarios/arthur.jpg',
      professor: {
        create: {
          codigo: 'PROF001',
          cref: 'ES123456',
          areaFormacao: 'Educação Física',
          escola: 'Escola Estrelas',
          qualificacoes: 'Treinamento físico, técnico',
          certificacoes: 'Licença CBF A',
          fotoUrl: '/assets/usuarios/arthur.jpg',
          nome: 'Arthur Persio de Azevedo'
        }
      }
    }
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'juliana.souza' },
    update: {},
    create: {
      nome: 'Juliana Souza',
      nomeDeUsuario: 'juliana.souza',
      email: 'juliana.souza@example.com',
      senhaHash: 'hashJuliana123',
      tipo: TipoUsuario.Professor,
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      pais: 'Brasil',
      bairro: 'Copacabana',
      foto: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e',
      professor: {
        create: {
          codigo: 'PROF002',
          cref: 'RJ987654',
          areaFormacao: 'Fisiologia do Exercício',
          escola: 'Academia RJ',
          qualificacoes: 'Fisiologia, Agilidade',
          certificacoes: 'CBF Nível C',
          fotoUrl: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e',
          nome: 'Juliana Souza'
        }
      }
    }
  });

  const clube1Db = await prisma.clube.findFirst({
    where: { usuario: { nomeDeUsuario: "clube_footera" } }
  });

  const clube2Db = await prisma.clube.findFirst({
    where: { usuario: { nomeDeUsuario: "clube_teste" } }
  });


  const atletaLucas = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'lucas.ferreira' },
    update: {},
    create: {
      nomeDeUsuario: "lucas.ferreira",
      nome: "Lucas Silva",
      email: "lucas.ferreira@example.com",
      senhaHash: "hashLucas123",
      tipo: TipoUsuario.Atleta,
      cidade: "Vitória",
      estado: "ES",
      pais: "Brasil",
      atleta: {
        create: {
          nome: "Lucas Silva",
          sobrenome: "Ferreira",
          email: "lucas.ferreira@example.com",
          senhaHash: "hashLucas123",
          clubeId: clube2Db?.id,
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
          foto: "assets/usuarios/lucas.jpg"
        }
      }
    }
  });

  const atletaAna = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'ana.mendes' },
    update: {},
    create: {
      nomeDeUsuario: "ana.mendes",
      nome: "Ana Beatriz",
      email: "ana.mendes@example.com",
      senhaHash: "hashAna123",
      tipo: TipoUsuario.Atleta,
      cidade: "Vila Velha",
      estado: "ES",
      pais: "Brasil",
      atleta: {
        create: {
          nome: "Ana Beatriz",
          sobrenome: "Mendes",
          email: "ana.mendes@example.com",
          senhaHash: "hashAna123",
          clubeId: clube1Db?.id,
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
          foto: "assets/usuarios/ana.webp"
        }
      }
    }
  });

  const atletas = await prisma.atleta.findMany();
  for (const atleta of atletas) {
    await prisma.pontuacaoAtleta.upsert({
      where: { atletaId: atleta.id },
      update: {},
      create: {
        atletaId: atleta.id,
        pontuacaoTotal: 85,
        pontuacaoPerformance: 30,
        pontuacaoDisciplina: 25,
        pontuacaoResponsabilidade: 30
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
      videoDemonstrativoUrl: 'https://footera.com/sprint-direcao'
    },
    {
      codigo: 'EX006',
      nome: 'Cabeceio Defensivo',
      descricao: 'Técnica de cabeceio para defesa',
      nivel: Nivel.Avancado,
      categorias: [Categoria.Sub13],
      videoDemonstrativoUrl: 'https://footera.com/cabeceio-defensivo'
    }
  ];
  for (const ex of exercicios) {
    await prisma.exercicio.upsert({
      where: { codigo: ex.codigo },
      update: {},
      create: ex
    });
  }

  const desafios = [
    {
      titulo: 'Desafio Controle Aéreo',
      descricao: 'Mantenha a bola no ar pelo maior tempo possível usando diferentes partes do corpo.',
      imagemUrl: 'assets/controle-aereo.jpg',
      nivel: Nivel.Avancado,
      pontos: 10,
      categoria: [Categoria.Sub15]
    },
    {
      titulo: 'Desafio Equilíbrio e Agilidade',
      descricao: 'Supere um percurso de obstáculos mantendo o controle da bola.',
      imagemUrl: 'assets/treino-agilidade.webp',
      nivel: Nivel.Avancado,
      pontos: 8,
      categoria: [Categoria.Sub13]
    }
  ];
  for (const desafio of desafios) {
    const exists = await prisma.desafioOficial.findFirst({ where: { titulo: desafio.titulo } });
    if (!exists) {
      await prisma.desafioOficial.create({ data: desafio });
    }
  }

  console.log("✅ Seed do banco de dados FootEra criado com sucesso!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
