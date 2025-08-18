import { PrismaClient, Nivel, Categoria } from "@prisma/client";
import crypto from "node:crypto";
import process from 'node:process';

const prisma = new PrismaClient();

type ExIn = {
    codigo: string;
    nome: string;
    nivel: "Base" | "Avancado" | "Performance";
    categorias: Categoria[];
    repeticoes: string;
};

async function addExerciciosAoTreino(treinoProgramadoId: string, exercicios: ExIn[]) {
    await prisma.$transaction(async (tx) => {

        for (let i = 0; i < exercicios.length; i++) {
            const ex = exercicios[i];

            const exercicio = await tx.exercicio.upsert({
                where: { nome: ex.nome },
                update: {},
                create: {
                    id: crypto.randomUUID(),
                    codigo: ex.codigo,
                    nome: ex.nome,
                    nivel: ex.nivel as Nivel,
                    categorias: ex.categorias,
                },
            });

            const jaVinculado = await tx.treinoProgramadoExercicio.count({
                where: { treinoProgramadoId, exercicioId: exercicio.id },
            });
            if (jaVinculado) continue;

            await tx.treinoProgramadoExercicio.create({
                data: {
                    treinoProgramadoId,
                    exercicioId: exercicio.id,
                    ordem: i + 1,
                    repeticoes: ex.repeticoes,
                },
            });
        }
    });
}

const plano: Record<string, Array<{ nome: string; repeticoes: string }>> = {
  "Treino Resistencia Física": [
    { nome: "Corrida contínua", repeticoes: "20 min" },
    { nome: "Polichinelo", repeticoes: "3x30" },
    { nome: "Pular Corda", repeticoes: "4x1min"}
  ],
  "Treino Técnico de Defesa": [
    { nome: "Cabeceio Defensivo", repeticoes: "4x10" },
    { nome: "Recuperação de Bola", repeticoes: "3x2min"},
  ],
  "Treino de Agilidade com Sprint": [
    { nome: "Desarme lateral", repeticoes: "4x10" },
    { nome: "Posicionamento 1x1", repeticoes: "3x8" },
  ],
  "Treino Avançado de Controle": [
    { nome: "Sprint com Mudança de Direção", repeticoes: "4x10" },
    { nome: "Controle com remate", repeticoes: "3x12" },
  ],
  "Treino Resistência com a Bola": [
    { nome: "Controle de Bola Avançado", repeticoes: "4x12" },
    { nome: "Malabarismo com a bola", repeticoes: "3x O máximo que conseguir" },
  ],
  "Treino Teste de Resistência": [
    { nome: "Prancha Isométrica", repeticoes: "2x2min" },
    { nome: "Teste de Resistência de 40 metros", repeticoes: "3x8" },
  ],
};

async function main() {
    for (const [treinoNome, itens] of Object.entries(plano)) {
        const tp = await prisma.treinoProgramado.findUnique({ where: { nome: treinoNome } });
        if (!tp) {
            console.warn(`[skip] treino não encontrado: ${treinoNome}`);
            continue;
        }

        const exins: ExIn[] = itens.map((it) => ({
            codigo: crypto.randomUUID(),            
            nome: it.nome,
            nivel: "Base",
            categorias: [],                               
            repeticoes: it.repeticoes,
        }));

        await addExerciciosAoTreino(tp.id, exins);
        console.log(`[ok] vínculos (re)criados para: ${treinoNome}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
