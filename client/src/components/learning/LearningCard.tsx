// client/src/components/learning/LearningCard.tsx
import React from "react";
import { Link } from "wouter";
import { APP } from "../../config.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function normalizeMediaUrl(raw?: string | null) {
  if (!raw) return AVATAR_FALLBACK;
  const u = String(raw).trim();
  if (!u) return AVATAR_FALLBACK;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${APP.FRONTEND_BASE_URL}${u}`;
  return u;
}

type Props = {
  item: any;
  href: string;
  actionLabel: string;
  extraActions?: React.ReactNode;
};

export default function LearningCard({
  item,
  href,
  actionLabel,
  extraActions,
}: Props) {
  const capa = normalizeMediaUrl(item?.capaUrl || item?.logoUrl);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <img
          src={capa}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = AVATAR_FALLBACK;
          }}
          alt={item?.titulo || "Metodologia"}
          className="w-20 h-20 rounded-2xl border object-cover bg-white"
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item?.publicoAlvo ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-slate-50 text-slate-700">
                {item.publicoAlvo}
              </span>
            ) : null}

            {item?.tipo ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-green-50 text-green-800">
                {item.tipo === "CURSO_FORMACAO" ? "Curso" : "Trilhas"}
              </span>
            ) : null}

            {typeof item?.ativo === "boolean" ? (
              <span
                className={`px-2 py-1 rounded-full text-[11px] font-semibold border ${
                  item.ativo
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                {item.ativo ? "Publicada" : "Aguardando validação"}
              </span>
            ) : null}
          </div>

          <div className="mt-2 text-lg font-extrabold text-[#193b2e] line-clamp-1">
            {item?.titulo || "Metodologia"}
          </div>

          {item?.descricao ? (
            <div className="mt-1 text-sm text-slate-600 line-clamp-2">
              {item.descricao}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.estruturaCount ?? item?._count?.estruturas ?? 0}{" "}
              {item?.estruturaTipo === "MODULO" ? "módulos" : "trilhas"}
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.videoCount ?? 0} vídeos/aulas
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.treinoCount ?? 0} treinos
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.materialCount ?? 0} materiais
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Link
              href={href}
              className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center justify-center"
            >
              {actionLabel}
            </Link>

            {extraActions}
          </div>
        </div>
      </div>
    </div>
  );
}