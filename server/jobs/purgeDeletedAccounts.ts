export async function purgeDeletedAccounts(): Promise<number> {
  console.warn(
    "[purgeDeletedAccounts] Purga física desabilitada. " +
    "Aguardando conclusão da auditoria de integridade."
  );

  return 0;
}
