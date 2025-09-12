import { PrismaClient, TipoUsuario, TipoTreino, Nivel, Categoria } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

async function main() {
  const PASSWORDS = {
    'clube_footera': 'footera123',
    'clube_teste': 'clubeteste123',
    'escola_estrelas': 'escola123',
    'academia_fc': 'academia123',
    'arthur.persio': 'prof123',
    'mateus.furieri': 'prof123',
    'lucas.ferreira': 'atleta123',
    'ana.mendes': 'atleta123',
    'teste': 'teste123',
    'aaaaa': 'aaaaa123',
    'admin': 'admin123',
    'olheiro_joao': 'olheiro123',
  } as const;

  const H = Object.fromEntries(
    await Promise.all(
      Object.entries(PASSWORDS).map(async ([k, v]) => [k, await hash(v)])
    )
  ) as Record<string, string>;

  const clube1 = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'clube_footera' },
    update: {},
    create: {
      nome: 'Clube FootEra FC',
      nomeDeUsuario: 'clube_footera',
      email: 'clube.footera@example.com',
      senhaHash: H['clube_footera'],
      tipo: TipoUsuario.Clube,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/clube-footera.png',
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
          logo: "/assets/usuarios/clube-footera.png",
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
      senhaHash: H['clube_teste'],
      tipo: TipoUsuario.Clube,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
      foto: '/assets/usuarios/clube-teste.png',
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
          logo: "/assets/usuarios/clube-teste.png",
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
      senhaHash: H['escola_estrelas'],
      tipo: TipoUsuario.Escolinha,
      cidade: "São Paulo",
      estado: "SP",
      pais: "Brasil",
      foto: '/assets/usuarios/escola-futebol.png',
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
          logo: "/assets/usuarios/escola-futebol.png",
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
      senhaHash: H['academia_fc'],
      tipo: TipoUsuario.Escolinha,
      cidade: "Rio de Janeiro",
      estado: "RJ",
      pais: "Brasil",
      foto: '/assets/usuarios/academia-escola.png',
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
          logo: "/assets/usuarios/academia-escola.png",
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
      senhaHash: H['arthur.persio'],
      tipo: TipoUsuario.Professor,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
      bairro: 'Centro',
      foto: '/assets/usuarios/arthur.jpg',
      professor: {
        create: {
          codigo: 'PROF002',
          cref: 'ES123456',
          areaFormacao: 'Educação Física - UFES',
          escola: 'Escola Estrelas',
          qualificacoes: ['Treinamento físico, técnico'],
          certificacoes: ['Licença CBF A'],
          fotoUrl: '/assets/usuarios/arthur.jpg',
          nome: 'Arthur Persio de Azevedo'
        }
      }
    }
  });

  await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'mateus.furieri' },
  update: {},
  create: {
    nome: 'Mateus Barbarioli Furieri',
    nomeDeUsuario: 'mateus.furieri',
    email: 'mateus.furieri@example.com',
    senhaHash: H['mateus.furieri'],
    tipo: TipoUsuario.Professor,
    estado: 'ES',
    pais: 'Brasil',
    foto: '/assets/usuarios/prof-teste.png',
    professor: {
      create: {
        codigo: 'PROF001',
        cref: '015293-G/ES',
        areaFormacao: '',
        escola: '',
        qualificacoes: [],
        certificacoes: [],
        fotoUrl: '/assets/usuarios/prof-teste.png',
        nome: 'Mateus Barbarioli Furieri'
      }
    }
  }
});

