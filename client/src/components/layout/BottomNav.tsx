import {
  useEffect,
  useState,
  useContext,
} from "react";
import {
  useLocation,
} from "wouter";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  Eye,
  Bell,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import {
  API,
} from "../../config.js";
import socket from "../../services/socket.js";
import {
  useAuthGate,
} from "../../context/AuthGateContext.js";
import {
  UserContext,
} from "../../context/UserContext.js";

type ActiveKey =
  | "feed"
  | "explorar"
  | "post"
  | "treinos"
  | "perfil"
  | "olheiros"
  | "notificacoes";

export default function BottomNav({
  active,
  className = "",
  showCreate = true,
}: {
  active?: ActiveKey;
  className?: string;
  showCreate?: boolean;
}) {
  const [, setLocation] =
    useLocation();

  const {
    requireAuth,
  } = useAuthGate();

  const userContext =
    useContext(
      UserContext
    );

  const activeContext =
    userContext
      ?.activeContext ??
    null;

  const contexts =
    userContext
      ?.contexts ??
    [];

  const contextsLoading =
    userContext
      ?.contextsLoading ??
    false;

  const switchActiveContext =
    userContext
      ?.switchActiveContext;

  const [
    switchingContext,
    setSwitchingContext,
  ] =
    useState(false);

  const [
    authVersion,
    setAuthVersion,
  ] = useState(0);

  useEffect(() => {
    const onAuthChanged = () => {
      setAuthVersion(
        (v) => v + 1
      );
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
  }, []);

  const tipoUsuario =
    activeContext
      ?.tipoUsuario ??
    (Storage as any)
      .tipoUsuario ??
    localStorage.getItem(
      "tipoUsuario"
    ) ??
    sessionStorage.getItem(
      "tipoUsuario"
    ) ??
    "";

  const isOlheiro =
    String(tipoUsuario)
      .toLowerCase() ===
    "olheiro";

  const [
    badgeCount,
    setBadgeCount,
  ] = useState(0);

  useEffect(() => {
    const token =
      Storage.token;

    /*
     * Visitante não possui badge.
     * Depois de login pelo Auth Gate,
     * authVersion muda e este effect
     * roda novamente com o novo token.
     */
    if (!token) {
      setBadgeCount(0);
      return;
    }

    let alive = true;

    const carregarBadge =
      async () => {
        try {
          const r =
            await fetch(
              `${API.BASE_URL}/api/notificacoes/badge`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (
            !alive ||
            !r.ok
          ) {
            return;
          }

          const data =
            await r
              .json()
              .catch(
                () => null
              );

          if (
            alive &&
            data
          ) {
            setBadgeCount(
              Number(
                data.total ??
                  data.totalNotificacoes ??
                  0
              )
            );
          }
        } catch {
          // Badge não deve quebrar navegação.
        }
      };

    void carregarBadge();

    const parseBadge = (
      d: any
    ): number => {
      if (
        typeof d ===
        "number"
      ) {
        return d;
      }

      return Number(
        d?.total ??
          d?.totalNotificacoes ??
          0
      );
    };

    const onDomBadge = (
      e: Event
    ) => {
      setBadgeCount(
        parseBadge(
          (
            e as CustomEvent
          ).detail
        )
      );
    };

    const onSocketBadge = (
      data: any
    ) => {
      setBadgeCount(
        parseBadge(data)
      );
    };

    window.addEventListener(
      "badge:update",
      onDomBadge as EventListener
    );

    socket.on(
      "badge:update",
      onSocketBadge
    );

    return () => {
      alive = false;

      window.removeEventListener(
        "badge:update",
        onDomBadge as EventListener
      );

      socket.off(
        "badge:update",
        onSocketBadge
      );
    };
  }, [authVersion]);

  const baseItem =
    "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors";

  const activeItem =
    "bg-white/15";

  const iconClass =
    "w-5 h-5";

  const irPublico = (
    path: string
  ) => {
    setLocation(path);
  };

  const irPrivado = (
    path: string,
    message: string
  ) => {
    if (
      requireAuth({
        message,
        returnTo: path,
      })
    ) {
      setLocation(path);
    }
  };

  const mostrarSeletorContexto =
    Boolean(
      userContext
        ?.isLoggedIn
    ) &&
    contexts.length > 1;

  return (
    <>
      {mostrarSeletorContexto && (
        <div className="fixed bottom-12 left-0 right-0 z-50 border-t border-zinc-200 bg-white px-3 py-2 shadow-lg">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <span className="shrink-0 text-[11px] font-medium text-zinc-500">
              Usando FootEra como
            </span>

            <select
              value={
                activeContext
                  ?.key ?? ""
              }
              disabled={
                contextsLoading ||
                switchingContext
              }
              onChange={async (
                event
              ) => {
                const contextKey =
                  event.target
                    .value;

                if (
                  !contextKey ||
                  !switchActiveContext ||
                  contextKey ===
                    activeContext?.key
                ) {
                  return;
                }

                try {
                  setSwitchingContext(
                    true
                  );

                  await switchActiveContext(
                    contextKey
                  );

                  /*
                  * Enquanto ainda existem
                  * páginas legadas lendo
                  * Storage.tipoUsuario na
                  * montagem, ir ao Feed
                  * garante um contexto novo
                  * e limpo.
                  */
                  setLocation(
                    "/feed"
                  );
                } catch (
                  error
                ) {
                  console.error(
                    "[BottomNav] Erro ao trocar contexto:",
                    error
                  );
                } finally {
                  setSwitchingContext(
                    false
                  );
                }
              }}
              className="min-w-0 max-w-[230px] rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold text-zinc-900 outline-none"
            >
              {contexts.map(
                (contexto) => (
                  <option
                    key={
                      contexto.key
                    }
                    value={
                      contexto.key
                    }
                  >
                    {
                      contexto.label
                    }
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      )}

      <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md ${className}`}
    >
      {/* Feed é público */}
      <button
        type="button"
        onClick={() =>
          irPublico(
            "/feed"
          )
        }
        className={`${baseItem} ${
          active ===
          "feed"
            ? activeItem
            : "hover:opacity-90"
        }`}
        aria-label="Feed"
      >
        <House
          className={
            iconClass
          }
        />
      </button>

      {/* Explorar ainda é uma rota privada nesta etapa */}
      <button
        type="button"
        onClick={() =>
          irPrivado(
            "/explorar",
            "Entre na FootEra para acessar o Explorar."
          )
        }
        className={`${baseItem} ${
          active ===
          "explorar"
            ? activeItem
            : "hover:opacity-90"
        }`}
        aria-label="Explorar"
      >
        <Search
          className={
            iconClass
          }
        />
      </button>

      {showCreate ? (
        <button
          type="button"
          onClick={() =>
            irPrivado(
              "/post",
              "Entre na FootEra para criar uma publicação."
            )
          }
          className={`${baseItem} ${
            active ===
            "post"
              ? activeItem
              : "hover:opacity-90"
          }`}
          aria-label="Nova postagem"
        >
          <CirclePlus
            className={
              iconClass
            }
          />
        </button>
      ) : (
        <span className="w-8 h-8" />
      )}

      <button
        type="button"
        onClick={() =>
          irPrivado(
            "/notificacoes",
            "Entre na FootEra para acessar suas notificações."
          )
        }
        className={`${baseItem} relative ${
          active ===
          "notificacoes"
            ? activeItem
            : "hover:opacity-90"
        }`}
        aria-label="Notificações"
      >
        <Bell
          className={
            iconClass
          }
        />

        {badgeCount >
          0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {badgeCount >
            9
              ? "9+"
              : badgeCount}
          </span>
        )}
      </button>

      {isOlheiro ? (
        <button
          type="button"
          onClick={() =>
            irPrivado(
              "/olheiros",
              "Entre na FootEra para acessar a área de olheiros."
            )
          }
          className={`${baseItem} ${
            active ===
            "olheiros"
              ? activeItem
              : "hover:opacity-90"
          }`}
          aria-label="Olheiros"
        >
          <Eye
            className={
              iconClass
            }
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            irPrivado(
              "/treinos",
              "Entre na FootEra para acessar seus treinos."
            )
          }
          className={`${baseItem} ${
            active ===
            "treinos"
              ? activeItem
              : "hover:opacity-90"
          }`}
          aria-label="Treinos"
        >
          <Volleyball
            className={
              iconClass
            }
          />
        </button>
      )}

      <button
        type="button"
        onClick={() =>
          irPrivado(
            "/perfil",
            "Entre na FootEra para acessar seu perfil."
          )
        }
        className={`${baseItem} ${
          active ===
          "perfil"
            ? activeItem
            : "hover:opacity-90"
        }`}
        aria-label="Perfil"
      >
        <User
          className={
            iconClass
          }
        />
      </button>
    </nav>
    </>
  );
}