import React, { useState, useEffect, useMemo, useRef } from "react";
import { publicImgUrl } from "@/utils/publicUrl.js";
import { API } from "@/config.js";

const SHIELD_W_DESK = 150;
const SHIELD_H_DESK = 210;
const SHIELD_PATH =
  "M92 6 C120 6 146 10 168 18 C168 22 168 26 174 30 C178 33 182 34 184 34 L184 188 C184 197 139 204 115 212 C98 218 88 228 92 254 C86 240 74 233 48 224 C21 215 0 209 0 196 L0 34 C2 34 6 33 10 30 C16 26 16 22 16 18 C38 10 64 6 92 6 Z";

export type CardAtletaShieldProps = {
  atleta: {
    id?: string;
    atletaId?: string | null;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
    idade?: number | null;
  };
  ovr?: number;
  perf?: number;
  disc?: number;
  resp?: number;
  size?: { w: number; h: number };
  goldenMinOVR?: number;
};

const GOLDEN_MIN_OVR = 0;
const isGolden = (ovr?: number, min = GOLDEN_MIN_OVR) =>
  (Number.isFinite(ovr) ? Number(ovr) : 0) >= min;

const CardAtletaShield: React.FC<CardAtletaShieldProps> = ({
  atleta,
  ovr,
  perf,
  disc,
  resp,
  size,
  goldenMinOVR,
}) => {
  const W = size?.w ?? SHIELD_W_DESK;
  const H = size?.h ?? SHIELD_H_DESK;
  
  const clipId = `shieldClip-${atleta.atletaId || atleta.id || atleta.nome || "x"}`;
  const fotoUrl = useMemo(
   () => publicImgUrl(atleta.foto) || `${API.BASE_URL}/assets/default-user.png`,
   [atleta.foto]
  );
  const [imgOk, setImgOk] = useState(true);
  const fotoResolved = imgOk ? fotoUrl : `${API.BASE_URL}/assets/default-user.png`;
  const imgRef = useRef<SVGImageElement | null>(null);

  useEffect(() => {
    try {
      imgRef.current?.setAttribute("referrerpolicy", "no-referrer");
    } catch {}
  }, []);

  const ovrShow = Number.isFinite(ovr) ? Math.round(Number(ovr)) : 0;
  const perfShow = Number.isFinite(perf) ? Math.round(Number(perf)) : 0;
  const discShow = Number.isFinite(disc) ? Math.round(Number(disc)) : 0;
  const respShow = Number.isFinite(resp) ? Math.round(Number(resp)) : 0;
  const golden = isGolden(ovrShow, goldenMinOVR ?? GOLDEN_MIN_OVR);

  // --- estado para rotação com arrasto ---
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastPos.x;
    const deltaY = e.clientY - lastPos.y;
    setRotation((prev) => ({
      x: prev.x - deltaY / 5,
      y: prev.y + deltaX / 5,
    }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setRotation({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, lastPos]);

  // Touch (mobile) + travar scroll enquanto arrasta
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging) e.preventDefault();
    };
    document.addEventListener("touchmove", handleGlobalTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchmove", handleGlobalTouchMove);
    };
  }, [isDragging]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setLastPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastPos.x;
    const deltaY = touch.clientY - lastPos.y;
    setRotation(prev => ({ x: prev.x - deltaY / 5, y: prev.y + deltaX / 5 }));
    setLastPos({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setRotation({ x: 0, y: 0 });
  };

  const isCrossOrigin =
    typeof window !== "undefined" &&
    !!fotoResolved &&
    new URL(fotoResolved, window.location.href).origin !== window.location.origin;

  return (
    <div
      className={`cursor-grab select-none ${!isDragging ? "transition-transform duration-500 ease-out" : ""}`}
      style={{
        touchAction: "none",              
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        width: W,
        height: H,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg width="100%" height="100%" viewBox="0 0 184 260" className="block">
        <defs>
          <clipPath id={clipId}><path d={SHIELD_PATH} /></clipPath>
          <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(5,10,30,0.12)" />
            <stop offset="55%" stopColor="rgba(5,10,30,0.40)" />
            <stop offset="100%" stopColor="rgba(5,10,30,0.7)" />
          </linearGradient>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3c969" />
            <stop offset="100%" stopColor="#9fc5ff" />
          </linearGradient>
          <linearGradient id="goldOverlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#daa520" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#daa520" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#daa520" stopOpacity="0.10" />
          </linearGradient>
          <linearGradient id="goldShimmer" gradientUnits="userSpaceOnUse" x1="-184" y1="0" x2="0" y2="0">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%"  stopColor="#fff8dc" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            <animate attributeName="x1" values="-184; 184" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0; 368"  dur="2.4s" repeatCount="indefinite" />
          </linearGradient>
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <image
            ref={imgRef}
            href={fotoResolved}
            onError={() => setImgOk(false)}
            x="0"
            y="-10"
            width="184"
            height="280"
            preserveAspectRatio="xMidYMid slice"
          />
          <rect x="0" y="0" width="184" height="260" fill="url(#cardGrad)" />
          {golden && (
            <>
              <rect x="0" y="0" width="184" height="260" fill="url(#goldOverlay)" />
              <rect x="0" y="0" width="184" height="260" fill="url(#goldShimmer)" opacity="0.35" pointerEvents="none" />
            </>
          )}
        </g>

        {golden && <path d={SHIELD_PATH} fill="none" stroke="#daa520" strokeWidth="3.5" filter="url(#goldGlow)" />}
        <path d={SHIELD_PATH} fill="none" stroke="url(#gold)" strokeWidth="3" />
        <path d={SHIELD_PATH} fill="none" stroke="#13244b" strokeWidth="1" />

        <text x="18" y="50" fontSize="28" fontWeight={800} fill="#F7D87C" style={{ textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>{ovrShow}</text>
        <text x={184 - 18} y="50" textAnchor="end" fontSize="14" fontWeight={700} fill="#d8e6ff">{atleta.posicao ?? ""}</text>

        <g>
          <rect x={24} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
          <text x={34} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">P</text>
          <text x={62} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{perfShow}</text>

          <rect x={70} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
          <text x={80} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">D</text>
          <text x={108} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{discShow}</text>

          <rect x={116} y={160} rx="8" ry="8" width="44" height="28" fill="rgba(10,18,40,0.55)" stroke="#d7b46a" strokeWidth="0.6" />
          <text x={126} y={178} fontSize="12" fontWeight={800} fill="#F7D87C">R</text>
          <text x={154} y={178} textAnchor="end" fontSize="12" fontWeight={700} fill="#ffffff">{respShow}</text>
        </g>

        <text x={92} y={204} textAnchor="middle" fontSize="13" fontWeight={700} fill="#ffffff">
          {atleta.nome?.toUpperCase()}
        </text>
        <line x1={68} x2={116} y1={224} y2={224} stroke="#d7b46a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export default CardAtletaShield;
