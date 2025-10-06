export function canOpenDM(sender: any, target: any) {
  if (target?.configuracoesPrivacidade?.dms === "closed") return false;
  if (target?.configuracoesPrivacidade?.dms === "verified_only") {
    return !!(sender?.verificado || ["Professor","Clube","Olheiro"].includes(String(sender?.tipo)));
  }
  return true;
}