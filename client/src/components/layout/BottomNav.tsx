import { useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Volleyball, CirclePlus, Search, House, Eye, Bell } from "lucide-react";
import Storage from "../../utils/storage.js";
import { API } from "../../config.js";
import socket from "../../services/socket.js";
import { useAuthGate } from "../../context/AuthGateContext.js";
import { UserContext } from "../../context/UserContext.js";
import ActiveContextSwitcher from "../context/ActiveContextSwitcher.js";

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
  const [, setLocation] = useLocation();
  const { requireAuth } = useAuthGate();
  const userContext = useContext(UserContext);
  const activeContext = userContext?.activeContext ?? null;
  const tipoUsuario = activeContext?.tipoUsuario ?? "";
  const isOlheiro = String(tipoUsuario).toLowerCase() === "olheiro";
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    const token = Storage.token;

    if (!token) {
      setBadgeCount(0);
      return;
    }

    let alive = true;

    const carregarBadge = async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/notificacoes/badge`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!alive || !r.ok) return;

        const data = await r.json().catch(() => null);

        if (alive && data) {
          setBadgeCount(Number(data.total ?? data.totalNotificacoes ?? 0));
        }
      } catch {
      }
    };

    void carregarBadge();

    const parseBadge = (data: any): number => {
      if (typeof data === "number") return data;
      return Number(data?.total ?? data?.totalNotificacoes ?? 0);
    };

    const onDomBadge = (event: Event) => {
      setBadgeCount(parseBadge((event as CustomEvent).detail));
    };

    const onSocketBadge = (data: any) => {
      setBadgeCount(parseBadge(data));
    };

    window.addEventListener("badge:update", onDomBadge);
    socket.on("badge:update", onSocketBadge);

    return () => {
      alive = false;
      window.removeEventListener("badge:update", onDomBadge);
      socket.off("badge:update", onSocketBadge);
    };
  }, [userContext?.isLoggedIn]);

  const baseItem =
    "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors";
  const activeItem = "bg-white/15";
  const iconClass = "w-5 h-5";

  const irPrivado = (path: string, message: string) => {
    if (requireAuth({ message, returnTo: path })) {
      setLocation(path);
    }
  };

  const abrirPerfil = () => {
    const isPersonalCreator =
      activeContext?.kind === "PERSONAL" &&
      String(tipoUsuario).toLowerCase() === "creator";
    const usuarioId = String(userContext?.user?.id ?? Storage.usuarioId ?? "").trim();
    const destino =
      isPersonalCreator && usuarioId
        ? `/creator/profile?id=${encodeURIComponent(usuarioId)}`
        : "/perfil";

    irPrivado(destino, "Entre na FootEra para acessar seu perfil.");
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocation("/feed")}
        className={`${baseItem} ${active === "feed" ? activeItem : "hover:opacity-90"}`}
        aria-label="Feed"
      >
        <House className={iconClass} />
      </button>

      <button
        type="button"
        onClick={() =>
          irPrivado("/explorar", "Entre na FootEra para acessar o Explorar.")
        }
        className={`${baseItem} ${active === "explorar" ? activeItem : "hover:opacity-90"}`}
        aria-label="Explorar"
      >
        <Search className={iconClass} />
      </button>

      {showCreate ? (
        <button
          type="button"
          onClick={() =>
            irPrivado("/post", "Entre na FootEra para criar uma publicação.")
          }
          className={`${baseItem} ${active === "post" ? activeItem : "hover:opacity-90"}`}
          aria-label="Nova postagem"
        >
          <CirclePlus className={iconClass} />
        </button>
      ) : (
        <span className="w-8 h-8" />
      )}

      <button
        type="button"
        onClick={() =>
          irPrivado("/notificacoes", "Entre na FootEra para acessar suas notificações.")
        }
        className={`${baseItem} relative ${active === "notificacoes" ? activeItem : "hover:opacity-90"}`}
        aria-label="Notificações"
      >
        <Bell className={iconClass} />

        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      {isOlheiro ? (
        <button
          type="button"
          onClick={() =>
            irPrivado("/olheiros", "Entre na FootEra para acessar a área de olheiros.")
          }
          className={`${baseItem} ${active === "olheiros" ? activeItem : "hover:opacity-90"}`}
          aria-label="Olheiros"
        >
          <Eye className={iconClass} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            irPrivado("/treinos", "Entre na FootEra para acessar seus treinos.")
          }
          className={`${baseItem} ${active === "treinos" ? activeItem : "hover:opacity-90"}`}
          aria-label="Treinos"
        >
          <Volleyball className={iconClass} />
        </button>
      )}

      <ActiveContextSwitcher
        active={active === "perfil"}
        onProfileClick={abrirPerfil}
      />
    </nav>
  );
}
