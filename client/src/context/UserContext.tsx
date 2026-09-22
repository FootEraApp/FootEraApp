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

export type AppPermission =
  | "CRIAR_TREINO"
  | "GERENCIAR_TURMA"
  | "GERENCIAR_ORGANIZACAO"
  | "CRIAR_EVENTO"
  | "PUBLICAR_METODOLOGIA"
  | "VER_ADMIN";

export type PermissionMap =
  Record<AppPermission, boolean>;

const EMPTY_PERMISSIONS: PermissionMap = {
  CRIAR_TREINO: false,
  GERENCIAR_TURMA: false,
  GERENCIAR_ORGANIZACAO: false,
  CRIAR_EVENTO: false,
  PUBLICAR_METODOLOGIA: false,
  VER_ADMIN: false,
};

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
  permissions: PermissionMap;

  permissionsLoading: boolean;

  can: (
    permission: AppPermission
  ) => boolean;

  refreshPermissions:
    () => Promise<void>;
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

  const [
    permissions,
    setPermissions,
  ] = useState<PermissionMap>({
    ...EMPTY_PERMISSIONS,
  });

  const [
    permissionsLoading,
    setPermissionsLoading,
  ] = useState(false);


  const refreshPermissions =
    useCallback(
      async () => {
        const token =
          localStorage.getItem(
            "token"
          ) ||
          sessionStorage.getItem(
            "token"
          ) ||
          "";

        if (!token) {
          setPermissions({
            ...EMPTY_PERMISSIONS,
          });

          setPermissionsLoading(
            false
          );

          return;
        }

        try {
          setPermissionsLoading(
            true
          );

          const response =
            await axios.get(
              `${API.BASE_URL}/api/permissoes/me`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          setPermissions({
            ...EMPTY_PERMISSIONS,
            ...(response.data
              ?.permissions ?? {}),
          });
        } catch (error) {
          console.error(
            "[UserContext] Erro ao carregar permissões:",
            error
          );

          setPermissions({
            ...EMPTY_PERMISSIONS,
          });
        } finally {
          setPermissionsLoading(
            false
          );
        }
      },
      []
    );


  const can =
    useCallback(
      (
        permission:
          AppPermission
      ) =>
        permissions[
          permission
        ] === true,
      [permissions]
    );

  const syncSession =
    useCallback(() => {
      setUser(
        readStoredSessionUser()
      );
    }, []);

  useEffect(() => {
    syncSession();

    void refreshPermissions();

    const onAuthChanged =
      () => {
        syncSession();

        void refreshPermissions();
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
  }, [
    syncSession,
    refreshPermissions,
  ]);

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
      await refreshPermissions();
    } finally {
      setIsLoading(false);
    }
  };

  const logout =
    useCallback(() => {
      Storage.clearAuth();
      setUser(null);
      setScore(null);

      setPermissions({
        ...EMPTY_PERMISSIONS,
      });

      setPermissionsLoading(
        false
      );

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

        permissions,
        permissionsLoading,
        can,
        refreshPermissions,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}