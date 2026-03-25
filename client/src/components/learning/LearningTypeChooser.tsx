// client/src/components/learning/LearningTypeChooser.tsx
import { BookOpen, GraduationCap } from "lucide-react";
import type {
  LearningEstruturaTipo,
  LearningMetodoTipo,
} from "../../services/metodologias.js";

type Props = {
  onChoose: (
    tipo: LearningMetodoTipo,
    estrutura: LearningEstruturaTipo
  ) => void;
};

export default function LearningTypeChooser({ onChoose }: Props) {
  return (
    <div className="rounded-[20px] border border-[#d8ddd7] bg-white p-4 shadow-sm">
      <div className="text-center text-[22px] sm:text-[24px] font-extrabold text-[#1d3f31] mb-6 mt-1 leading-tight">
        Que tipo de metodologia você quer criar?
      </div>

      <div className="space-y-3">
        {/* TRILHAS */}
        <button
          type="button"
          onClick={() => onChoose("TRILHAS_TREINO", "TRILHA")}
          className="w-full rounded-[18px] border border-[#b9cec0] bg-[#f1f7f3] p-4 text-left shadow-sm hover:shadow-md transition"
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 text-[#2c6b48]">
              <BookOpen className="w-8 h-8" />
            </div>

            <div className="flex-1">
              <div className="text-[20px] sm:text-[22px] leading-tight font-extrabold text-[#21412f]">
                Com trilhas de treino
              </div>

              <div className="mt-1 text-[14px] sm:text-[15px] text-slate-600 leading-snug">
                Organize seu método em diversas trilhas de treino e evolução.
              </div>

              <div className="mt-4">
                <div className="h-11 rounded-xl bg-[#216c43] text-white flex items-center justify-center text-base sm:text-lg font-bold">
                  Criar com trilhas
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* MODULOS */}
        <button
          type="button"
          onClick={() => onChoose("CURSO_FORMACAO", "MODULO")}
          className="w-full rounded-[18px] border border-[#d7ddd7] bg-white p-4 text-left shadow-sm hover:shadow-md transition"
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 text-[#2c6b48]">
              <GraduationCap className="w-8 h-8" />
            </div>

            <div className="flex-1">
              <div className="text-[20px] sm:text-[22px] leading-tight font-extrabold text-[#21412f]">
                Com módulos de curso
              </div>

              <div className="mt-1 text-[14px] sm:text-[15px] text-slate-600 leading-snug">
                Crie um curso estruturado em módulos semanais ou tópicos.
              </div>

              <div className="mt-4">
                <div className="h-11 rounded-xl border border-slate-300 bg-white text-[#2d4135] flex items-center justify-center text-base sm:text-lg font-bold">
                  Criar com módulos
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}