export function formatarUrlFoto(foto?: string | null): string {
  if (!foto) return "/placeholder.png";
  if (foto.startsWith("http")) return foto;
  return foto.startsWith("/") ? foto : `/assets/usuarios/${foto}`;
}
