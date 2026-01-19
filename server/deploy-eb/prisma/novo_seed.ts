import { PrismaClient, TipoUsuario, Categoria, PosicaoCampo } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedAtletas10() {
  const atletas = [
    {
      user: { username: "atleta_01", nome: "Rafael", email: "atleta_01@example.com", foto: "/assets/usuarios/isadora.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Rafael", sobrenome: "Silva", idade: 16,
        posicao: PosicaoCampo.ZE, altura: 1.78, peso: 70,
        nacionalidade: "Brasileira", naturalidade: "Vitória - ES",
        telefone1: "11990000001", seloQualidade: "Bronze",
        categoria: [Categoria.Sub17], foto: "/assets/usuarios/isadora.jpg",
      },
      local: { cidade: "Vitória", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_02", nome: "Lucas", email: "atleta_02@example.com", foto: "/assets/usuarios/lucas.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Lucas", sobrenome: "Ferreira", idade: 17,
        posicao: PosicaoCampo.LD, altura: 1.74, peso: 68,
        nacionalidade: "Brasileira", naturalidade: "Serra - ES",
        telefone1: "11990000002", seloQualidade: "Prata",
        categoria: [Categoria.Sub17], foto: "/assets/usuarios/lucas.jpg",
      },
      local: { cidade: "Serra", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_03", nome: "Ana", email: "atleta_03@example.com", foto: "/assets/usuarios/ana.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Ana", sobrenome: "Mendes", idade: 15,
        posicao: PosicaoCampo.MC1, altura: 1.65, peso: 58,
        nacionalidade: "Brasileira", naturalidade: "Vila Velha - ES",
        telefone1: "11990000003", seloQualidade: "Bronze",
        categoria: [Categoria.Sub15], foto: "/assets/usuarios/ana.jpg",
      },
      local: { cidade: "Vila Velha", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_04", nome: "Bruno", email: "atleta_04@example.com", foto: "/assets/usuarios/bruno.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Bruno", sobrenome: "Souza", idade: 18,
        posicao: PosicaoCampo.CA, altura: 1.83, peso: 78,
        nacionalidade: "Brasileira", naturalidade: "Cariacica - ES",
        telefone1: "11990000004", seloQualidade: "Ouro",
        categoria: [Categoria.Sub20], foto: "/assets/usuarios/bruno.jpg",
      },
      local: { cidade: "Cariacica", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_05", nome: "Pedro", email: "atleta_05@example.com", foto: "/assets/usuarios/pedro.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Pedro", sobrenome: "Almeida", idade: 16,
        posicao: PosicaoCampo.GOL, altura: 1.86, peso: 80,
        nacionalidade: "Brasileira", naturalidade: "Vitória - ES",
        telefone1: "11990000005", seloQualidade: "Prata",
        categoria: [Categoria.Sub17], foto: "/assets/usuarios/pedro.jpg",
      },
      local: { cidade: "Vitória", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_06", nome: "Isadora", email: "atleta_06@example.com", foto: "/assets/usuarios/isadora.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Isadora", sobrenome: "Pereira", idade: 14,
        posicao: PosicaoCampo.PD, altura: 1.60, peso: 54,
        nacionalidade: "Brasileira", naturalidade: "Guarapari - ES",
        telefone1: "11990000006", seloQualidade: "Bronze",
        categoria: [Categoria.Sub15], foto: "/assets/usuarios/isadora.jpg",
      },
      local: { cidade: "Guarapari", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_07", nome: "Marcos", email: "atleta_07@example.com", foto: "/assets/usuarios/marcos.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Marcos", sobrenome: "Lima", idade: 17,
        posicao: PosicaoCampo.VOL1, altura: 1.76, peso: 71,
        nacionalidade: "Brasileira", naturalidade: "Serra - ES",
        telefone1: "11990000007", seloQualidade: "Prata",
        categoria: [Categoria.Sub17], foto: "/assets/usuarios/marcos.jpg",
      },
      local: { cidade: "Serra", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_08", nome: "Thiago", email: "atleta_08@example.com", foto: "/assets/usuarios/thiago.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Thiago", sobrenome: "Rocha", idade: 19,
        posicao: PosicaoCampo.ME, altura: 1.79, peso: 74,
        nacionalidade: "Brasileira", naturalidade: "Vila Velha - ES",
        telefone1: "11990000008", seloQualidade: "Ouro",
        categoria: [Categoria.Sub20], foto: "/assets/usuarios/thiago.jpg",
      },
      local: { cidade: "Vila Velha", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_09", nome: "Gustavo", email: "atleta_09@example.com", foto: "/assets/usuarios/gustavo.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "Gustavo", sobrenome: "Nunes", idade: 16,
        posicao: PosicaoCampo.ZD, altura: 1.81, peso: 76,
        nacionalidade: "Brasileira", naturalidade: "Cariacica - ES",
        telefone1: "11990000009", seloQualidade: "Prata",
        categoria: [Categoria.Sub17], foto: "/assets/usuarios/gustavo.jpg",
      },
      local: { cidade: "Cariacica", estado: "ES", pais: "Brasil" },
    },
    {
      user: { username: "atleta_10", nome: "João", email: "atleta_10@example.com", foto: "/assets/usuarios/joao.jpg" },
      senha: "atleta123",
      atleta: {
        nome: "João", sobrenome: "Costa", idade: 15,
        posicao: PosicaoCampo.PE, altura: 1.66, peso: 60,
        nacionalidade: "Brasileira", naturalidade: "Vitória - ES",
        telefone1: "11990000010", seloQualidade: "Bronze",
        categoria: [Categoria.Sub15], foto: "/assets/usuarios/joao.jpg",
      },
      local: { cidade: "Vitória", estado: "ES", pais: "Brasil" },
    },
  ];

  let ok = 0;
  for (const a of atletas) {
    const senhaHash = await bcrypt.hash(a.senha, 10);

    await prisma.usuario.upsert({
      where: { nomeDeUsuario: a.user.username },
      update: {
        nome: a.user.nome,
        email: a.user.email,
        tipo: TipoUsuario.Atleta,
        cidade: a.local.cidade,
        estado: a.local.estado,
        pais: a.local.pais,
        foto: a.user.foto,
        senhaHash,
        atleta: {
          upsert: {
            create: {
              nome: a.atleta.nome,
              sobrenome: a.atleta.sobrenome,
              idade: a.atleta.idade,
              posicao: a.atleta.posicao,
              altura: a.atleta.altura,
              peso: a.atleta.peso,
              nacionalidade: a.atleta.nacionalidade,
              naturalidade: a.atleta.naturalidade,
              telefone1: a.atleta.telefone1,
              seloQualidade: a.atleta.seloQualidade,
              categoria: a.atleta.categoria,
              foto: a.atleta.foto,
            },
            update: {
              nome: a.atleta.nome,
              sobrenome: a.atleta.sobrenome,
              idade: a.atleta.idade,
              posicao: a.atleta.posicao,
              altura: a.atleta.altura,
              peso: a.atleta.peso,
              nacionalidade: a.atleta.nacionalidade,
              naturalidade: a.atleta.naturalidade,
              telefone1: a.atleta.telefone1,
              seloQualidade: a.atleta.seloQualidade,
              categoria: a.atleta.categoria,
              foto: a.atleta.foto,
            },
          },
        },
      },
      create: {
        nome: a.user.nome,
        nomeDeUsuario: a.user.username,
        email: a.user.email,
        senhaHash,
        tipo: TipoUsuario.Atleta,
        cidade: a.local.cidade,
        estado: a.local.estado,
        pais: a.local.pais,
        foto: a.user.foto,
        atleta: {
          create: {
            nome: a.atleta.nome,
            sobrenome: a.atleta.sobrenome,
            idade: a.atleta.idade,
            posicao: a.atleta.posicao,
            altura: a.atleta.altura,
            peso: a.atleta.peso,
            nacionalidade: a.atleta.nacionalidade,
            naturalidade: a.atleta.naturalidade,
            telefone1: a.atleta.telefone1,
            seloQualidade: a.atleta.seloQualidade,
            categoria: a.atleta.categoria,
            foto: a.atleta.foto,
          },
        },
      },
    });

    ok++;
  }

  console.log(`✅ Seed: ${ok} atletas criados/atualizados com sucesso.`);
}

async function main() {
  await seedAtletas10();
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });