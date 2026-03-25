// client/src/components/learning/LearningTypeChooser.tsx
import React from "react";
import { BookOpen, GraduationCap } from "lucide-react";
import type { LearningEstruturaTipo, LearningMetodoTipo } from "../../services/metodologias.js";

type Props = {
  onChoose: (tipo: LearningMetodoTipo, estrutura: LearningEstruturaTipo) => void;
};

export default function LearningTypeChooser({ onChoose }: Props) {
  return (
    <div className="rounded-[24px] border border-[#d8ddd7] bg-white p-5 shadow-sm">
      <div className="text-center text-[28px] font-extrabold text-[#1d3f31] mb-8 mt-2">
        Que tipo de metodologia você quer criar?
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onChoose("TRILHAS_TREINO", "TRILHA")}
          className="w-full rounded-[22px] border border-[#b9cec0] bg-[#f1f7f3] p-5 text-left shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="mt-1 text-[#2c6b48]">
              <BookOpen className="w-10 h-10" />
            </div>

            <div className="flex-1">
              <div className="text-[30px] leading-tight font-extrabold text-[#21412f]">
                Com trilhas de treino
              </div>
              <div className="mt-2 text-lg text-slate-600">
                Organize seu método em diversas trilhas de treino e evolução.
              </div>

              <div className="mt-5">
                <div className="h-14 rounded-2xl bg-[#216c43] text-white flex items-center justify-center text-xl font-bold">
                  Criar com trilhas
                </div>
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChoose("CURSO_FORMACAO", "MODULO")}
          className="w-full rounded-[22px] border border-[#d7ddd7] bg-white p-5 text-left shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="mt-1 text-[#2c6b48]">
              <GraduationCap className="w-10 h-10" />
            </div>

            <div className="flex-1">
              <div className="text-[30px] leading-tight font-extrabold text-[#21412f]">
                Com módulos de curso
              </div>
              <div className="mt-2 text-lg text-slate-600">
                Crie um curso estruturado em módulos semanais ou tópicos.
              </div>

              <div className="mt-5">
                <div className="h-14 rounded-2xl border border-slate-300 bg-white text-[#2d4135] flex items-center justify-center text-xl font-bold">
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