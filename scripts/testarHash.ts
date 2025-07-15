import bcrypt from "bcryptjs";

const senhaDigitada = "123456"; // ou qualquer senha que você quer testar
const hashSalvo = "$2b$10$kiFreLJKqjuwT5HlkbABCDEFghijklmno123456789"; // copiado do banco

async function testarSenha() {
  const resultado = await bcrypt.compare(senhaDigitada, hashSalvo);
  console.log(`Senha correta? ${resultado ? "SIM" : "NÃO"}`);
}

testarSenha();
