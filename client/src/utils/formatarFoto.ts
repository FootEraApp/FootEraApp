export function formatarUrlFoto(foto?: string): string {
  if (!foto) return "/assets/usuarios/default.jpg"; 
  if (foto.startsWith("http")) return foto;
  if (foto.startsWith("/assets/")) return foto;
  
  return `http://localhost:3001${foto}`; 
}
