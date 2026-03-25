// client/src/components/learning/LearningHeader.tsx
import React from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  createHref?: string;
  createLabel?: string;
};

export default function LearningHeader({
  title,
  subtitle,
  backHref = "/learning",
  createHref,
  createLabel = "Criar",
}: Props) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Link
        href={backHref}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-700"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>

      <div className="flex-1">
        <div className="text-[30px] font-extrabold text-[#193b2e]">{title}</div>
        {subtitle ? <div className="text-sm text-slate-500">{subtitle}</div> : null}
      </div>

      {createHref ? (
        <Link
          href={createHref}
          className="hidden sm:inline-flex h-11 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {createLabel}
        </Link>
      ) : null}
    </div>
  );
}