import { prisma } from "../prisma.js";

let checkingMaintenance = false;

export async function activateScheduledMaintenanceIfDue() {
  if (checkingMaintenance) return 0;

  checkingMaintenance = true;

  try {
    const now = new Date();

    const result = await prisma.configuracaoSistema.updateMany({
      where: {
        maintenanceMode: false,
        maintenanceScheduledAt: {
          not: null,
          lte: now,
        },
      },
      data: {
        maintenanceMode: true,
        maintenanceScheduledAt: null,
      },
    });

    if (result.count > 0) {
      console.log(
        `[manutenção] modo de manutenção ativado automaticamente em ${now.toISOString()}`
      );
    }

    return result.count;
  } catch (error) {
    console.error(
      "[manutenção] erro ao verificar manutenção agendada:",
      error
    );

    return 0;
  } finally {
    checkingMaintenance = false;
  }
}

export function startMaintenanceScheduler() {
  void activateScheduledMaintenanceIfDue();

  const timer = setInterval(() => {
    void activateScheduledMaintenanceIfDue();
  }, 10_000);

  timer.unref?.();

  console.log("[manutenção] agendador iniciado");
}