await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'admin' },
  update: {},
  create: {
    nome: 'Administrador do Sistema',
    nomeDeUsuario: 'admin',
    email: 'admin@footera.example.com',
    senhaHash: H['admin'], 
    tipo: TipoUsuario.Admin,
    verified: true,
    cidade: 'São Paulo',
    estado: 'SP',
    pais: 'Brasil',
    foto: '/assets/usuarios/profa-teste.png',
    administrador: {
      create: {
        cargo: 'Super Admin',
        nivel: Nivel.Performance,
        fotoUrl: '/assets/usuarios/profa-teste.png',
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

  const olheiroJoao = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'olheiro_joao' },
    update: {},
    create: {
      nome: 'João Nogueira',
      nomeDeUsuario: 'olheiro_joao',
      email: 'olheiro.joao@example.com',
      senhaHash: H['olheiro.joao'],
      tipo: TipoUsuario.Olheiro, 
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/olheiro-joao.png',
      olheiro: {               
        create: {
          descricao: 'Olheiro independente em SP; 10 anos de experiência. Foco Sub15–Sub20.',
          areaAtuacao: 'Sudeste (SP, RJ, MG, ES)',
          telefonePublico: '11999997777',
          emailPublico: 'olheiro.joao@example.com',
          fotoUrl: '/assets/usuarios/olheiro-joao.png', 
          id: clube1Db?.id,
        }
      }
    }
  });

  const atletaLucas = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'lucas.ferreira' },
    update: {},
    create: {
      nomeDeUsuario: "lucas.ferreira",
      nome: "Lucas Silva",
      email: "lucas.ferreira@example.com",
      senhaHash: H['lucas.ferreira'],
      tipo: TipoUsuario.Atleta,
      cidade: "Vitória",
      estado: "ES",
      foto: "/assets/usuarios/lucas.jpg",
      pais: "Brasil",
      atleta: {
        create: {
          nome: "Lucas Silva",
          sobrenome: "Ferreira",
          email: "lucas.ferreira@example.com",
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
          categoria: [Categoria.Sub17],
          foto: "/assets/usuarios/lucas.jpg"
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
      senhaHash: H['ana.mendes'],
      tipo: TipoUsuario.Atleta,
      cidade: "Vila Velha",
      estado: "ES",
      pais: "Brasil",
      foto: "/assets/usuarios/ana.webp",
      atleta: {
        create: {
          nome: "Ana Beatriz",
          sobrenome: "Mendes",
          email: "ana.mendes@example.com",
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
          categoria: [Categoria.Sub15],
          foto: "/assets/usuarios/ana.webp"
        }
      }
    }
  });

  const exercicios = [
    {
      codigo: 'EX001',
      nome: 'Condução Simples (Parte Externa do Pé)',
      descricao: 'Exercício de condução simples utilizando a parte externa do pé. Trabalha o controle de bola em movimento e a coordenação motora.',
      nivel: Nivel.Base,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/conducao-externa.mp4'
    },
    {
      codigo: 'EX002',
      nome: 'Condução Zig-Zag (Parte Externa do Pé)',
      descricao: 'Exercício de condução em zig-zag utilizando a parte externa do pé. Desenvolve agilidade, domínio de bola e coordenação em mudanças de direção.',
      nivel: Nivel.Base,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/conducao-zigzag-externa.mp4'
    },
    {
      codigo: 'EX003',
      nome: 'Condução Zig-Zag (Perna Alternada - Avançado)',
      descricao: 'Condução em zig-zag alternando pernas com foco no controle da bola. Desenvolve técnica, coordenação e domínio em ritmo acelerado.',
      nivel: Nivel.Avancado,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/conducao-zigzag-perna-alternada.mp4'
    },
    {
      codigo: 'EX004',
      nome: 'Condução Zig-Zag Alternado (Performance)',
      descricao: 'Condução em zig-zag alternando os pés em alta intensidade. Trabalha coordenação, velocidade e domínio avançado da bola.',
      nivel: Nivel.Performance,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/conducao-zigzag-alternado.mp4'
    },
    {
      codigo: 'EX005',
      nome: 'Drible - Pedalada (Base)',
      descricao: 'Drible de pedalada focado em enganar o marcador. Exercício de base para desenvolver coordenação e criatividade no ataque.',
      nivel: Nivel.Base,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/drible-pedalar-base.mp4'
    },
    {
      codigo: 'EX006',
      nome: 'Drible - Pedalada (Avançado)',
      descricao: 'Drible de pedalada em ritmo acelerado para superar adversários. Exercício avançado que melhora coordenação, velocidade e improviso ofensivo.',
      nivel: Nivel.Avancado,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/drible-pedalar-avancado.mp4'
    },
    {
      codigo: 'EX007',
      nome: 'Drible - Pedalada (Performance)',
      descricao: 'Drible de pedalada em alta intensidade para situações de jogo real. Exercício de performance que aprimora velocidade, improviso e explosão ofensiva.',
      nivel: Nivel.Performance,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/drible-pedalar-performance.mp4'
    },
    {
      codigo: 'EX008',
      nome: 'Passe Simples (Avançado)',
      descricao: 'Passe simples em alta precisão e velocidade. Exercício avançado que desenvolve tomada de decisão rápida e controle de bola sob pressão.',
      nivel: Nivel.Avancado,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/passe-simples-avancado.mp4'
    },
    {
      codigo: 'EX009',
      nome: 'Passe Parte Interna (Base)',
      descricao: 'Passe utilizando a parte interna do pé em curta distância. Exercício de base que aprimora fundamentos de precisão e controle de bola.',
      nivel: Nivel.Base,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/passe-parte-interna.mp4'
    },
    {
      codigo: 'EX010',
      nome: 'Passe no Alto (Base)',
      descricao: 'Passe no alto utilizando precisão em curta e média distância. Exercício de base que desenvolve controle de força e domínio do passe aéreo.',
      nivel: Nivel.Base,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/passe-no-alto.mp4'
    },
    {
      codigo: 'EX011',
      nome: 'Passe com Deslocamento - Parte Interna (Avançado)',
      descricao: 'Passe com deslocamento utilizando a parte interna do pé. Exercício avançado que aprimora movimentação, precisão e tomada de decisão em ritmo de jogo.',
      nivel: Nivel.Avancado,
      categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
      videoDemonstrativoUrl: '/assets/videos/exercicios/passe-deslocamento-interna-avancado.mp4'
    },
    {
    codigo: 'EX012',
    nome: 'Passe no Alto - Peito do Pé (Base)',
    descricao: 'Passe no alto utilizando o peito do pé para alcançar maior precisão e força. Exercício de base que desenvolve técnica e controle do passe aéreo.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/passe-no-alto-peito.mp4'
  },
  {
    codigo: 'EX013',
    nome: 'Passe Alto - Peito do Pé com Movimentação (Avançado)',
    descricao: 'Passe alto com o peito do pé associado à movimentação. Exercício avançado que aprimora força, precisão e dinâmica em situações reais de jogo.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/passe-alto-peito-mov.mp4'
  },
  {
    codigo: 'EX014',
    nome: 'Domínio de Coxa (Base)',
    descricao: 'Domínio de bola com a coxa para controlar passes aéreos. Exercício de base que desenvolve coordenação e fundamentos de recepção.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/dominio-coxa-base.mp4'
  },
  {
    codigo: 'EX015',
    nome: 'Domínio de Coxa (Avançado)',
    descricao: 'Domínio de bola com a coxa em intensidade avançada. Exercício que aprimora tempo de bola, coordenação e controle em situações dinâmicas.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/dominio-coxa-avancado.mp4'
  },
  {
    codigo: 'EX016',
    nome: 'Domínio de Coxa e Devolução (Performance)',
    descricao: 'Domínio de bola com a coxa seguido de devolução rápida. Exercício de performance que treina controle, reação e dinâmica em ritmo de jogo.',
    nivel: Nivel.Performance,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/dominio-coxa-devolucao.mp4'
  },
  {
    codigo: 'EX017',
    nome: 'Domínio de Peito (Base)',
    descricao: 'Domínio de bola com o peito para amortecer passes aéreos. Exercício de base que fortalece fundamentos de recepção e controle.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/dominio-peito-base.mp4'
  },
  {
    codigo: 'EX018',
    nome: 'Domínio de Peito (Avançado)',
    descricao: 'Domínio de bola com o peito em ritmo avançado. Exercício que melhora controle aéreo, coordenação e preparo para finalização ou passe rápido.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/dominio-peito-avancado.mp4'
  },
  {
    codigo: 'EX019',
    nome: 'Domínio de Peito (Performance)',
    descricao: 'Domínio de bola com o peito em situações de alta intensidade. Exercício de performance que desenvolve força, tempo de bola e reação rápida para sequência de jogadas.',
    nivel: Nivel.Performance,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/dominio-peito-performance.mp4'
  },
  {
    codigo: 'EX020',
    nome: 'Cabeceio (Base)',
    descricao: 'Exercício de cabeceio básico para treinar tempo de bola e direção. Trabalha fundamentos iniciais de jogo aéreo e coordenação.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/cabeceio-base.mp4'
  },
  {
    codigo: 'EX021',
    nome: 'Cabeceio (Avançado)',
    descricao: 'Exercício de cabeceio avançado com maior intensidade e precisão. Trabalha tempo de impulsão, coordenação e direcionamento ofensivo ou defensivo.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/cabeceio-avancado.mp4'
  },
  {
    codigo: 'EX022',
    nome: 'Cabeceio Alto (Performance)',
    descricao: 'Exercício de cabeceio alto em situações de jogo real. Trabalha impulsão, força e precisão no domínio do jogo aéreo em alta intensidade.',
    nivel: Nivel.Performance,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/cabeceio-alto.mp4'
  },
  {
    codigo: 'EX023',
    nome: 'Coordenação Motora (Base)',
    descricao: 'Exercício de coordenação motora básica para aprimorar agilidade e controle corporal. Indicado para iniciação esportiva e desenvolvimento dos fundamentos.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-motora-base.mp4'
  },
  {
    codigo: 'EX024',
    nome: 'Coordenação Motora (Avançado)',
    descricao: 'Exercício de coordenação motora avançada com maior complexidade de movimentos. Desenvolve agilidade, controle corporal e rapidez de reação.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-motora-avancado.mp4'
  },
   {
    codigo: 'EX025',
    nome: 'Coordenação Motora Estática (Performance)',
    descricao: 'Exercício de coordenação motora estática em alta intensidade. Trabalha equilíbrio, concentração e controle corporal em nível de performance.',
    nivel: Nivel.Performance,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-motora-estatica.mp4'
  },
  {
    codigo: 'EX026',
    nome: 'Coordenação em Movimento (Base)',
    descricao: 'Exercício de coordenação motora em movimento, focado em agilidade e ritmo. Indicado para a base, melhora controle corporal e fundamentos iniciais.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-movimento-base.mp4'
  },
  {
    codigo: 'EX027',
    nome: 'Coordenação em Movimento (Avançado)',
    descricao: 'Exercício de coordenação motora em movimento avançado. Trabalha velocidade, agilidade e controle corporal em situações mais complexas.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-movimento-avancado.mp4'
  },
  {
    codigo: 'EX028',
    nome: 'Coordenação em Movimento (Performance)',
    descricao: 'Exercício de coordenação motora em movimento de alta intensidade. Desenvolve velocidade, resistência e precisão em situações de jogo real.',
    nivel: Nivel.Performance,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-movimento-performance.mp4'
  },
  {
    codigo: 'EX029',
    nome: 'Coordenação Lateral (Base)',
    descricao: 'Exercício de coordenação lateral básica para desenvolver agilidade e equilíbrio. Indicado para iniciação esportiva e fundamentos de movimento.',
    nivel: Nivel.Base,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-lateral.mp4'
  },
  {
    codigo: 'EX030',
    nome: 'Coordenação Lateral com Bola (Avançado)',
    descricao: 'Exercício de coordenação lateral avançada com bola. Desenvolve agilidade, controle corporal e domínio técnico em movimentos rápidos.',
    nivel: Nivel.Avancado,
    categorias: [Categoria.Sub9, Categoria.Sub11, Categoria.Sub13, Categoria.Sub15, Categoria.Sub17, Categoria.Sub20, Categoria.Livre],
    videoDemonstrativoUrl: '/assets/videos/exercicios/coordenacao-lateral-bola.mp4'
  }
  ];
  for (const ex of exercicios) {
    await prisma.exercicio.upsert({
      where: { codigo: ex.codigo },
      update: {},
      create: ex
    });
  }

  
