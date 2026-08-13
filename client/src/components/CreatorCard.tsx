import { Star, Users, BadgeCheck, Crown } from "lucide-react";
import CoverImage from "./shared/CoverImage";

type CreatorCardProps = {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  origem?: "LEARNING" | "PREMIUM" | string;
  preco?: number | null;
  mediaAvaliacao?: number | null;
  totalReviews?: number | null;
  totalAssinantes?: number | null;
  geraCertificado?: boolean;
  onClick?: () => void;
};

const formatMoney = (value?: number | null) => {
  if (!value) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function CreatorCard({
  titulo,
  descricao,
  capaUrl,
  origem,
  preco,
  mediaAvaliacao,
  totalReviews,
  totalAssinantes,
  geraCertificado,
  onClick,
}: CreatorCardProps) {
  const premium = origem === "PREMIUM";

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full
        text-left
        rounded-2xl
        border border-emerald-100
        bg-white
        shadow-sm
        overflow-hidden
        hover:shadow-md
        transition

        md:h-full
        md:flex
        md:flex-col
        md:items-stretch
        md:justify-start
      "
    >
      <div className="h-32 bg-emerald-50 shrink-0">
        <CoverImage
          src={capaUrl}
          alt={titulo}
          pasta="metodologias"
          className="h-full w-full"
        />
      </div>

      <div className="p-4 md:flex-1">
        <div className="flex flex-wrap gap-2 mb-2">
          <span
            className={
              premium
                ? "text-[10px] font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700"
                : "text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700"
            }
          >
            {premium ? "PREMIUM" : "INCLUÍDO NO LEARNING"}
          </span>

          {geraCertificado && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1">
              <BadgeCheck size={12} />
              CERTIFICADO
            </span>
          )}
        </div>

        <h3 className="font-bold text-slate-900 leading-tight">{titulo}</h3>

        {descricao && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{descricao}</p>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Star size={13} className="text-amber-500" />
            {mediaAvaliacao ? mediaAvaliacao.toFixed(1) : "0.0"}
            {totalReviews ? ` (${totalReviews})` : ""}
          </span>

          <span className="inline-flex items-center gap-1">
            <Users size={13} />
            {totalAssinantes ?? 0}
          </span>
        </div>

        {premium && (
          <div className="mt-3 flex items-center gap-1 text-purple-700 font-bold text-sm">
            <Crown size={15} />
            {formatMoney(preco) ?? "Premium"}
          </div>
        )}
      </div>
    </button>
  );
}