/// <reference types="node" />

import { PrismaClient } from "@prisma/client";
import process from 'node:process'

const prisma = new PrismaClient;

const LISTA = [
  "Treino de Agilidade com Sprint",
  "Treino Teste de Resistência",
  "Treino Avançado de Controle",
  "Treino Resistência Física",
  "Treino Técnico de Defesa",
];

function codigo(nome: string) {
  const slug = nome
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug}-${Date.now()}`;
}

async function main() {
  for (const nome of LISTA) {
    await prisma.treinoProgramado.upsert({
      where: { nome }, 
      update: {
        naoExpira: true,
        dataAgendada: null, 
      },
      create: {
        nome,
        codigo: codigo(nome),
        nivel: "Base",              
        tipoTreino: "Físico",      
        categoria: [],
        duracao: 60,                
        pontuacao: 10,   
        dicas: [],
        naoExpira: true,
        dataAgendada: null,
      },
    });
    console.log(`[ok] ${nome} restaurado e marcado como sem validade.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });