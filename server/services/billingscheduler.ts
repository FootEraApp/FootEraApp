import { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { sendEmailVerification } from "../utils/mailer.js";

const prisma = new PrismaClient();

const DIAS_AVISO = 3;

export async function processarRenovacoesDiarias() {
  const hoje = new Date();
  const limiteAviso = addDays(hoje, DIAS_AVISO);

  const quaseVencendo = await prisma.assinatura.findMany({
    where: {
      ativo: true,
      renovaEm: {
        gte: hoje,
        lte: limiteAviso,
      },
      lembreteEnviado: false,
    },
    include: { usuario: true },
  });

  for (const ass of quaseVencendo) {
    try {
      await sendEmailVerification({
        to: ass.usuario.email,
        subject: "Sua assinatura FootEra está perto de renovar",
        text: `Olá, ${ass.usuario.nome || ass.usuario.nomeDeUsuario},
Sua assinatura do plano ${ass.plano} renova em ${ass.renovaEm.toLocaleDateString(
          "pt-BR"
        )}.
Acesse o app para revisar seu plano ou cancelar se desejar.`,
      } as any); 

      await prisma.assinatura.update({
        where: { id: ass.id },
        data: { lembreteEnviado: true },
      });
    } catch (e) {
      console.error("Falha ao enviar e-mail de renovação:", e);
    }
  }

  const vencidas = await prisma.assinatura.findMany({
    where: {
      ativo: true,
      renovaEm: { lt: hoje },
    },
    include: { usuario: true },
  });

  for (const ass of vencidas) {
    await prisma.assinatura.update({
      where: { id: ass.id },
      data: {
        ativo: false,
        canceledAt: new Date(),
      },
    });

    try {
      await sendEmailVerification({
        to: ass.usuario.email,
        subject: "Sua assinatura FootEra expirou",
        text: `Olá, ${ass.usuario.nome || ass.usuario.nomeDeUsuario},
Sua assinatura do plano ${ass.plano} expirou em ${ass.renovaEm.toLocaleDateString(
          "pt-BR"
        )}.
Você pode reativá-la a qualquer momento na área de pagamentos da plataforma.`,
      } as any);
    } catch (e) {
      console.error("Falha ao informar expiração:", e);
    }
  }
}