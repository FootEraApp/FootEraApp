// client/src/components/learning/LearningCard.tsx
import React from "react";
import { Link } from "wouter";
import { API, APP } from "../../config.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function normalizeMediaUrl(raw?: string | null) {
  if (!raw) return AVATAR_FALLBACK;

  const u = String(raw).trim();
  if (!u) return AVATAR_FALLBACK;

  // URL absoluta
  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // uploads servidos pelo backend
  if (u.startsWith("/uploads/")) return `${API.BASE_URL}${u}`;
  if (u.startsWith("uploads/")) return `${API.BASE_URL}/${u}`;

  // assets do frontend
  if (u.startsWith("/assets/")) return `${APP.FRONTEND_BASE_URL}${u}`;
  if (u.startsWith("assets/")) return `${APP.FRONTEND_BASE_URL}/${u}`;

  // outros caminhos absolutos do frontend
  if (u.startsWith("/")) return `${APP.FRONTEND_BASE_URL}${u}`;

  return u;
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const half = Math.round(v * 2) / 2;
  const full = Math.floor(half);
  const hasHalf = half - full === 0.5;

  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;

        if (idx <= full) {
          return (
            <svg key={i} viewBox="0 0 20 20" className="w-4 h-4 text-amber-500 fill-amber-500">
              <path d="M10 1.5l2.47 5 5.52.8-4 3.9.95 5.5L10 14.1 5.06 16.7 6 11.2l-4-3.9 5.53-.8L10 1.5z" />
            </svg>
          );
        }

        if (idx === full + 1 && hasHalf) {
          return (
            <span key={i} className="relative inline-block w-4 h-4">
              <svg viewBox="0 0 20 20" className="absolute inset-0 w-4 h-4 text-gray-300 fill-gray-300">
                <path d="M10 1.5l2.47 5 5.52.8-4 3.9.95 5.5L10 14.1 5.06 16.7 6 11.2l-4-3.9 5.53-.8L10 1.5z" />
              </svg>
              <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <svg viewBox="0 0 20 20" className="w-4 h-4 text-amber-500 fill-amber-500">
                  <path d="M10 1.5l2.47 5 5.52.8-4 3.9.95 5.5L10 14.1 5.06 16.7 6 11.2l-4-3.9 5.53-.8L10 1.5z" />
                </svg>
              </span>
            </span>
          );
        }

        return (
          <svg key={i} viewBox="0 0 20 20" className="w-4 h-4 text-gray-300 fill-gray-300">
            <path d="M10 1.5l2.47 5 5.52.8-4 3.9.95 5.5L10 14.1 5.06 16.7 6 11.2l-4-3.9 5.53-.8L10 1.5z" />
          </svg>
        );
      })}
    </div>
  );
}

function getCreatorName(item: any) {
  const criador =
    item?.criadorUsuario ||
    item?.criador ||
    item?.autor ||
    item?.usuarioCriador ||
    item?.owner ||
    null;

  const nome =
    criador?.nome ||
    criador?.nomeDeUsuario ||
    criador?.email ||
    item?.criadorNome ||
    item?.criadorNomeDeUsuario ||
    item?.criadorEmail ||
    null;

  if (nome) return String(nome);

  if (item?.criadorUsuarioId) {
    return `Usuário ${item.criadorUsuarioId}`;
  }

  return "";
}

function getCreatorType(item: any) {
  const tipo =
    item?.criadorUsuario?.tipo ||
    item?.criador?.tipo ||
    item?.autor?.tipo ||
    item?.criadorTipo ||
    "";

  return tipo ? String(tipo) : "";
}

type Props = {
  item: any;
  href: string;
  actionLabel?: string;
  extraActions?: React.ReactNode;
};

export default function LearningCard({
  item,
  href,
  actionLabel,
  extraActions,
}: Props) {
  const capa = normalizeMediaUrl(item?.capaUrl || item?.logoUrl);
  const statusAssinatura = String(item?.status || "").toUpperCase();
  const concluida =
    statusAssinatura === "CONCLUIDA" || !!item?.concluiuEm;
  const rating = Number(item?.mediaAvaliacao ?? 0);
  const reviews = Number(item?.totalReviews ?? 0);
  const assinaturas = Number(item?._count?.assinantes ?? item?.totalAssinantes ?? 0);
  const creatorName = getCreatorName(item);
  const creatorType = getCreatorType(item);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        <div className="w-full overflow-hidden rounded-2xl border bg-slate-100">
          <img
            src={capa}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = AVATAR_FALLBACK;
            }}
            alt={item?.titulo || "Metodologia"}
            className="w-full aspect-[16/9] object-cover bg-white"
          />
        </div>

        <div className="min-w-0">
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

            {item?.geraCertificado ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-blue-50 text-blue-800">
                Certificado
              </span>
            ) : null}

            {item?.geraBadge ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-purple-50 text-purple-800">
                Badge
              </span>
            ) : null}

            {concluida ? (
              <span className="px-2 py-1 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-800">
                Concluída
              </span>
            ) : null}
          </div>

          <div className="mt-2 text-lg font-extrabold text-[#193b2e] line-clamp-1">
            {item?.titulo || "Metodologia"}
          </div>

          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <Stars value={rating} />
            <span className="font-semibold text-slate-800">{rating.toFixed(1)}</span>
            <span>({reviews})</span>
            <span className="text-slate-400">•</span>
            <span><b>{assinaturas}</b> assinaturas</span>
          </div>

          {item?.descricao ? (
            <div className="mt-1 text-sm text-slate-600 line-clamp-2">
              {item.descricao}
            </div>
          ) : null}

          {creatorName ? (
            <div className="mt-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Criador:</span>{" "}
              {creatorName}
              {creatorType ? (
                <span className="text-slate-400"> • {creatorType}</span>
              ) : null}
            </div>
          ) : null}

          {item?.origemRegistro === "AVULSA" && item?.precoAssinaturaMensal != null ? (
            <div className="mt-2 text-sm font-semibold text-orange-700">
              Assinatura mensal: R$ {Number(item.precoAssinaturaMensal).toFixed(2)}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.estruturaCount ?? item?._count?.estruturas ?? 0}{" "}
              {item?.estruturaTipo === "MODULO" ? "módulos" : "trilhas"}
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {(Number(item?.videoCount ?? 0) + Number(item?.aulaCount ?? 0))} vídeos/aulas
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.treinoCount ?? 0} treinos
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.materialCount ?? 0} materiais
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.desafioCount ?? 0} desafios
            </span>

            <span className="px-2 py-1 rounded-full border bg-slate-50">
              {item?.aulaAoVivoCount ?? item?.aulasAoVivoCount ?? 0} aulas ao vivo
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {actionLabel ? (
              <Link
                href={href}
                className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
              >
                {actionLabel}
              </Link>
            ) : null}
            {extraActions}
          </div>
        </div>
      </div>
    </div>
  );
}