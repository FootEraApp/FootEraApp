// client/src/components/MaintenanceScreen
import { Dumbbell, Flame, Timer, ChevronRight, Home, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  title?: string;
  subtitle?: string;
  hint?: string;
  onRetry?: () => void;
};

export default function MaintenanceScreen({
  title = "Vai se aquecendo!",
  subtitle = "Enquanto isso, estamos ajustando tudo por aqui. Aproveite para conhecer nossa Home e dar uma olhada na aba de novidades para ver o que está por vir. ⚽🔥",
  hint = "Confira as novidades enquanto finalizamos os ajustes.",
  onRetry,
}: Props) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border p-6 md:p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative">
            <div className="absolute -inset-6 rounded-full bg-green-100 blur-2xl opacity-70" />
            <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-green-900 text-white shadow">
              <Dumbbell className="w-10 h-10 animate-bounce" />
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-700 animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-700 animate-pulse [animation-delay:150ms]" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-700 animate-pulse [animation-delay:300ms]" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-green-900">
              {title}
            </h1>
            <p className="mt-2 text-sm md:text-base text-gray-600">
              {subtitle}
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-gray-50 p-3 flex items-center gap-2">
              <Flame className="w-5 h-5 text-green-800 shrink-0" />
              <div className="text-xs text-gray-700">
                Aquecendo o sistema…
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 p-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-800 shrink-0" />
              <div className="text-xs text-gray-700">
                {hint}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/?tab=novidades")}
              className="rounded-xl border bg-gray-50 p-3 flex items-center gap-2 text-left hover:bg-green-50 transition active:scale-[0.99]"
            >
              <ChevronRight className="w-5 h-5 text-green-800 shrink-0" />
              <div className="text-xs text-gray-700">
                Veja o que está por vir
              </div>
            </button>
          </div>

          <div className="mt-2 flex w-full flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onRetry ?? (() => window.location.reload())}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-green-900 text-white hover:bg-green-800 transition active:scale-[0.99]"
            >
              Tentar novamente
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-green-900 text-green-900 hover:bg-green-50 transition active:scale-[0.99] inline-flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Ir para início
            </button>
          </div>


          <div className="text-xs text-gray-400">
            FootEra • manutenção programada
          </div>
        </div>
      </div>
    </div>
  );
}