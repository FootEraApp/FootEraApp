export function formatarUrlFoto(foto?: string): string {
  if (!foto) return "/assets/usuarios/default.jpg";
  if (foto.startsWith("http")) return foto;
  if (foto.startsWith("/assets/")) return foto;
  if (foto.length === 32 || foto.length === 36) {  // UUID ou hash padrão
    return `http://localhost:3001/uploads/${foto}.jpg`;
  }
  return `http://localhost:3001${foto}`;
}
 