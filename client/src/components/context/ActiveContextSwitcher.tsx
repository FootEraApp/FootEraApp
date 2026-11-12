// client/src/components/context/ActiveContextSwitcher
import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  User,
  Volleyball,
  GraduationCap,
  Shield,
  School,
  Eye,
  Briefcase,
  Flag,
  Video,
  Loader2,
} from "lucide-react";

import {
  UserContext,
} from "../../context/UserContext.js";

import type { CSSProperties } from "react";


function getRoleIcon(tipo: string) {
  switch (tipo.toLowerCase()) {
    case "atleta":
      return Volleyball;
    case "professor":
      return GraduationCap;
    case "clube":
      return Shield;
    case "escola":
      return School;
    case "olheiro":
      return Eye;
    case "marca":
      return Briefcase;
    case "federação":
    case "federacao":
      return Flag;
    case "creator":
      return Video;
    default:
      return User;
  }
}


export default function ActiveContextSwitcher({
  onProfileClick,
  active = false,
}: {
  onProfileClick: () => void;
  active?: boolean;
}) {
  const context = useContext(UserContext);

  const [open, setOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const openRef = useRef(false);
  const hoveredRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const changingRef = useRef(false);

  const contexts = context?.contexts ?? [];

  const canSwitch =
    Boolean(context?.isLoggedIn) &&
    !context?.contextsLoading &&
    contexts.length > 1;

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function closeMenu() {
    clearTimer();
    openRef.current = false;
    hoveredRef.current = null;
    setOpen(false);
    setHoveredKey(null);
  }

  function highlightAt(x: number, y: number) {
    let key: string | null = null;

    for (const [optionKey, element] of optionRefs.current) {
      const rect = element.getBoundingClientRect();

      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        key = optionKey;
        break;
      }
    }

    hoveredRef.current = key;
    setHoveredKey(key);
  }

  async function chooseContext(key: string) {
    if (!context || changingRef.current) return;

    closeMenu();

    if (key === context.activeContext?.key) return;

    changingRef.current = true;
    setChanging(true);
    setError("");

    try {
      await context.switchActiveContext(key);
    } catch (error) {
      console.error("Erro ao trocar contexto:", error);
      setError("Não foi possível trocar o perfil. Tente novamente.");
    } finally {
      changingRef.current = false;
      setChanging(false);
    }
  }

  useEffect(() => {
    if (!canSwitch) closeMenu();
  }, [canSwitch]);

  useEffect(() => {
    if (!open) return;

    function onOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center"
    >

<style>{`
  @keyframes footera-role-unstack {
    from {
      transform: translateY(var(--stack-offset));
    }
    to {
      transform: translateY(0);
    }
  }

  .footera-role-enter {
    animation: footera-role-unstack 650ms
      cubic-bezier(0.25, 0.1, 0.25, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .footera-role-enter {
      animation: none;
    }
  }
`}</style>

{open && canSwitch && (
  <div
    role="group"
    aria-label="Usando FootEra como"
    className="pointer-events-none absolute bottom-full -right-[6px] mb-3 flex max-h-[65dvh] w-[min(240px,calc(100vw-48px))] flex-col items-end gap-2 overflow-y-auto overflow-x-hidden bg-transparent py-1"
  >
    {contexts.map((item, index) => {
      const role = String(item.tipoUsuario ?? "");
      const roleName = role || "Perfil";
      const Icon = getRoleIcon(role);


      const selected =
        item.key === context?.activeContext?.key;

      const highlighted =
        item.key === hoveredKey;

      return (
        <button
          key={item.key}
          ref={(element) => {
            if (element) {
              optionRefs.current.set(item.key, element);
            } else {
              optionRefs.current.delete(item.key);
            }
          }}
          type="button"
          aria-label={roleName}
          aria-pressed={selected}
          onPointerEnter={() => {
            hoveredRef.current = item.key;
            setHoveredKey(item.key);
          }}
          onPointerLeave={() => {
            hoveredRef.current = null;
            setHoveredKey(null);
          }}
          onFocus={() => setHoveredKey(item.key)}
          onBlur={() => setHoveredKey(null)}
          onClick={() => void chooseContext(item.key)}
          className={`footera-role-enter pointer-events-auto relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors ${
            highlighted
              ? "bg-green-600"
              : selected
                ? "bg-green-800"
                : "bg-green-900 hover:bg-green-700"
          }`}
          style={
            {
              "--stack-offset": `${
                (contexts.length - 1 - index) * 52
              }px`,
              zIndex: index + 1,
            } as CSSProperties
          }
        >

          {highlighted && (
            <span
              className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-green-900 px-3 py-2 text-xs font-semibold text-white shadow-sm"
            >
              {roleName}
            </span>
          )}

          <Icon
            className="h-6 w-6"
            strokeWidth={highlighted || selected ? 2.5 : 2}
          />
        </button>
      );
    })}
  </div>
)}



      {error && (
        <div
          role="alert"
          className="absolute bottom-full right-0 mb-3 w-56 rounded-xl bg-white p-3 text-xs text-red-700 shadow-lg"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={changing}
        aria-label={
          canSwitch
            ? "Perfil. Segure para trocar de papel."
            : "Perfil"
        }
        aria-expanded={open}
        title="Perfil — segure para trocar de papel"
        onContextMenu={(event) => {
          if (canSwitch) event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;

          suppressClickRef.current = false;

          if (!canSwitch || changing) return;

          clearTimer();

          pointerRef.current = event.pointerId;
          startRef.current = {
            x: event.clientX,
            y: event.clientY,
          };

          event.currentTarget.setPointerCapture(event.pointerId);

          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            suppressClickRef.current = true;
            openRef.current = true;
            setError("");
            setOpen(true);
          }, 400);
        }}
        onPointerMove={(event) => {
          if (pointerRef.current !== event.pointerId) return;

          if (openRef.current) {
            highlightAt(event.clientX, event.clientY);
            return;
          }

          const distance = Math.hypot(
            event.clientX - startRef.current.x,
            event.clientY - startRef.current.y
          );

          if (distance > 12) {
            clearTimer();
            suppressClickRef.current = true;
          }
        }}
        onPointerUp={(event) => {
          if (pointerRef.current !== event.pointerId) return;

          clearTimer();
          pointerRef.current = null;

          if (openRef.current) {
            suppressClickRef.current = true;
            highlightAt(event.clientX, event.clientY);

            const key = hoveredRef.current;

            if (key) void chooseContext(key);
          }
        }}
        onPointerCancel={() => {
          pointerRef.current = null;
          suppressClickRef.current = true;
          closeMenu();
        }}
        onLostPointerCapture={() => {
          clearTimer();
          pointerRef.current = null;
        }}
        onKeyDown={(event) => {
          if (canSwitch && event.key === "ArrowUp") {
            event.preventDefault();
            openRef.current = true;
            setOpen(true);
          }
        }}
        onClick={(event) => {
          // Bloqueia o clique gerado depois do toque longo.
          // Cliques pelo teclado continuam funcionando.
          if (event.detail > 0 && suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }

          closeMenu();
          onProfileClick();
        }}
        className={`inline-flex h-8 w-8 touch-none select-none items-center justify-center rounded-md transition-colors disabled:opacity-60 ${
          active || open ? "bg-white/15" : "hover:opacity-90"
        }`}
        style={{ WebkitTouchCallout: "none" }}
      >
        {changing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <User className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}