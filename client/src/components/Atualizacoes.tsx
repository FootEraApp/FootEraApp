// client/src/components/Atualizações
import React, { useState } from "react";

type UpdateType = "atualizacao" | "correcoes";

function UpdateCard({
  type,
  title,
  children,
}: {
  type: UpdateType;
  title: string;
  children: React.ReactNode;
}) {
  const isCorrecoes = type === "correcoes";
  const [open, setOpen] = useState(!isCorrecoes); // correções começam fechadas

  return (
    <div
      className={`rounded-xl border shadow-sm bg-white ${
        isCorrecoes ? "border-amber-300" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => isCorrecoes && setOpen((v) => !v)}
        className={`w-full flex items-center justify-between p-4 text-left ${
          isCorrecoes ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <h4
          className={`text-base font-bold ${
            isCorrecoes ? "text-amber-700" : "text-green-800"
          }`}
        >
          {title}
        </h4>

        {isCorrecoes && (
          <span className="text-sm text-amber-600">
            {open ? "− Ocultar" : "+ Ver detalhes"}
          </span>
        )}
      </button>

      {/* Conteúdo */}
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-800 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Atualizacoes() {
  return (
    <div className="space-y-4 text-sm text-gray-800">
      {/* ===================== */}
      {/* ATUALIZAÇÕES 2026 */}
      {/* ===================== */}
      <UpdateCard type="atualizacao" title="✨ Atualizações 2026">
        <p className="font-medium">
          Estamos preparando muitas novidades para este ano de{" "}
          <strong>2026</strong> 💚  
          Abaixo estão algumas das principais melhorias e funcionalidades
          que estamos implementando na plataforma:
        </p>

        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Professor avaliar o treino realizado pelo atleta;</li>

          <li>
            Adicionar <strong>titular e reserva</strong> no dia de competição,
            com notificação automática aos atletas selecionados;
          </li>

          <li>Treinos com mais de um professor;</li>

          <li>
            Vínculo de múltiplos professores por turma, clube ou escolinha;
          </li>

          <li>Tela de agendamento de treinos aprimorada para professores;</li>

          <li>Ajustes nas postagens para todos os tipos de usuários;</li>

          <li>Cadastro de professor sem obrigatoriedade do CREF;</li>

          <li>
            Escolher se exercícios personalizados terão vídeo ou não;
          </li>

          <li>Melhorias na página de Olheiros;</li>

          <li>
            Página de manutenção para períodos de atualização do sistema;
          </li>

          <li>
            Atleta avaliar o treino realizado, indicando dificuldade
            ou impossibilidade de conclusão;
          </li>

          <li>
            Validação correta das datas de eventos e notificações;
          </li>

          <li>
            Visualização cruzada de treinos entre professores,
            clubes e escolinhas;
          </li>

          <li>
            Contagem de uso dos treinos por professor,
            escolinha ou clube;
          </li>

          <li>
            Exibição completa de treinos disponíveis no
            agendamento do atleta;
          </li>
        </ul>

        <p className="mt-3 font-medium text-green-800">
          🚀 Estamos preparando muitas atualizações para esse ano de 2026 💚
        </p>
      </UpdateCard>

      {/* ===================== */}
      {/* CORREÇÕES DE BUGS */}
      {/* ===================== */}
      <UpdateCard
        type="correcoes"
        title="🐞 Correções de bugs — 19/01/2026"
      >
        <ul className="list-disc list-inside space-y-1">
          <li>Correção no carregamento de treinos agendados;</li>
          <li>Ajustes em notificações duplicadas;</li>
          <li>Correção de erros em eventos com datas inválidas;</li>
          <li>Melhoria na estabilidade geral da plataforma.</li>
        </ul>
      </UpdateCard>

      {/* ===================== */}
      {/* LANÇAMENTO FOOTERA */}
      {/* ===================== */}
      <UpdateCard type="atualizacao" title="🚀 Lançamento da FootEra">
        <p>
          Bem-vindo(a) à primeira versão oficial da plataforma{" "}
          <strong>FootEra</strong>! ⚽
        </p>

        <p>Nesta fase inicial, você já consegue:</p>

        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>
            Criar e acompanhar seu perfil de atleta, professor,
            clube ou escolinha;
          </li>
          <li>
            Explorar a plataforma e interagir com treinos
            e funcionalidades principais;
          </li>
          <li>
            Utilizar os recursos básicos do ecossistema FootEra.
          </li>
        </ul>

        <p className="mt-2">
          🔧 Seguimos evoluindo constantemente com melhorias
          e correções contínuas.
        </p>
      </UpdateCard>
    </div>
  );
}