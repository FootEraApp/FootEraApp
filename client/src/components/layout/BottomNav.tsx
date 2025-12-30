import React from "react";
import { Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House, Eye } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";

type ActiveKey = "feed" | "explorar" | "post" | "treinos" | "perfil" | "olheiros";

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

  // 🔽 DIMINUÍDO
  const baseItem =
    "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors";
  const activeItem = "bg-white/15";

  const iconClass = "w-5 h-5";

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md ${className}`}
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
