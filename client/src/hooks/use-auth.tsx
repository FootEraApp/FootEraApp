import { useContext } from "react";
import { UserContext } from "../context/UserContext.js";

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

  const safeSetUser = context?.setUser ?? (() => {});
  const safeSetIsLoading = context?.setIsLoading ?? (() => {});

  async function login(nomeDeUsuario: string, senha: string) {
    safeSetIsLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeDeUsuario, senha }),
      });

      if (!response.ok) {
        throw new Error("Usuário ou senha inválidos");
      }

      const data = await response.json();
      safeSetUser(data.usuario);
    } finally {
      safeSetIsLoading(false);
    }
  }

  return {
    ...context,
    login,
  };
}
