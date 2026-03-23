import {
  PrismaClient,
  TipoUsuario,
  TipoTreino,
  Nivel,
  Categoria,
  OrigemFormador,
  MetodoPagamento,
  Periodicidade,
  TipoMensagem,
  PagamentoStatus,
  PosicaoCampo,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sanitizeMediaPath } from '../../utils/mediaSanitizer.js';

const prisma = new PrismaClient();
const m = (p?: string | null) => sanitizeMediaPath(p);

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function upsertTreinoPorCodigoSemUnique(payload: {
  codigo: string;
  createData: any;
  updateData: any;
}) {
  const found = await prisma.treinoProgramado.findFirst({
    where: { codigo: payload.codigo },
    select: { id: true },
  });

  if (found?.id) {
    return prisma.treinoProgramado.update({
      where: { id: found.id },
      data: payload.updateData,
    });
  }

  return prisma.treinoProgramado.create({
    data: payload.createData,
  });
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

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

  'atleta_free': 'senha123',
  'atleta_pro': 'senha123',
  'prof_free': 'senha123',
  'prof_pro': 'senha123',
  'scout_free': 'senha123',
  'scout_pro': 'senha123',
  'escolinha_01': 'senha123',
  'prof_clube_footera': 'senha123',
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
      foto: m('/assets/usuarios/clube-footera.png'),
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
    where: { nomeDeUsuario: 'admin' },
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
        },
      },
    },
    update: {
      tipo: TipoUsuario.Admin,
      verified: true,
      administrador: {
        upsert: {
          create: {
            cargo: 'Super Admin',
            nivel: Nivel.Performance,
            fotoUrl: '/assets/usuarios/profa-teste.png',
          },
          update: {
            cargo: 'Super Admin',
            nivel: Nivel.Performance,
            fotoUrl: '/assets/usuarios/profa-teste.png',
          },
        },
      },
    },
  });

  const clube1Db = await prisma.clube.findFirst({
    where: { usuario: { nomeDeUsuario: "clube_footera" } }
  });

  const clube2Db = await prisma.clube.findFirst({
    where: { usuario: { nomeDeUsuario: "clube_teste" } }
  });

  const escolinhaEstrelasDb = await prisma.escolinha.findFirst({
    where: { usuario: { nomeDeUsuario: "escola_estrelas" } },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'prof_clube_footera' },
    update: {
      tipo: TipoUsuario.Professor,
      senhaHash: H['prof_clube_footera'],
    },
    create: {
      nome: 'Professor Clube FootEra',
      nomeDeUsuario: 'prof_clube_footera',
      email: 'prof.clube_footera@example.com',
      senhaHash: H['prof_clube_footera'],
      tipo: TipoUsuario.Professor,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/prof-clube-footera.png',
      professor: {
        create: {
          codigo: 'PROF_FOOTERA',
          cref: 'SP000001',
          areaFormacao: 'Educação Física',
          escola: 'Clube FootEra FC',
          qualificacoes: ['Professor vinculado ao Clube FootEra para testes'],
          certificacoes: ['Licença C'],
          fotoUrl: '/assets/usuarios/prof-clube-footera.png',
          nome: 'Professor Clube FootEra',
          clubeId: clube1Db ? clube1Db.id : null,
        },
      },
    },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'arthur.persio' },
    update: {
      tipo: TipoUsuario.Professor,
    },
    create: {
      nome: 'Arthur Persio de Azevedo',
      nomeDeUsuario: 'arthur.persio',
      email: 'arthur.persio@example.com',
      senhaHash: H['arthur.persio'],
      tipo: TipoUsuario.Professor,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
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
          nome: 'Arthur Persio de Azevedo',
          escolinhaId: escolinhaEstrelasDb ? escolinhaEstrelasDb.id : null,
        },
      },
    },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'prof_free' },
    update: {
      senhaHash: H['prof_free'],
      tipo: TipoUsuario.Professor,
      verified: true,
    },
    create: {
      nome: 'Professor Free',
      nomeDeUsuario: 'prof_free',
      email: 'prof_free@example.com',
      senhaHash: H['prof_free'],
      tipo: TipoUsuario.Professor,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-prof-free.png',
      professor: {
        create: {
          codigo: 'PROF_FREE',
          cref: 'ES000001',
          areaFormacao: 'Educação Física',
          escola: 'Escola Estrelas',
          qualificacoes: ['Professor de teste (FREE)'],
          certificacoes: ['Licença C'],
          fotoUrl: '/assets/usuarios/teste-prof-free.png',
          nome: 'Professor Free',
          escolinhaId: escolinhaEstrelasDb ? escolinhaEstrelasDb.id : null,
        },
      },
    },
  });

  const olheiroJoao = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'olheiro_joao' },
    update: {},
    create: {
      nome: 'João Nogueira',
      nomeDeUsuario: 'olheiro_joao',
      email: 'olheiro.joao@example.com',
      senhaHash: H['olheiro_joao'],
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
          colaboracaoClubeId: clube1Db ? clube1Db.id : null,
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
          posicao: PosicaoCampo.MEI,
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
          posicao: PosicaoCampo.CA,
          altura: 1.65,
          peso: 58.0,
          seloQualidade: "Ouro",
          categoria: [Categoria.Sub15],
          foto: "/assets/usuarios/ana.webp"
        }
      }
    }
  });

  const professorMateus = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: 'mateus.furieri' } }
  });

  const prazo25Out = new Date(new Date().getFullYear(), 9, 25, 23, 59, 0);

  const ex1 = await prisma.exercicio.findUnique({ where: { codigo: 'EX005' } });
  const ex2 = await prisma.exercicio.findUnique({ where: { codigo: 'EX009' } });
  const ex3 = await prisma.exercicio.findUnique({ where: { codigo: 'EX010' } });
  const ex4 = await prisma.exercicio.findUnique({ where: { codigo: 'EX020' } });
  const ex5 = await prisma.exercicio.findUnique({ where: { codigo: 'EX001' } });

  const clubeFooteraDb = await prisma.clube.findFirst({
    where: { usuario: { nomeDeUsuario: "clube_footera" } },
    select: { id: true },
  });

  const escolinhaEstrelasDb2 = await prisma.escolinha.findFirst({
    where: { usuario: { nomeDeUsuario: "escola_estrelas" } },
    select: { id: true },
  });

  const profArthurDb = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: "arthur.persio" } },
    select: { id: true },
  });

  const profFreeDb2 = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: "prof_free" } },
    select: { id: true },
  });

  const profProDb2 = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: "prof_pro" } },
    select: { id: true },
  });

  const profClubeFooteraDb2 = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: "prof_clube_footera" } },
    select: { id: true },
  });

  async function getExByCodes(codes: string[], min = 3) {
    const found = await prisma.exercicio.findMany({
      where: { codigo: { in: codes } },
      select: { id: true, codigo: true },
    });

    const ordered = codes
      .map((c) => found.find((x) => x.codigo === c))
      .filter(Boolean) as { id: string; codigo: string }[];

    if (ordered.length >= min) return ordered;

    const fallback = await prisma.exercicio.findMany({
      take: min,
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true },
    });

    return fallback;
  }

  type Dono =
    | { kind: "PROF"; professorId: string }
    | { kind: "CLUBE"; clubeId: string }
    | { kind: "ESCOLA"; escolinhaId: string };

  function donoData(d: Dono) {
    if (d.kind === "PROF") return { professorId: d.professorId, clubeId: null, escolinhaId: null };
    if (d.kind === "CLUBE") return { clubeId: d.clubeId, professorId: null, escolinhaId: null };
    return { escolinhaId: d.escolinhaId, professorId: null, clubeId: null };
  }

  async function criarTreinoDoDono(args: {
    dono: Dono;
    codigo: string;
    nome: string;
    descricao: string;
    tipoTreino: TipoTreino;
    nivel: Nivel;
    categoria: Categoria[];
    duracao: number;
    pontuacao: number;
    imagemUrl: string;
    exercicioCodes: string[];
  }) {
    const exs = await getExByCodes(args.exercicioCodes, 3);
    if (exs.length < 3) {
      console.warn(`⚠️ Sem exercícios suficientes para ${args.codigo}. Pulando.`);
      return;
    }

    if (professorMateus) {
    await criarTreinoDoDono({
      dono: { kind: "PROF", professorId: professorMateus.id },
      codigo: "TP_MATEUS_01",
      nome: "Treino do Prof Mateus (Performance)",
      descricao: "Seed: treino do Mateus para testes de listagem por professor.",
      tipoTreino: TipoTreino.Fisico,
      nivel: Nivel.Avancado,
      categoria: [Categoria.Livre],
      duracao: 55,
      pontuacao: 14,
      imagemUrl: "/assets/treinos/explosao.jpg",
      exercicioCodes: ["EX031", "EX032", "EX035", "EX041", "EX042", "EX057", "EX061", "EX068"],
    });
  }

  }

  if (clubeFooteraDb?.id) {
    await criarTreinoDoDono({
      dono: { kind: "CLUBE", clubeId: clubeFooteraDb.id },
      codigo: "TC_FOOTERA_01",
      nome: "Treino do Clube FootEra (Coletivo)",
      descricao: "Seed: treino do clube (organização) para testes de listagem por dono.",
      tipoTreino: TipoTreino.Tecnico,
      nivel: Nivel.Base,
      categoria: [Categoria.Livre],
      duracao: 60,
      pontuacao: 12,
      imagemUrl: "/assets/treinos/agilidade.jpg",
      exercicioCodes: ["EX009", "EX010", "EX020", "EX005", "EX001"],
    });
  }

  if (escolinhaEstrelasDb2?.id) {
    await criarTreinoDoDono({
      dono: { kind: "ESCOLA", escolinhaId: escolinhaEstrelasDb2.id },
      codigo: "TE_ESTRELAS_01",
      nome: "Treino da Escola Estrelas (Fundamentos)",
      descricao: "Seed: treino da escolinha para testes de vínculo/treinos disponíveis.",
      tipoTreino: TipoTreino.Tecnico,
      nivel: Nivel.Base,
      categoria: [Categoria.Sub15, Categoria.Sub17].filter(Boolean) as Categoria[],
      duracao: 50,
      pontuacao: 10,
      imagemUrl: "/assets/treinos/controle.jpg",
      exercicioCodes: ["EX005", "EX001", "EX020", "EX031", "EX032"],
    });
  }

  if (profFreeDb2?.id) {
    await criarTreinoDoDono({
      dono: { kind: "PROF", professorId: profFreeDb2.id },
      codigo: "TP_PROF_FREE_01",
      nome: "Treino do Prof Free (Resistência)",
      descricao: "Seed: treino do professor FREE para testar painel e filtros.",
      tipoTreino: TipoTreino.Fisico,
      nivel: Nivel.Base,
      categoria: [Categoria.Livre],
      duracao: 45,
      pontuacao: 9,
      imagemUrl: "/assets/treinos/resistencia.jpg",
      exercicioCodes: ["EX031", "EX041", "EX042", "EX061", "EX068"],
    });
  }

  if (profProDb2?.id) {
    await criarTreinoDoDono({
      dono: { kind: "PROF", professorId: profProDb2.id },
      codigo: "TP_PROF_PRO_01",
      nome: "Treino do Prof Pro (Performance)",
      descricao: "Seed: treino do professor PRO para testes do dashboard.",
      tipoTreino: TipoTreino.Fisico,
      nivel: Nivel.Avancado,
      categoria: [Categoria.Livre],
      duracao: 55,
      pontuacao: 14,
      imagemUrl: "/assets/treinos/explosao.jpg",
      exercicioCodes: ["EX057", "EX042", "EX061", "EX031", "EX035"],
    });
  }

  if (profClubeFooteraDb2?.id) {
    await criarTreinoDoDono({
      dono: { kind: "PROF", professorId: profClubeFooteraDb2.id },
      codigo: "TP_PROF_CLUBE_FOOTERA_01",
      nome: "Treino do Prof do Clube FootEra (Tático)",
      descricao: "Seed: treino do professor vinculado ao clube.",
      tipoTreino: TipoTreino.Tatico,
      nivel: Nivel.Base,
      categoria: [Categoria.Livre],
      duracao: 60,
      pontuacao: 11,
      imagemUrl: "/assets/treinos/tatico.jpg",
      exercicioCodes: ["EX020", "EX009", "EX010", "EX005", "EX001"],
    });
  }

  if (profArthurDb?.id) {
    await criarTreinoDoDono({
      dono: { kind: "PROF", professorId: profArthurDb.id },
      codigo: "TP_ARTHUR_01",
      nome: "Treino do Prof Arthur (Resistência + Técnica)",
      descricao: "Seed: treino do Arthur para testes de rotas e cards.",
      tipoTreino: TipoTreino.Fisico,
      nivel: Nivel.Avancado,
      categoria: [Categoria.Livre],
      duracao: 50,
      pontuacao: 13,
      imagemUrl: "/assets/treinos/resistencia.jpg",
      exercicioCodes: ["EX006", "EX011", "EX012", "EX021", "EX024"],
    });
  }

  if (professorMateus && ex1 && ex2 && ex3 && ex4 && ex5) {
    await upsertTreinoPorCodigoSemUnique({
  codigo: "TR002",
  updateData: {
    nome: "Treino Técnico Agilidade",
    descricao: "Sequência integrada de fundamentos: drible, passes no chão e no alto, e cabeceio.",
    nivel: Nivel.Base,
    categoria: [Categoria.Livre],
    duracao: 60,
    tipoTreino: TipoTreino.Tecnico,
    professorId: professorMateus.id,
    dataAgendada: prazo25Out,
    imagemUrl: "/assets/treinos/agilidade.jpg",
    pontuacao: 12,
    exercicios: {
      deleteMany: {},
      create: [
        { exercicioId: ex1.id, ordem: 1, repeticoes: "3x 40s + 20s descanso" },
        { exercicioId: ex2.id, ordem: 2, repeticoes: "4x 12 passes cada" },
        { exercicioId: ex3.id, ordem: 3, repeticoes: "3x 10 lançamentos" },
        { exercicioId: ex4.id, ordem: 4, repeticoes: "3x 12 cabeceios" },
        { exercicioId: ex5.id, ordem: 5, repeticoes: "5 voltas" },
      ],
    },
  },
  createData: {
    codigo: "TR002",
    nome: "Treino Técnico Agilidade",
    descricao: "Sequência integrada de fundamentos: drible, passes no chão e no alto, e cabeceio.",
    nivel: Nivel.Base,
    categoria: [Categoria.Livre],
    duracao: 60,
    tipoTreino: TipoTreino.Tecnico,
    professorId: professorMateus.id,
    dataAgendada: prazo25Out,
    imagemUrl: "/assets/treinos/agilidade.jpg",
    pontuacao: 12,
    exercicios: {
      create: [
        { exercicioId: ex1.id, ordem: 1, repeticoes: "3x 40s + 20s descanso" },
        { exercicioId: ex2.id, ordem: 2, repeticoes: "4x 12 passes cada" },
        { exercicioId: ex3.id, ordem: 3, repeticoes: "3x 10 lançamentos" },
        { exercicioId: ex4.id, ordem: 4, repeticoes: "3x 12 cabeceios" },
        { exercicioId: ex5.id, ordem: 5, repeticoes: "5 voltas" },
      ],
    },
  },
});

  }

  const ex031 = await prisma.exercicio.findUnique({ where: { codigo: 'EX031' } });
  const ex032 = await prisma.exercicio.findUnique({ where: { codigo: 'EX032' } });
  const ex035 = await prisma.exercicio.findUnique({ where: { codigo: 'EX035' } });
  const ex041 = await prisma.exercicio.findUnique({ where: { codigo: 'EX041' } });
  const ex042 = await prisma.exercicio.findUnique({ where: { codigo: 'EX042' } });
  const ex057 = await prisma.exercicio.findUnique({ where: { codigo: 'EX057' } });
  const ex061 = await prisma.exercicio.findUnique({ where: { codigo: 'EX061' } });
  const ex068 = await prisma.exercicio.findUnique({ where: { codigo: 'EX068' } });

  if (
    professorMateus &&
    ex031 && ex032 && ex035 && ex041 && ex042 && ex057 && ex061 && ex068
  ) {
    await upsertTreinoPorCodigoSemUnique({
      codigo: "TR003",
      updateData: {
        nome: "Agilidade & Core (Escada + Pliometria)",
        descricao: "Circuito integrado de escada, mudanças de direção, pliometria e core.",
        nivel: Nivel.Avancado,
        categoria: [Categoria.Livre],
        duracao: 50,
        tipoTreino: TipoTreino.Fisico,
        professorId: professorMateus.id,
        dataAgendada: prazo25Out,
        imagemUrl: "/assets/treinos/agilidade.jpg",
        pontuacao: 14,
        exercicios: {
          deleteMany: {},
          create: [
            { exercicioId: ex031.id, ordem: 1, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex032.id, ordem: 2, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex041.id, ordem: 3, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex042.id, ordem: 4, repeticoes: "4x 15m (zig-zag)" },
            { exercicioId: ex057.id, ordem: 5, repeticoes: "4x 6 saltos" },
            { exercicioId: ex061.id, ordem: 6, repeticoes: "3x 20s (shuffle)" },
            { exercicioId: ex035.id, ordem: 7, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex068.id, ordem: 8, repeticoes: "3x 40s (isometria)" },
          ],
        },
      },
      createData: {
        codigo: "TR003",
        nome: "Agilidade & Core (Escada + Pliometria)",
        descricao: "Circuito integrado de escada, mudanças de direção, pliometria e core.",
        nivel: Nivel.Avancado,
        categoria: [Categoria.Livre],
        duracao: 50,
        tipoTreino: TipoTreino.Fisico,
        professorId: professorMateus.id,
        dataAgendada: prazo25Out,
        imagemUrl: "/assets/treinos/agilidade.jpg",
        pontuacao: 14,
        exercicios: {
          create: [
            { exercicioId: ex031.id, ordem: 1, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex032.id, ordem: 2, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex041.id, ordem: 3, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex042.id, ordem: 4, repeticoes: "4x 15m (zig-zag)" },
            { exercicioId: ex057.id, ordem: 5, repeticoes: "4x 6 saltos" },
            { exercicioId: ex061.id, ordem: 6, repeticoes: "3x 20s (shuffle)" },
            { exercicioId: ex035.id, ordem: 7, repeticoes: "3x 20s + 20s descanso" },
            { exercicioId: ex068.id, ordem: 8, repeticoes: "3x 40s (isometria)" },
          ],
        },
      },
    });
  }

  const senhaFormado = await hash('atleta123');

  const usuarioFormado = await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'atleta.formadores' },
    update: {},
    create: {
      nomeDeUsuario: 'atleta.formadores',
      nome: 'Mauro Formado',
      email: 'atleta.formadores@example.com',
      senhaHash: senhaFormado,
      tipo: TipoUsuario.Atleta,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/atleta-formadores.png',
      atleta: {
        create: {
          nome: 'Mauro',
          sobrenome: 'Formado',
          email: 'atleta.formadores@example.com',
          idade: 17,
          posicao: PosicaoCampo.MEI,
          altura: 1.77,
          peso: 66,
          nacionalidade: 'Brasileira',
          naturalidade: 'São Paulo - SP',
          telefone1: '11999990022',
          seloQualidade: 'Prata',
          categoria: [Categoria.Sub17],
          foto: '/assets/usuarios/atleta-formadores.png',
          clubeId: clube1Db ? clube1Db.id : null,
        },
      },
    },
  });

  const atletaFormado = await prisma.atleta.findUnique({
    where: { usuarioId: usuarioFormado.id },
  });

  if (atletaFormado && escolinhaEstrelasDb) {
    const jaTem = await prisma.vinculoFormacao.findFirst({
      where: {
        atletaId: atletaFormado.id,
        origem: OrigemFormador.Escolinha,
        origemId: escolinhaEstrelasDb.id,
      },
    });

    if (!jaTem) {
      await prisma.vinculoFormacao.create({
        data: {
          atletaId: atletaFormado.id,
          origem: OrigemFormador.Escolinha,
          origemId: escolinhaEstrelasDb.id,
          inicio: new Date(new Date().getFullYear() - 2, 0, 15),
          observacoes: 'Vínculo criado no seed para demo do módulo Formadores.',
        },
      });
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
          posicao: PosicaoCampo.ZD,
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
      posicao: PosicaoCampo.ZD,
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

  await prisma.atividadeRecente.createMany({
    data: [
      {
        usuarioId: atletaTeste.usuarioId,
        tipo: "Treino",
        imagemUrl: "/assets/treinos/controle.jpg",
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
          posicao: PosicaoCampo.ZE,
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

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'atleta_free' },
    update: {
      senhaHash: H['atleta_free'],
      tipo: TipoUsuario.Atleta,
      verified: true,
    },
    create: {
      nome: 'Atleta Free',
      nomeDeUsuario: 'atleta_free',
      email: 'atleta_free@example.com',
      senhaHash: H['atleta_free'],
      tipo: TipoUsuario.Atleta,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-atleta-free.png',
      atleta: {
        create: {
          nome: 'Atleta',
          sobrenome: 'Free',
          email: 'atleta_free@example.com',
          idade: 15,
          posicao: PosicaoCampo.MEI,
          altura: 1.70,
          peso: 60,
          nacionalidade: 'Brasileira',
          naturalidade: 'São Paulo - SP',
          telefone1: '11999990001',
          seloQualidade: 'Bronze',
          categoria: [Categoria.Sub15],
          foto: '/assets/usuarios/teste-atleta-free.png',
        },
      },
    },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'atleta_pro' },
    update: {
      senhaHash: H['atleta_pro'],
      tipo: TipoUsuario.Atleta,
      verified: true,
    },
    create: {
      nome: 'Atleta Pro',
      nomeDeUsuario: 'atleta_pro',
      email: 'atleta_pro@example.com',
      senhaHash: H['atleta_pro'],
      tipo: TipoUsuario.Atleta,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-atleta-pro.png',
      atleta: {
        create: {
          nome: 'Atleta',
          sobrenome: 'Pro',
          email: 'atleta_pro@example.com',
          idade: 16,
          posicao: PosicaoCampo.CA,
          altura: 1.75,
          peso: 65,
          nacionalidade: 'Brasileira',
          naturalidade: 'São Paulo - SP',
          telefone1: '11999990002',
          seloQualidade: 'Prata',
          categoria: [Categoria.Sub17],
          foto: '/assets/usuarios/teste-atleta-pro.png',
        },
      },
    },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'prof_pro' },
    update: {
      senhaHash: H['prof_pro'],
      tipo: TipoUsuario.Professor,
      verified: true,
    },
    create: {
      nome: 'Professor Pro',
      nomeDeUsuario: 'prof_pro',
      email: 'prof_pro@example.com',
      senhaHash: H['prof_pro'],
      tipo: TipoUsuario.Professor,
      cidade: 'Vitória',
      estado: 'ES',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-prof-pro.png',
      professor: {
        create: {
          codigo: 'PROF_PRO',
          cref: 'ES000002',
          areaFormacao: 'Educação Física',
          escola: 'Academia FC',
          qualificacoes: ['Professor de teste (PRO)'],
          certificacoes: ['Licença B'],
          fotoUrl: '/assets/usuarios/teste-prof-pro.png',
          nome: 'Professor Pro',
        },
      },
    },
  });
  
  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'scout_free' },
    update: {
      senhaHash: H['scout_free'],
      tipo: TipoUsuario.Olheiro,
      verified: true,
    },
    create: {
      nome: 'Olheiro Free',
      nomeDeUsuario: 'scout_free',
      email: 'scout_free@example.com',
      senhaHash: H['scout_free'],
      tipo: TipoUsuario.Olheiro,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-scout-free.png',
      olheiro: {
        create: {
          descricao: 'Olheiro de teste (FREE)',
          areaAtuacao: 'Sudeste',
          telefonePublico: '11999990003',
          emailPublico: 'scout_free@example.com',
          fotoUrl: '/assets/usuarios/teste-scout-free.png',
        },
      },
    },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'scout_pro' },
    update: {
      senhaHash: H['scout_pro'],
      tipo: TipoUsuario.Olheiro,
      verified: true,
    },
    create: {
      nome: 'Olheiro Pro',
      nomeDeUsuario: 'scout_pro',
      email: 'scout_pro@example.com',
      senhaHash: H['scout_pro'],
      tipo: TipoUsuario.Olheiro,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-scout-pro.png',
      olheiro: {
        create: {
          descricao: 'Olheiro de teste (PRO)',
          areaAtuacao: 'Sudeste',
          telefonePublico: '11999990004',
          emailPublico: 'scout_pro@example.com',
          fotoUrl: '/assets/usuarios/teste-scout-pro.png',
        },
      },
    },
  });

  await prisma.usuario.upsert({
    where: { nomeDeUsuario: 'escolinha_01' },
    update: {
      senhaHash: H['escolinha_01'],
      tipo: TipoUsuario.Escolinha,
      verified: true,
    },
    create: {
      nome: 'Escolinha 01',
      nomeDeUsuario: 'escolinha_01',
      email: 'escolinha_01@example.com',
      senhaHash: H['escolinha_01'],
      tipo: TipoUsuario.Escolinha,
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      foto: '/assets/usuarios/teste-escolinha-01.png',
      escolinha: {
        create: {
          nome: 'Escolinha 01',
          cidade: 'São Paulo',
          estado: 'SP',
          pais: 'Brasil',
          email: 'escolinha_01@example.com',
          cnpj: '11.111.111/0001-11',
          telefone1: '11999990005',
          logradouro: 'Rua Teste',
          numero: '123',
          bairro: 'Centro',
          cep: '01000-000',
          sede: 'São Paulo',
          logo: '/assets/usuarios/teste-escolinha-01.png',
        },
      },
    },
  });

  const atletaFree = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'atleta_free' },
  });

  const atletaPro = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'atleta_pro' },
  });

  if (atletaFree) {
    await prisma.assinatura.upsert({
      where: {
        usuarioId_plano: {
          usuarioId: atletaFree.id,
          plano: "FREE",
        },
      },
      update: {},
      create: {
        usuarioId: atletaFree.id,
        plano: "FREE",
        periodicidade: "Mensal",
        startsAt: monthsAgo(3),
        canceledAt: null,
        ativo: true,
        renovaEm: monthsAgo(-1),
      },
    });
  }

  if (atletaPro) {
    await prisma.assinatura.upsert({
      where: {
        usuarioId_plano: {
          usuarioId: atletaPro.id,
          plano: "PRO",
        },
      },
      update: {},
      create: {
        usuarioId: atletaPro.id,
        plano: "PRO",
        periodicidade: "Mensal",
        startsAt: monthsAgo(2),
        canceledAt: null,
        ativo: true,
        renovaEm: monthsAgo(-1),
      },
    });
  }

  if (atletaTeste) {
    
     await prisma.assinatura.upsert({
      where: {
        usuarioId_plano: {
          usuarioId: atletaTeste.usuarioId,
          plano: "PRO",
        },
      },
      update: {},
      create: {
        usuarioId: atletaTeste.usuarioId,
        plano: "PRO",
        periodicidade: "Mensal",
        startsAt: monthsAgo(2),
        canceledAt: daysAgo(10),
        ativo: false,
        renovaEm: monthsAgo(-1),
      },
    });
  }

  if (atletaFree) {
    await prisma.atividadeRecente.createMany({
      data: [
        {
          usuarioId: atletaFree.id,
          tipo: "TREINO",
          createdAt: daysAgo(1),
        },
        {
          usuarioId: atletaFree.id,
          tipo: "DESAFIO",
          createdAt: daysAgo(3),
        },
        {
          usuarioId: atletaFree.id,
          tipo: "POST",
          createdAt: daysAgo(10),
        },
      ],
    });
  }

  if (atletaPro) {
    await prisma.atividadeRecente.createMany({
      data: [
        {
          usuarioId: atletaPro.id,
          tipo: "TREINO",
          createdAt: daysAgo(2),
        },
        {
          usuarioId: atletaPro.id,
          tipo: "TREINO",
          createdAt: daysAgo(8),
        },
        {
          usuarioId: atletaPro.id,
          tipo: "DESAFIO",
          createdAt: daysAgo(15),
        },
      ],
    });
  }

  if (atletaTeste) {
    await prisma.atividadeRecente.createMany({
      data: [
        {
          usuarioId: atletaTeste.usuarioId,
          tipo: "TREINO",
          createdAt: daysAgo(1),
        },
        {
          usuarioId: atletaTeste.usuarioId,
          tipo: "TREINO",
          createdAt: daysAgo(20),
        },
      ],
    });
  }

  const agora = new Date();
  const renovaFutura = new Date(2099, 0, 1);

  const usuarioAtletaPro = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'atleta_pro' },
  });
  const usuarioProfPro = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'prof_pro' },
  });
  const usuarioScoutPro = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'scout_pro' },
  });
  const usuarioEscolinha01Db = await prisma.usuario.findUnique({
    where: { nomeDeUsuario: 'escolinha_01' },
  });

  const clubeFootera = await prisma.clube.findFirst({
    where: { usuario: { nomeDeUsuario: "clube_footera" } },
    select: { id: true },
  });

  const escolinhaEstrelas = await prisma.escolinha.findFirst({
    where: { usuario: { nomeDeUsuario: "escola_estrelas" } },
    select: { id: true },
  });

  if (!clubeFootera?.id) console.warn("⚠️ Clube FootEra não encontrado (clube_footera).");
  if (!escolinhaEstrelas?.id) console.warn("⚠️ Escola Estrelas não encontrada (escola_estrelas).");

  const professores4 = await prisma.professor.findMany({
    where: {
      usuario: {
        nomeDeUsuario: {
          in: ["prof_clube_footera", "prof_free", "arthur.persio", "prof_pro"],
        },
      },
    },
    select: { id: true, usuario: { select: { nomeDeUsuario: true } } },
  });

  if (professores4.length < 4) {
    console.warn(
      `⚠️ Achei só ${professores4.length}/4 professores pra vincular. Encontrados:`,
      professores4
        .map((p) => p.usuario?.nomeDeUsuario)
        .filter(Boolean)
    );
  }

  if (clubeFootera?.id && professores4.length) {
    await prisma.professorClube.createMany({
      data: professores4.map((p) => ({
        professorId: p.id,
        clubeId: clubeFootera.id,
      })),
      skipDuplicates: true,
    });
  }

  if (escolinhaEstrelas?.id && professores4.length) {
    await prisma.professorEscolinha.createMany({
      data: professores4.map((p) => ({
        professorId: p.id,
        escolinhaId: escolinhaEstrelas.id,
      })),
      skipDuplicates: true,
    });
  }

  async function garantirAssinaturaFixa(
    usuarioId: string,
    plano: string,
    periodicidade: Periodicidade
  ) {
    await prisma.assinatura.upsert({
      where: {
        usuarioId_plano: {
          usuarioId,
          plano,
        },
      },
      update: {
        plano,
        periodicidade,
        startsAt: agora,
        renovaEm: renovaFutura,
        ativo: true,
        canceledAt: null,
      },
      create: {
        usuarioId,
        plano,
        periodicidade,
        startsAt: agora,
        renovaEm: renovaFutura,
        ativo: true,
      },
    });

    const jaTemPagamento = await prisma.pagamento.findFirst({
      where: {
        usuarioId,
        plano,
        status: PagamentoStatus.APROVADO,
      },
    });

    if (!jaTemPagamento) {
      await prisma.pagamento.create({
        data: {
          usuarioId,
          plano,
          periodicidade,
          metodo: MetodoPagamento.PIX,
          status: PagamentoStatus.APROVADO,
          valor: 0,
          moeda: 'BRL',
          criadoEm: agora,
          pagoEm: agora,
        },
      });
    }
  }

  if (usuarioAtletaPro) {
    await garantirAssinaturaFixa(
      usuarioAtletaPro.id,
      'ATLETA_PRO',
      Periodicidade.Mensal
    );
  }

  if (usuarioProfPro) {
    await garantirAssinaturaFixa(
      usuarioProfPro.id,
      'PROFESSOR_PRO',
      Periodicidade.Mensal
    );
  }

  if (usuarioScoutPro) {
    await garantirAssinaturaFixa(
      usuarioScoutPro.id,
      'OLHEIRO_PRO',
      Periodicidade.Mensal
    );
  }

  if (usuarioEscolinha01Db) {
    await garantirAssinaturaFixa(
      usuarioEscolinha01Db.id,
      'ESCOLINHA_PRO',
      Periodicidade.Mensal
    );
  }

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

    const treino = await upsertTreinoPorCodigoSemUnique({
      codigo: "TR001",
      updateData: {
        tipoTreino: TipoTreino.Fisico,
        dataAgendada: prazo25Out,
        exercicios: {
          deleteMany: {},
          create: [
            { exercicioId: exA.id, ordem: 1, repeticoes: "4x 45s + 15s descanso" },
            { exercicioId: exB.id, ordem: 2, repeticoes: "3x 12 reps" },
            { exercicioId: exC.id, ordem: 3, repeticoes: "3x 10 lançamentos" },
            { exercicioId: exD.id, ordem: 4, repeticoes: "4x 8 cabeceios" },
            { exercicioId: exE.id, ordem: 5, repeticoes: "4x 60s" },
          ],
        },
      },
      createData: {
        nome: "Treino Resistencia Física",
        codigo: "TR001",
        descricao: "Treino voltado para resistência",
        nivel: Nivel.Avancado,
        pontuacao: 10,
        duracao: 45,
        categoria: [Categoria.Livre],
        imagemUrl: "/assets/treinos/resistencia.jpg",
        professorId: professorArthur.id,
        tipoTreino: TipoTreino.Fisico,
        dataAgendada: prazo25Out,
        exercicios: {
          create: [
            { exercicioId: exA.id, ordem: 1, repeticoes: "4x 45s + 15s descanso" },
            { exercicioId: exB.id, ordem: 2, repeticoes: "3x 12 reps" },
            { exercicioId: exC.id, ordem: 3, repeticoes: "3x 10 lançamentos" },
            { exercicioId: exD.id, ordem: 4, repeticoes: "4x 8 cabeceios" },
            { exercicioId: exE.id, ordem: 5, repeticoes: "4x 60s" },
          ],
        },
      },
    });

    const dataTreino = new Date();

    const treinoAgendado = await prisma.treinoAgendado.upsert({
      where: {
        atletaId_treinoProgramadoId_dataTreino: {
          atletaId: atletaAaaaa.id,
          treinoProgramadoId: treino.id,
          dataTreino,
        },
      },
      update: {},
      create: {
        titulo: treino.nome,
        dataExpiracao: dataTreino,
        dataTreino,
        local: "Quadra A",
        atleta: { connect: { id: atletaAaaaa.id } },
        treinoProgramado: { connect: { id: treino.id } },
      },
    });

    const jaExiste = await prisma.submissaoTreino.findFirst({
      where: {
        atletaId: atletaAaaaa.id,
        treinoAgendadoId: treinoAgendado.id,
      },
    });

    if (!jaExiste) {
      await prisma.submissaoTreino.create({
        data: {
          atletaId: atletaAaaaa.id,
          treinoAgendadoId: treinoAgendado.id,
          observacao: "Concluído com sucesso",
          aprovado: true,
        },
      });
    }

    await prisma.atividadeRecente.createMany({
      data: [
        {
          usuarioId: atletaAaaaa.usuarioId,
          tipo: "Treino",
        },
      ],
      skipDuplicates: true,
    });
  }

    if (atletaFree && atletaPro) {
    const follow1 = await prisma.seguidor.findFirst({
      where: {
        seguidorUsuarioId: atletaFree.id,
        seguidoUsuarioId: atletaPro.id,
      },
    });

    let post1 = await prisma.postagem.findFirst({
      where: { conteudo: "Primeiro treino do dia!", usuarioId: atletaFree.id },
    });

    if (!post1) {
      post1 = await prisma.postagem.create({
        data: {
          conteudo: "Primeiro treino do dia!",
          usuarioId: atletaFree.id,
          dataCriacao: daysAgo(1),
        },
      });
    }

    let post2 = await prisma.postagem.findFirst({
      where: { conteudo: "Treino intenso hoje 💪" },
    });

    if (!post2) {
      post2 = await prisma.postagem.create({
        data: {
          conteudo: "Treino intenso hoje 💪",
          usuarioId: atletaPro.id,
          dataCriacao: daysAgo(2),
        },
      });
    }

    let post3 = await prisma.postagem.findFirst({
      where: { conteudo: "Alongamento pós-treino" },
    });

    if (!post3) {
      post3 = await prisma.postagem.create({
        data: {
          conteudo: "Alongamento pós-treino",
          usuarioId: atletaFree.id,
          dataCriacao: daysAgo(5),
        },
      });
    }

    await prisma.comentario.createMany({
      data: [
        {
          postagemId: post1.id,
          usuarioId: atletaPro.id,
          conteudo: "Bora pra cima!",
          dataCriacao: daysAgo(1),
        },
        {
          postagemId: post2.id,
          usuarioId: atletaFree.id,
          conteudo: "Boa!",
          dataCriacao: daysAgo(2),
        },
      ],
      skipDuplicates: true,
    });

    await prisma.curtida.createMany({
      data: [
        {
          postagemId: post1.id,
          usuarioId: atletaPro.id,
          createdAt: daysAgo(1),
        },
        {
          postagemId: post2.id,
          usuarioId: atletaFree.id,
          createdAt: daysAgo(2),
        },
        {
          postagemId: post2.id,
          usuarioId: atletaTeste?.usuarioId ?? atletaFree.id,
          createdAt: daysAgo(3),
        },
      ],
      skipDuplicates: true,
    });

    if (!follow1) {
      await prisma.seguidor.create({
        data: {
          seguidorUsuarioId: atletaFree.id,
          seguidoUsuarioId: atletaPro.id,
        },
      });
    }

    const follow2 = await prisma.seguidor.findFirst({
      where: {
        seguidorUsuarioId: atletaPro.id,
        seguidoUsuarioId: atletaFree.id,
      },
    });

    if (!follow2) {
      await prisma.seguidor.create({
        data: {
          seguidorUsuarioId: atletaPro.id,
          seguidoUsuarioId: atletaFree.id,
        },
      });
    }

    const msgInicial = await prisma.mensagem.findFirst({
      where: {
        deId: atletaFree.id,
        paraId: atletaPro.id,
        conteudo: "Mensagem inicial seed E2E",
      },
    });

    if (!msgInicial) {
      await prisma.mensagem.create({
        data: {
          deId: atletaFree.id,
          paraId: atletaPro.id,
          conteudo: "Mensagem inicial seed E2E",
          tipo: TipoMensagem.NORMAL,
        },
      });
    }
  }

  await prisma.usuario.updateMany({
    data: { verified: true },
  });

  const profFreeDb = await prisma.professor.findFirst({
    where: { usuario: { nomeDeUsuario: "prof_free" } },
  });

  const atletaFreeDb = await prisma.atleta.findFirst({
    where: { usuario: { nomeDeUsuario: "atleta_free" } },
  });

  if (profFreeDb && atletaFreeDb) {
    const relacaoExistente = await prisma.relacaoTreinamento.findFirst({
      where: {
        professorId: profFreeDb.id,
        atletaId: atletaFreeDb.id,
      },
    });

    if (relacaoExistente) {
      await prisma.relacaoTreinamento.update({
        where: { id: relacaoExistente.id },
        data: {
          encerradoEm: null,
        },
      });
    } else {
      await prisma.relacaoTreinamento.create({
        data: {
          professorId: profFreeDb.id,
          atletaId: atletaFreeDb.id,
          criadoEm: new Date(),
          encerradoEm: null,
        },
      });
    }

    if (profClubeFooteraDb2?.id && clubeFooteraDb?.id) {
      await garantirVinculoProfessorOrganizacaoSeed({
        professorId: profClubeFooteraDb2.id,
        tipo: "CLUBE",
        ownerId: clubeFooteraDb.id,
      });
    }

    if (profArthurDb?.id && escolinhaEstrelasDb2?.id) {
      await garantirVinculoProfessorOrganizacaoSeed({
        professorId: profArthurDb.id,
        tipo: "ESCOLINHA",
        ownerId: escolinhaEstrelasDb2.id,
      });
    }

    if (profFreeDb2?.id && escolinhaEstrelasDb2?.id) {
      await garantirVinculoProfessorOrganizacaoSeed({
        professorId: profFreeDb2.id,
        tipo: "ESCOLINHA",
        ownerId: escolinhaEstrelasDb2.id,
      });
    }
  }
 console.log("✅ Seed completo executado com sucesso!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });

  async function garantirVinculoProfessorOrganizacaoSeed(params: {
      professorId: string;
      tipo: "CLUBE" | "ESCOLINHA";
      ownerId: string;
    }) {
      const { professorId, tipo, ownerId } = params;

      const rel = await prisma.relacaoTreinamento.findFirst({
        where: {
          professorId,
          atletaId: null,
          ...(tipo === "CLUBE" ? { clubeId: ownerId } : { escolinhaId: ownerId }),
        },
        select: { id: true },
      });

      if (!rel) {
        await prisma.relacaoTreinamento.create({
          data: {
            professorId,
            atletaId: null,
            clubeId: tipo === "CLUBE" ? ownerId : null,
            escolinhaId: tipo === "ESCOLINHA" ? ownerId : null,
            ativo: true,
          },
        });
      }

      const gestor = await prisma.organizacaoGestor.findFirst({
        where: {
          professorId,
          tipo: tipo as any,
          ownerId,
        },
        select: { id: true },
      });

      if (!gestor) {
        await prisma.organizacaoGestor.create({
          data: {
            professorId,
            tipo: tipo as any,
            ownerId,
            ativo: true,
          },
        });
      }
    }