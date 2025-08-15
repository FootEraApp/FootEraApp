import { removerTreinosExpirados } from '../routes/removerTreinosExpirados.js';

let running = false;

export function startExpiredTrainingsJob(intervalMs = 15 * 60_000) {
  if ((global as any).__expiredJobStarted) return;
  (global as any).__expiredJobStarted = true;

  setInterval(async () => {
    if (running) return;         
    running = true;
    try {
      console.log('[job] Verificando treinos expirados...');
      await removerTreinosExpirados();
    } catch (e) {
      console.error('[job] erro:', e);
    } finally {
      running = false;
    }
  }, intervalMs);
}