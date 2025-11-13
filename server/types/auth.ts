import { Request } from "express";

export type Plano = 'FREE' | 'PRO' | 'ORG';
export type Papel = 'atleta' | 'professor' | 'olheiro' | 'escolinha' | 'admin';

export type UserContext = {
  id: string;
  tipo: Papel;
  tipoUsuarioId?: string | null;
  plano: Plano;
  isAdmin: boolean;
};

export interface AuthenticatedRequest extends Request {
  userId?: string;
}