const professorMateus = await prisma.professor.findFirst({
  where: { usuario: { nomeDeUsuario: 'mateus.furieri' } }
});

const prazo25Out = new Date(new Date().getFullYear(), 9, 25, 23, 59, 0);

const ex1 = await prisma.exercicio.findUnique({ where: { codigo: 'EX005' } });
const ex2 = await prisma.exercicio.findUnique({ where: { codigo: 'EX009' } }); 
const ex3 = await prisma.exercicio.findUnique({ where: { codigo: 'EX010' } }); 
const ex4 = await prisma.exercicio.findUnique({ where: { codigo: 'EX020' } });
const ex5 = await prisma.exercicio.findUnique({ where: { codigo: 'EX001' } });

if (professorMateus && ex1 && ex2 && ex3 && ex4 && ex5) {
  await prisma.treinoProgramado.upsert({
    where: { codigo: 'TR002' },
    update: {},
    create: {
      codigo: 'TR002',
      nome: 'Treino Técnico Agilidade',
      descricao: 'Sequência integrada de fundamentos: drible, passes no chão e no alto, e cabeceio.',
      nivel: Nivel.Base,
      categoria: [Categoria.Livre],
      duracao: 60,
      tipoTreino: TipoTreino.Tecnico,
      professorId: professorMateus.id,
      dataAgendada: prazo25Out,
      imagemUrl: '/assets/treinos/agilidade.jpg',
      pontuacao: 12,
      exercicios: {
        create: [
          { exercicioId: ex1.id, ordem: 1, repeticoes: '3x 40s + 20s descanso' },
          { exercicioId: ex2.id, ordem: 2, repeticoes: '4x 12 passes cada' },
          { exercicioId: ex3.id, ordem: 3, repeticoes: '3x 10 lançamentos' },
          { exercicioId: ex4.id, ordem: 4, repeticoes: '3x 12 cabeceios' },
          { exercicioId: ex5.id, ordem: 5, repeticoes: '5 voltas' },
        ]
      }
    }
  });
}

  const desafios = [
    {
      titulo: 'Desafio Controle Aéreo',
      descricao: 'Mantenha a bola no ar pelo maior tempo possível usando diferentes partes do corpo.',
      imagemUrl: '/assets/controle-aereo.jpg',
      nivel: Nivel.Avancado,
      pontuacao: 10,
      categoria: [Categoria.Sub15]
    },
    {
      titulo: 'Desafio Equilíbrio e Agilidade',
      descricao: 'Supere um percurso de obstáculos mantendo o controle da bola.',
      imagemUrl: '/assets/treino-agilidade.webp',
      nivel: Nivel.Avancado,
      pontuacao: 8,
      categoria: [Categoria.Sub13]
    }
  ];
  for (const desafio of desafios) {
    const exists = await prisma.desafioOficial.findFirst({ where: { titulo: desafio.titulo } });
    if (!exists) {
      await prisma.desafioOficial.create({ data: desafio });
    }
  }

  const professorArthur = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: 'arthur.persio' } }
  });

  const usuarioLucas = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'lucas.ferreira' }
  });

  const usuarioAna = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'ana.mendes' }
  });

  if (usuarioLucas) {
    const exists = await prisma.postagem.findFirst({
      where: {
        conteudo: "Finalizei meu treino com explosões hoje! 💨",
        usuarioId: usuarioLucas.id
      }
    });

    if (!exists) {
      await prisma.postagem.create({
        data: {
          conteudo: "Finalizei meu treino com explosões hoje! 💨",
          imagemUrl: "https://images.unsplash.com/photo-1605296867304-46d5465a13f1",
          usuarioId: usuarioLucas.id
        }
      });
    }
  }

  if (usuarioAna) {
    const exists = await prisma.postagem.findFirst({
      where: {
        conteudo: "Muito aprendizado no treino técnico de hoje. Vamos pra cima! ⚽🔥",
        usuarioId: usuarioAna.id
      }
    });

    if (!exists) {
      await prisma.postagem.create({
        data: {
          conteudo: "Muito aprendizado no treino técnico de hoje. Vamos pra cima! ⚽🔥",
          usuarioId: usuarioAna.id
        }
      });
    }
  }

  const usuarioTeste = await prisma.usuario.upsert({
    where: { nomeDeUsuario: "teste" },
    update: {},
    create: {
      nome: "teste",
      nomeDeUsuario: "teste",
      email: "teste@example.com",
      senhaHash: H['teste'],
      foto: "/assets/usuarios/teste.jpg",
      tipo: TipoUsuario.Atleta,
      cidade: "Curitiba",
      estado: "PR",
      pais: "Brasil",
      atleta: {
        create: {
          nome: "teste",
          sobrenome: "",
          idade: 16,
          posicao: "Zagueiro",
          altura: 1.8,
          peso: 72,
          nacionalidade: "Brasileira",
          naturalidade: "Curitiba - PR",
          telefone1: "11999999999",
          seloQualidade: "Bronze",
          categoria: [Categoria.Sub17],
          foto: "/assets/usuarios/teste.jpg"
        }
      }
    }
  });

  const atletaTeste = await prisma.atleta.upsert({
    where: { usuarioId: usuarioTeste.id },
    update: {},
    create: {
      usuarioId: usuarioTeste.id,
      nome: "teste",
      sobrenome: "",
      idade: 16,
      posicao: "Zagueiro",
      altura: 1.8,
      peso: 72,
      nacionalidade: "Brasileira",
      naturalidade: "Curitiba - PR",
      telefone1: "11999999999",
      seloQualidade: "Bronze",
      categoria: [Categoria.Sub17],
      foto: "/assets/usuarios/teste.jpg"
    }
  });

  await prisma.atividadeRecente.createMany({
    data: [
      {
        usuarioId: usuarioTeste.id,
        tipo: "Desafio",
        imagemUrl: "/assets/desafios/velocidade.jpg",
      },
      {
        usuarioId: usuarioTeste.id,
        tipo: "Treino",
        imagemUrl: "/assets/treinos/resistencia.jpg",
      },
      {
        usuarioId: usuarioTeste.id,
        tipo: "Video",
        imagemUrl: "https://img.youtube.com/vi/GVjM0KepIDI/hqdefault.jpg",
      },
    ],
    skipDuplicates: true,
  });

  const desafioExtra = await prisma.desafioOficial.upsert({
    where: { titulo: "Desafio de Velocidade" },
    update: {},
    create: {
      titulo: "Desafio de Velocidade",
      descricao: "Complete um circuito em tempo recorde.",
      nivel: Nivel.Performance,
      pontuacao: 15,
      categoria: [Categoria.Sub17],
      imagemUrl: "/assets/desafios/velocidade.jpg"
    }
  });

  await prisma.submissaoDesafio.create({
    data: {
      atletaId: atletaTeste.id,
      desafioId: desafioExtra.id,
      videoUrl: "https://www.google.com/imgres?q=desafio%20velocidade%20futebol&imgurl=https%3A%2F%2Fwww.tiktok.com%2Fapi%2Fimg%2F%3FitemId%3D7358856354527857926%26location%3D0%26aid%3D1988&imgrefurl=https%3A%2F%2Fwww.tiktok.com%2F%40adonias%2Fvideo%2F7358856354527857926&docid=Q3i_9CrrR3OQFM&tbnid=3SL_XXb6IEl1zM&vet=12ahUKEwjx6-2iseWOAxWYiJUCHYlxORkQM3oECBkQAA..i&w=1080&h=1920&hcb=2&ved=2ahUKEwjx6-2iseWOAxWYiJUCHYlxORkQM3oECBkQAA",
      aprovado: true,
    }
  });

