import { useContext } from "react";
import { UserContext } from "../context/UserContext";

interface User {
  id: number;
  name: string;
  username: string;
  age?: number;
  position?: string;
  team?: string;
  avatar?: string;
}

interface Score {
  total: number;
  performance: number;
  discipline: number;
  responsibility: number;
}

interface AuthContext {
  user: User | null;
  score: Score | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

interface AuthContextType {
  user: { id: string; [key: string]: any } | null;
  score: { total: number; performance: number; discipline: number; responsibility: number } | null;
  isLoading: boolean;
}

export function useAuth() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um UserProvider");
  }

  const { setUser, setIsLoading } = context ?? {};

  if (!setUser || !setIsLoading) {
  throw new Error("Contexto inválido: setUser ou setIsLoading não definido");
}

  async function login(username: string, senha: string) {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeDeUsuario: username, senha }),
      });

      if (!response.ok) {
        throw new Error("Usuário ou senha inválidos");
      }

      const data = await response.json();
      setUser(data.usuario); // ou conforme sua API retornar
    } finally {
      setIsLoading(false);
    }
  }

  return {
    ...context,
    login,
  };
}
