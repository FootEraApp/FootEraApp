// client/src/context/UserContext
import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import axios from "axios";
import Storage from "../utils/storage.js";
import { API } from "../config.js";
import {
  applyAuthSession,
} from "../utils/authSession.js";

export interface User {
  id: string | number;
  name: string;
  username: string;
  age?: number;
  position?: string;
  team?: string;
  avatar?: string;
}

export interface Score {
  total: number;
  performance: number;
  discipline: number;
  responsibility: number;
}

export interface UserContextType {
  user: User | null;
  score: Score | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  setUser?: React.Dispatch<
    React.SetStateAction<User | null>
  >;
  setIsLoading?: React.Dispatch<
    React.SetStateAction<boolean>
  >;
}

export const UserContext =
  createContext<UserContextType | undefined>(
    undefined
  );

function readStoredSessionUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const usuarioId =
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    "";

  if (!token || !usuarioId) {
    return null;
  }

  const username =
    localStorage.getItem("nomeUsuario") ||
    sessionStorage.getItem("nomeUsuario") ||
    "";

  return {
    id: usuarioId,
    name: username || "Usuário FootEra",
    username,
  };
}

export function UserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(
      () => readStoredSessionUser()
    );

  const [score, setScore] =
    useState<Score | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const syncSession =
    useCallback(() => {
      setUser(
        readStoredSessionUser()
      );
    }, []);

  useEffect(() => {
    syncSession();

    const onAuthChanged = () => {
      syncSession();
    };

    window.addEventListener(
      "footera:auth-changed",
      onAuthChanged
    );

    return () => {
      window.removeEventListener(
        "footera:auth-changed",
        onAuthChanged
      );
    };
  }, [syncSession]);

  const login = async (
    username: string,
    password: string
  ) => {
    setIsLoading(true);

    try {
      const resp = await axios.post(
        `${API.BASE_URL}/api/auth/login`,
        {
          nomeDeUsuario: username,
          senha: password,
        }
      );

      applyAuthSession(
        resp.data ?? {},
        {
          lembrar: false,
        }
      );

      syncSession();
    } finally {
      setIsLoading(false);
    }
  };

  const logout =
    useCallback(() => {
      Storage.clearAuth();
      setUser(null);
      setScore(null);

      if (
        typeof window !==
        "undefined"
      ) {
        window.dispatchEvent(
          new CustomEvent(
            "footera:auth-changed",
            {
              detail: {
                authenticated: false,
              },
            }
          )
        );
      }
    }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        score,
        isLoading,
        isLoggedIn: !!user,
        login,
        logout,
        setUser,
        setIsLoading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}