const desafioTeste2 = await prisma.desafioOficial.upsert({
  where: { titulo: "Desafio de Controle Avançado" },
  update: {},
  create: {
    titulo: "Desafio de Controle Avançado",
    descricao: "Mantenha a posse da bola com domínio total durante 60 segundos.",
    nivel: Nivel.Performance,
    pontuacao: 20,
    categoria: [Categoria.Sub15],
    imagemUrl: "/assets/desafios/controle-avancado.jpg",
  },
});

await prisma.submissaoDesafio.create({
  data: {
    atletaId: atletaTeste!.id,
    desafioId: desafioTeste2.id,
    videoUrl: "https://www.youtube.com/watch?v=controle_avancado",
    aprovado: true,
  },
});

await prisma.atividadeRecente.createMany({
  data: [
    {
      usuarioId: atletaTeste!.usuarioId,
      tipo: "Treino",
      imagemUrl: "/assets/treinos/controle.jpg",
    },
    {
      usuarioId: atletaTeste!.usuarioId,
      tipo: "Desafio",
      imagemUrl: "/assets/desafios/controle-avancado.jpg",
    },
  ],
  skipDuplicates: true,
});

const usuarioAaaaa = await prisma.usuario.upsert({
  where: { nomeDeUsuario: "aaaaa" },
  update: {},
  create: {
    nome: "aaaaa",
    nomeDeUsuario: "aaaaa",
    email: "aaaaa@example.com",
    senhaHash: H['aaaaa'],
    tipo: TipoUsuario.Atleta,
    cidade: "Vitória",
    estado: "ES",
    foto: "/assets/usuarios/isadora.jpg",
    pais: "Brasil",
    atleta: {
      create: {
        nome: "aaaaa",
        sobrenome: "",
        idade: 16,
        posicao: "Zagueiro",
        altura: 1.8,
        peso: 72,
        nacionalidade: "Brasileira",
        naturalidade: "Vitória - ES",
        telefone1: "11999999999",
        seloQualidade: "Bronze",
        categoria: [Categoria.Sub17],
        foto: "/assets/usuarios/isadora.jpg"
      }
    }
  }
});

