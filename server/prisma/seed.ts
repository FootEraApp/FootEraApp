import { PrismaClient, TipoUsuario, TipoTreino, Nivel, Categoria, OrigemFormador } from '@prisma/client';
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

  // >>> ADICIONAR AQUI <<<
  'atleta_free': 'senha123',
  'atleta_pro': 'senha123',
  'prof_free': 'senha123',
  'prof_pro': 'senha123',
  'scout_free': 'senha123',
  'scout_pro': 'senha123',
  'escolinha_01': 'senha123',
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
          cargo: 'superadmin',             
          nivel: Nivel.Performance,
          fotoUrl: '/assets/usuarios/profa-teste.png',
        }
      }
    },
    update: {
      tipo: TipoUsuario.Admin,             
      verified: true,
      administrador: {
        upsert: {                           
          create: {
            cargo: 'superadmin',
            nivel: Nivel.Performance,
            fotoUrl: '/assets/usuarios/profa-teste.png',
          },
          update: {
            cargo: 'superadmin',
            nivel: Nivel.Performance,
            fotoUrl: '/assets/usuarios/profa-teste.png',
          }
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

  const escolinhaEstrelasDb = await prisma.escolinha.findFirst({
    where: { usuario: { nomeDeUsuario: "escola_estrelas" } },
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
          colaboracaoClubeId: clube1Db?.id
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
          posicao: "MEI",
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
          posicao: "CA",
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
  await prisma.treinoProgramado.upsert({
    where: { codigo: 'TR003' },
    update: {
      tipoTreino: TipoTreino.Fisico,
      dataAgendada: prazo25Out,
      exercicios: {
        deleteMany: {},
        create: [
          { exercicioId: ex031.id, ordem: 1, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex032.id, ordem: 2, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex041.id, ordem: 3, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex042.id, ordem: 4, repeticoes: '4x 15m (zig-zag)' },
          { exercicioId: ex057.id, ordem: 5, repeticoes: '4x 6 saltos' },
          { exercicioId: ex061.id, ordem: 6, repeticoes: '3x 20s (shuffle)' },
          { exercicioId: ex035.id, ordem: 7, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex068.id, ordem: 8, repeticoes: '3x 40s (isometria)' },
        ],
      },
    },
    create: {
      codigo: 'TR003',
      nome: 'Agilidade & Core (Escada + Pliometria)',
      descricao: 'Circuito integrado de escada, mudanças de direção, pliometria e core.',
      nivel: Nivel.Avancado,
      categoria: [Categoria.Livre],
      duracao: 50,
      tipoTreino: TipoTreino.Fisico,
      professorId: professorMateus.id,
      dataAgendada: prazo25Out,
      imagemUrl: '/assets/treinos/agilidade.jpg',
      pontuacao: 14,
      exercicios: {
        create: [
          { exercicioId: ex031.id, ordem: 1, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex032.id, ordem: 2, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex041.id, ordem: 3, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex042.id, ordem: 4, repeticoes: '4x 15m (zig-zag)' },
          { exercicioId: ex057.id, ordem: 5, repeticoes: '4x 6 saltos' },
          { exercicioId: ex061.id, ordem: 6, repeticoes: '3x 20s (shuffle)' },
          { exercicioId: ex035.id, ordem: 7, repeticoes: '3x 20s + 20s descanso' },
          { exercicioId: ex068.id, ordem: 8, repeticoes: '3x 40s (isometria)' },
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
        posicao: 'MEI',
        altura: 1.77,
        peso: 66,
        nacionalidade: 'Brasileira',
        naturalidade: 'São Paulo - SP',
        telefone1: '11999990022',
        seloQualidade: 'Prata',
        categoria: [Categoria.Sub17],
        foto: '/assets/usuarios/atleta-formadores.png',
        clubeId: clube1Db?.id || null,
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

  // const desafios = [
  //   {
  //     titulo: 'Desafio Controle Aéreo',
  //     descricao: 'Mantenha a bola no ar pelo maior tempo possível usando diferentes partes do corpo.',
  //     imagemUrl: '/assets/controle-aereo.jpg',
  //     nivel: Nivel.Avancado,
  //     pontuacao: 10,
  //     categoria: [Categoria.Sub15]
  //   },
  //   {
  //     titulo: 'Desafio Equilíbrio e Agilidade',
  //     descricao: 'Supere um percurso de obstáculos mantendo o controle da bola.',
  //     imagemUrl: '/assets/treino-agilidade.webp',
  //     nivel: Nivel.Avancado,
  //     pontuacao: 8,
  //     categoria: [Categoria.Sub13]
  //   }
  // ];
  // for (const desafio of desafios) {
  //   const exists = await prisma.desafioOficial.findFirst({ where: { titulo: desafio.titulo } });
  //   if (!exists) {
  //     await prisma.desafioOficial.create({ data: desafio });
  //   }
  // }

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
          posicao: "ZD",
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
      posicao: "ZD",
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
      // {
      //   usuarioId: usuarioTeste.id,
      //   tipo: "Desafio",
      //   imagemUrl: "/assets/desafios/velocidade.jpg",
      // },
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

  // const desafioExtra = await prisma.desafioOficial.upsert({
  //   where: { titulo: "Desafio de Velocidade" },
  //   update: {},
  //   create: {
  //     titulo: "Desafio de Velocidade",
  //     descricao: "Complete um circuito em tempo recorde.",
  //     nivel: Nivel.Performance,
  //     pontuacao: 15,
  //     categoria: [Categoria.Sub17],
  //     imagemUrl: "/assets/desafios/velocidade.jpg"
  //   }
  // });

  // await prisma.submissaoDesafio.upsert({
  //   where: { videoUrl: "https://www.google.com/imgres?q=desafio%20velocidade%20futebol&imgurl=https%3A%2F%2Fwww.tiktok.com%2Fapi%2Fimg%2F%3FitemId%3D7358856354527857926%26location%3D0%26aid%3D1988&imgrefurl=https%3A%2F%2Fwww.tiktok.com%2F%40adonias%2Fvideo%2F7358856354527857926&docid=Q3i_9CrrR3OQFM&tbnid=3SL_XXb6IEl1zM&vet=12ahUKEwjx6-2iseWOAxWYiJUCHYlxORkQM3oECBkQAA..i&w=1080&h=1920&hcb=2&ved=2ahUKEwjx6-2iseWOAxWYiJUCHYlxORkQM3oECBkQAA" },
  //   update: {},
  //   create: {
  //     atletaId: atletaTeste.id,
  //     desafioId: desafioExtra.id,
  //     videoUrl: "https://www.google.com/imgres?q=desafio%20velocidade%20futebol&imgurl=https%3A%2F%2Fwww.tiktok.com%2Fapi%2Fimg%2F%3FitemId%3D7358856354527857926%26location%3D0%26aid%3D1988&imgrefurl=https%3A%2F%2Fwww.tiktok.com%2F%40adonias%2Fvideo%2F7358856354527857926&docid=Q3i_9CrrR3OQFM&tbnid=3SL_XXb6IEl1zM&vet=12ahUKEwjx6-2iseWOAxWYiJUCHYlxORkQM3oECBkQAA..i&w=1080&h=1920&hcb=2&ved=2ahUKEwjx6-2iseWOAxWYiJUCHYlxORkQM3oECBkQAA",
  //     aprovado: true,
  //   },
  // });

// const desafioTeste2 = await prisma.desafioOficial.upsert({
//   where: { titulo: "Desafio de Controle Avançado" },
//   update: {},
//   create: {
//     titulo: "Desafio de Controle Avançado",
//     descricao: "Mantenha a posse da bola com domínio total durante 60 segundos.",
//     nivel: Nivel.Performance,
//     pontuacao: 20,
//     categoria: [Categoria.Sub15],
//     imagemUrl: "/assets/desafios/controle-avancado.jpg",
//   },
// });

// await prisma.submissaoDesafio.upsert({
//   where: { videoUrl: "https://www.youtube.com/watch?v=controle_avancado" },
//   update: {},
//   create: {
//     atletaId: atletaTeste!.id,
//     desafioId: desafioTeste2.id,
//     videoUrl: "https://www.youtube.com/watch?v=controle_avancado",
//     aprovado: true,
//   },
// });

await prisma.atividadeRecente.createMany({
  data: [
    {
      usuarioId: atletaTeste!.usuarioId,
      tipo: "Treino",
      imagemUrl: "/assets/treinos/controle.jpg",
    },
    // {
    //   usuarioId: atletaTeste!.usuarioId,
    //   tipo: "Desafio",
    //   imagemUrl: "/assets/desafios/controle-avancado.jpg",
    // },
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
        posicao: "ZE",
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

// ====================== USUÁRIOS DE TESTE CYPRESS ======================

// 1) Atleta Free
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'atleta_free' },
  update: {},
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
        posicao: 'MEI',
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

// 2) Atleta Pro
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'atleta_pro' },
  update: {},
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
        posicao: 'CA',
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

// 3) Professor Free
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'prof_free' },
  update: {},
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
      },
    },
  },
});

// 4) Professor Pro
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'prof_pro' },
  update: {},
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

// 5) Olheiro Free
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'scout_free' },
  update: {},
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

// 6) Olheiro Pro
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'scout_pro' },
  update: {},
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

// 7) Escolinha (escolinha_01)
await prisma.usuario.upsert({
  where: { nomeDeUsuario: 'escolinha_01' },
  update: {},
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

  const dataTreino = new Date();

  const treinoAgendado = await prisma.treinoAgendado.upsert({
    where: {
      atletaId_treinoProgramadoId_dataTreino: {
        atletaId: atletaAaaaa.id,
        treinoProgramadoId: treino.id,
        dataTreino, // mesma data usada no create
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

  // const desafio = await prisma.desafioOficial.upsert({
  //   where: { titulo: "Desafio Técnica com Bola" },
  //   update: {},
  //   create: {
  //     titulo: "Desafio Técnica com Bola",
  //     descricao: "Controle e passes curtos",
  //     nivel: Nivel.Base,
  //     categoria: [Categoria.Sub9],
  //     pontuacao: 15,
  //     imagemUrl: "/assets/desafios/tecnico-bola.jpg"
  //   },
  // });

  // await prisma.submissaoDesafio.upsert({
  //   where: { videoUrl: "https://video.url/desafio.mp4" },
  //   update: {},
  //   create: {
  //     atleta: { connect: { id: atletaAaaaa.id } },
  //     desafio: { connect: { id: desafio.id } },
  //     videoUrl: "https://video.url/desafio.mp4",
  //     aprovado: true,
  //   },
  // });

  await prisma.atividadeRecente.createMany({
    data: [
      {
        usuarioId: atletaAaaaa.usuarioId,
        tipo: "Treino",
        imagemUrl: "/assets/treinos/resistencia.jpg",
      },
      // {
      //   usuarioId: atletaAaaaa.usuarioId,
      //   tipo: "Desafio",
      //   imagemUrl: "/assets/desafios/tecnico-bola.jpg",
      // },
    ],
    skipDuplicates: true,
  });
}
  // garanta que TODOS os usuários fiquem verificados
  await prisma.usuario.updateMany({
    data: { verified: true },
  });

  console.log("✅ Seed completo executado com sucesso!");
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });