import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House, Eye, Bell } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import socket from "../../services/socket.js";

type ActiveKey = "feed" | "explorar" | "post" | "treinos" | "perfil" | "olheiros" | "notificacoes";

export default function BottomNav({
  active,
  className = "",
  showCreate = true,
}: {
  active?: ActiveKey;
  className?: string;
  showCreate?: boolean;
}) {
  const tipoUsuario =
    (Storage as any).tipoUsuario ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    "";

  const isOlheiro = String(tipoUsuario).toLowerCase() === "olheiro";

  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    const token = Storage.token;
    if (!token) return;

    fetch(`${API.BASE_URL}/api/notificacoes/badge`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setBadgeCount(Number(data.total ?? data.totalNotificacoes ?? 0));
      })
      .catch(() => {});

    const parseBadge = (d: any): number => {
      if (typeof d === "number") return d;
      return Number(d?.total ?? d?.totalNotificacoes ?? 0);
    };

    const onDomBadge = (e: Event) => {
      setBadgeCount(parseBadge((e as CustomEvent).detail));
    };

    const onSocketBadge = (data: any) => {
      setBadgeCount(parseBadge(data));
    };

    window.addEventListener("badge:update", onDomBadge as EventListener);
    socket.on("badge:update", onSocketBadge);

    return () => {
      window.removeEventListener("badge:update", onDomBadge as EventListener);
      socket.off("badge:update", onSocketBadge);
    };
  }, []);

  const baseItem =
    "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors";
  const activeItem = "bg-white/15";

  const iconClass = "w-5 h-5";

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md ${className}`}
    >
      <Link
        href="/feed"
        className={`${baseItem} ${active === "feed" ? activeItem : "hover:opacity-90"}`}
        aria-label="Feed"
      >
        <House className={iconClass} />
      </Link>

      <Link
        href="/explorar"
        className={`${baseItem} ${active === "explorar" ? activeItem : "hover:opacity-90"}`}
        aria-label="Explorar"
      >
        <Search className={iconClass} />
      </Link>

      {showCreate ? (
        <Link
          href="/post"
          className={`${baseItem} ${active === "post" ? activeItem : "hover:opacity-90"}`}
          aria-label="Nova postagem"
        >
          <CirclePlus className={iconClass} />
        </Link>
      ) : (
        <span className="w-8 h-8" />
      )}

      <Link
        href="/notificacoes"
        className={`${baseItem} relative ${active === "notificacoes" ? activeItem : "hover:opacity-90"}`}
        aria-label="Notificações"
      >
        <Bell className={iconClass} />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </Link>
      
      {isOlheiro ? (
        <Link
          href="/olheiros"
          className={`${baseItem} ${active === "olheiros" ? activeItem : "hover:opacity-90"}`}
          aria-label="Olheiros"
        >
          <Eye className={iconClass} />
        </Link>
      ) : (
        <Link
          href="/treinos"
          className={`${baseItem} ${active === "treinos" ? activeItem : "hover:opacity-90"}`}
          aria-label="Treinos"
        >
          <Volleyball className={iconClass} />
        </Link>
      )}

      <Link
        href="/perfil"
        className={`${baseItem} ${active === "perfil" ? activeItem : "hover:opacity-90"}`}
        aria-label="Perfil"
      >
        <User className={iconClass} />
      </Link>

    </nav>
  );
}