const atletaAaaaa = await prisma.atleta.findUnique({
  where: { usuarioId: usuarioAaaaa.id }
});

const exA = await prisma.exercicio.findUnique({ where: { codigo: 'EX006' } });
const exB = await prisma.exercicio.findUnique({ where: { codigo: 'EX011' } });
const exC = await prisma.exercicio.findUnique({ where: { codigo: 'EX012' } });
const exD = await prisma.exercicio.findUnique({ where: { codigo: 'EX021' } });
const exE = await prisma.exercicio.findUnique({ where: { codigo: 'EX024' } });

if (atletaAaaaa && professorArthur) {
  if (!(exA && exB && exC && exD && exE)) {
    throw new Error('Exercícios do TR001 não encontrados no seed');
  }

  const treino = await prisma.treinoProgramado.upsert({
    where: { codigo: "TR001" },
    update: {
      tipoTreino: TipoTreino.Fisico,
      dataAgendada: prazo25Out,
      exercicios: {
        deleteMany: {},
        create: [
          { exercicioId: exA.id, ordem: 1, repeticoes: '4x 45s + 15s descanso' },
          { exercicioId: exB.id, ordem: 2, repeticoes: '3x 12 reps' },
          { exercicioId: exC.id, ordem: 3, repeticoes: '3x 10 lançamentos' },
          { exercicioId: exD.id, ordem: 4, repeticoes: '4x 8 cabeceios' },
          { exercicioId: exE.id, ordem: 5, repeticoes: '4x 60s' },
        ],
      },
    },
    create: {
      nome: "Treino Resistencia Física",
      codigo: "TR001",
      descricao: "Treino voltado para resistência",
      nivel: Nivel.Avancado,
      pontuacao: 10,
      duracao: 45,
      categoria: [Categoria.Livre],
      imagemUrl: "/assets/treinos/resistencia.jpg",
      professor: { connect: { id: professorArthur.id } },
      tipoTreino: TipoTreino.Fisico,
      dataAgendada: prazo25Out,
      exercicios: {
        create: [
          { exercicioId: exA.id, ordem: 1, repeticoes: '4x 45s + 15s descanso' },
          { exercicioId: exB.id, ordem: 2, repeticoes: '3x 12 reps' },
          { exercicioId: exC.id, ordem: 3, repeticoes: '3x 10 lançamentos' },
          { exercicioId: exD.id, ordem: 4, repeticoes: '4x 8 cabeceios' },
          { exercicioId: exE.id, ordem: 5, repeticoes: '4x 60s' },
        ],
      },
    },
  });

  const treinoAgendado = await prisma.treinoAgendado.upsert({
    where: { titulo: treino.nome },
    update: {},
    create: {
      titulo: treino.nome,
      dataExpiracao: new Date(),
      dataTreino: new Date(),
      local: "Quadra A",
      atleta: { connect: { id: atletaAaaaa.id } },
      treinoProgramado: { connect: { id: treino.id } },
    },
  });

  await prisma.submissaoTreino.upsert({
    where: { observacao: "Concluído com sucesso" },
    update: {},
    create: {
      atleta: { connect: { id: atletaAaaaa.id } },
      treinoAgendado: { connect: { id: treinoAgendado.id } },
      observacao: "Concluído com sucesso",
      aprovado: true,
    },
  });

  const desafio = await prisma.desafioOficial.upsert({
    where: { titulo: "Desafio Técnica com Bola" },
    update: {},
    create: {
      titulo: "Desafio Técnica com Bola",
      descricao: "Controle e passes curtos",
      nivel: Nivel.Base,
      categoria: [Categoria.Sub9],
      pontuacao: 15,
      imagemUrl: "/assets/desafios/tecnico-bola.jpg"
    },
  });

  await prisma.submissaoDesafio.upsert({
    where: { videoUrl: "https://video.url/desafio.mp4" },
    update: {},
    create: {
      atleta: { connect: { id: atletaAaaaa.id } },
      desafio: { connect: { id: desafio.id } },
      videoUrl: "https://video.url/desafio.mp4",
      aprovado: true,
    },
  });

  await prisma.atividadeRecente.createMany({
    data: [
      {
        usuarioId: atletaAaaaa.usuarioId,
        tipo: "Treino",
        imagemUrl: "/assets/treinos/resistencia.jpg",
      },
      {
        usuarioId: atletaAaaaa.usuarioId,
        tipo: "Desafio",
        imagemUrl: "/assets/desafios/tecnico-bola.jpg",
      },
    ],
    skipDuplicates: true,
  });
}

  console.log("✅ Seed completo executado com sucesso!");
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });