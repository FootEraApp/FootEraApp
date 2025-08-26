import { Usuario } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string; // ou number, dependendo do seu schema
      user?: User; // se você quiser também salvar o usuário completo
    }
  }
}
