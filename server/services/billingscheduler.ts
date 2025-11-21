// server/services/billingScheduler.ts
import { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { sendEmailVerification } from "../utils/mailer.js";

const prisma = new PrismaClient();

// quantos dias antes avisar
const DIAS_AVISO = 3;

export async function processarRenovacoesDiarias() {
  const hoje = new Date();
  const limiteAviso = addDays(hoje, DIAS_AVISO);

  // 1) Assinaturas ativas que vão renovar nos próximos X dias e ainda não receberam lembrete
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
      // manda e-mail / notificação
      await sendEmailVerification({
        to: ass.usuario.email,
        subject: "Sua assinatura FootEra está perto de renovar",
        text: `Olá, ${ass.usuario.nome || ass.usuario.nomeDeUsuario},
Sua assinatura do plano ${ass.plano} renova em ${ass.renovaEm.toLocaleDateString(
          "pt-BR"
        )}.
Acesse o app para revisar seu plano ou cancelar se desejar.`,
      } as any); // cast para evitar erro de tipo

      await prisma.assinatura.update({
        where: { id: ass.id },
        data: { lembreteEnviado: true },
      });
    } catch (e) {
      console.error("Falha ao enviar e-mail de renovação:", e);
    }
  }

  // 2) Assinaturas vencidas (renovaEm < hoje) ainda ativas
  const vencidas = await prisma.assinatura.findMany({
    where: {
      ativo: true,
      renovaEm: { lt: hoje },
    },
    include: { usuario: true },
  });

  for (const ass of vencidas) {
    // aqui você decide a regra:
    // - pode marcar como inativa direto
    // - ou aguardar pagamento vindo do gateway e só "pendurar" status
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
      } as any); // cast para evitar erro de tipo
    } catch (e) {
      console.error("Falha ao informar expiração:", e);
    }
  }
}