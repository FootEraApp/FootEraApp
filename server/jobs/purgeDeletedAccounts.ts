
/**
 * Purga física temporariamente desabilitada.
 *
 * Não remover este bloqueio até concluir:
 * - Auditoria de relacionamentos Prisma
 * - Preservação de dados financeiros
 * - Preservação de organizações transferidas
 * - Proteção de dados e vínculos de menores
 * - Política de retenção e anonimização
 */
export async function purgeDeletedAccounts(): Promise<number> {
  console.warn(
    "[purgeDeletedAccounts] Purga física desabilitada. " +
    "Aguardando conclusão da auditoria de integridade."
  );

  return 0;
}
