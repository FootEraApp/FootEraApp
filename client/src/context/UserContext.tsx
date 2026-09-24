// client/src/context/UserContext
import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import axios from "axios";
import { API } from "../config.js";
import {
  applyActiveContextSession,
  applyAuthSession,
  clearAuthSession,
  type ActiveContextSession,
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

  activeContext:
    ActiveContextSession | null;

  contexts:
    ActiveContextSession[];

  contextsLoading:
    boolean;

  refreshActiveContexts:
    () => Promise<void>;

  switchActiveContext:
    (
      contextKey: string
    ) => Promise<void>;
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

  const [
    activeContext,
    setActiveContext,
  ] =
    useState<
      ActiveContextSession |
      null
    >(null);

  const [
    contexts,
    setContexts,
  ] =
    useState<
      ActiveContextSession[]
    >([]);

  const [
    contextsLoading,
    setContextsLoading,
  ] =
    useState(false);

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

  const refreshActiveContexts =
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
          setActiveContext(
            null
          );

          setContexts([]);

          setContextsLoading(
            false
          );

          return;
        }

        try {
          setContextsLoading(
            true
          );

          const {
            data,
          } =
            await axios.get(
              `${API.BASE_URL}/api/usuarios/me/contextos`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const items =
            Array.isArray(
              data?.contexts
            )
              ? data.contexts
              : [];

          const active =
            data?.activeContext ??
            null;

          setContexts(
            items
          );

          setActiveContext(
            active
          );

          if (active) {
            applyActiveContextSession(
              active,
              {
                notify:
                  false,
              }
            );
          }
        } catch (error) {
          console.error(
            "[UserContext] Erro ao carregar contextos:",
            error
          );

          setActiveContext(
            null
          );

          setContexts([]);
        } finally {
          setContextsLoading(
            false
          );
        }
      },
      []
    );
  
  const switchActiveContext =
    useCallback(
      async (
        contextKey:
          string
      ) => {
        const token =
          localStorage.getItem(
            "token"
          ) ||
          sessionStorage.getItem(
            "token"
          ) ||
          "";

        if (!token) {
          throw new Error(
            "Usuário não autenticado."
          );
        }

        const {
          data,
        } =
          await axios.patch(
            `${API.BASE_URL}/api/usuarios/me/contexto-ativo`,
            {
              contextKey,
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const active =
          data?.activeContext ??
          null;

        if (!active) {
          throw new Error(
            "O servidor não retornou o contexto ativo."
          );
        }

        setActiveContext(
          active
        );

        applyActiveContextSession(
          active,
          {
            notify:
              false,
          }
        );

        await Promise.all([
          refreshPermissions(),
          refreshActiveContexts(),
        ]);

        window.dispatchEvent(
          new CustomEvent(
            "footera:auth-changed",
            {
              detail: {
                authenticated:
                  true,

                contextChanged:
                  true,
              },
            }
          )
        );
      },
      [
        refreshPermissions,
        refreshActiveContexts,
      ]
    );

  useEffect(() => {
    syncSession();

    void Promise.all([
      refreshPermissions(),
      refreshActiveContexts(),
    ]);

    const onAuthChanged =
      () => {
        syncSession();

        void Promise.all([
          refreshPermissions(),
          refreshActiveContexts(),
        ]);
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
    refreshActiveContexts,
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
      await Promise.all([
        refreshPermissions(),
        refreshActiveContexts(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const logout =
    useCallback(() => {
      clearAuthSession();
      setActiveContext(
        null
      );

      setContexts([]);
      setContextsLoading(
        false
      );
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
        activeContext,
        contexts,
        contextsLoading,
        refreshActiveContexts,
        switchActiveContext,
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