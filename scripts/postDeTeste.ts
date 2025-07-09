import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Cria ou encontra um usuário de teste
  const usuario = await prisma.usuario.upsert({
    where: { email: "teste@teste.com" },
    update: {},
    create: {
      nome: "Usuário Teste",
      email: "teste@teste.com",
      foto: "/default-user.png",
      nomeDeUsuario: "usuario_teste",
      senhaHash: "hashTeste123", 
      tipo: "Atleta", 
    },
  });

  const post = await prisma.postagem.create({
    data: {
      conteudo: "Essa é uma postagem de teste!",
      imagemUrl: null,
      videoUrl: null,
      dataCriacao: new Date(),
      usuarioId: usuario.id,
    },
  });

  console.log("Post criado com sucesso:", post);
}

main()
  .catch((e) => {
    console.error("Erro ao criar post:", e);
  })
  .finally(() => prisma.$disconnect());
