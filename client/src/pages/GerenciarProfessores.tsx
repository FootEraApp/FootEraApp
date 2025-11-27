import React from "react";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { ChevronRight, Users, ClipboardList, GraduationCap } from "lucide-react";

export default function GerenciarProfessores() {
  const isLogged = !!Storage.token;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-green-900">
            Gerenciar Professores
          </h1>
          <p className="text-sm text-green-900/70">
            Central para organizar professores, turmas e relação com atletas do clube.
          </p>
        </div>

        <Link
          href="/perfil"
          className="text-xs inline-flex items-center gap-1 text-green-800 hover:underline"
        >
          Voltar ao perfil do clube
          <ChevronRight className="w-3 h-3" />
        </Link>
      </header>

      {!isLogged && (
        <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          Faça login para acessar as funções de gerenciamento.
        </div>
      )}

      <div className="grid gap-4">
        <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-green-100">
              <Users className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h2 className="font-semibold text-green-900 text-sm">
                Professores vinculados ao clube
              </h2>
              <p className="text-xs text-green-900/70">
                Aqui você verá a lista de professores vinculados ao clube, com
                possibilidade de adicionar, remover e editar dados.
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/40 px-3 py-4 text-center text-xs text-green-900/70">
            Placeholder • Em breve: tabela com professores, filtros, busca e ações
            de edição/vínculo.
          </div>
        </section>

        <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-green-100">
              <GraduationCap className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h2 className="font-semibold text-green-900 text-sm">
                Turmas por professor
              </h2>
              <p className="text-xs text-green-900/70">
                Visualize quais turmas cada professor lidera e faça ajustes rápidos.
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/40 px-3 py-4 text-center text-xs text-green-900/70">
            Placeholder • Em breve: visão de turmas por professor e ações para
            trocar responsável, criar turma e distribuir atletas.
          </div>
        </section>

        <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-green-100">
              <ClipboardList className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h2 className="font-semibold text-green-900 text-sm">
                Atletas por professor / turmas
              </h2>
              <p className="text-xs text-green-900/70">
                No futuro, esta área permitirá associar atletas a professores e
                organizar elencos e grupos por categoria.
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/40 px-3 py-4 text-center text-xs text-green-900/70">
            Placeholder • Em breve: grade de atletas por turma/professor, com
            arrastar e soltar, filtros e resumo de carga de treino.
          </div>
        </section>
      </div>
    </div>
  );
}
