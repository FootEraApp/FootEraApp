import { useContext } from "react";
import { UserContext } from "@/context/UserContext";

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


export function useAuth(): AuthContext {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um UserProvider");
  }

  return context;
}
