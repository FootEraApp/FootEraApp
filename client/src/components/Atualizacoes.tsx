// client/src/components/Atualizacoes.tsx
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
  const [open, setOpen] = useState(!isCorrecoes); 

  return (
    <div
      className={`rounded-xl border shadow-sm bg-white ${
        isCorrecoes ? "border-amber-300" : "border-gray-200"
      }`}
    >
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

      <UpdateCard type="atualizacao" title="✨ Atualizações do Perfil — 03/07/2026">
        <ul className="list-disc list-inside space-y-1">
          <li>
            Agora é possível <strong>mudar o tipo do seu perfil</strong>: quem criou conta
            como <strong>Learning</strong> (só cursos) pode virar Atleta, Profissional,
            Olheiro, Clube, Escolinha, Federação ou Marca sem perder cursos, lives e
            progresso já conquistados — em Configurações {'>'} Mudar tipo de perfil.
          </li>
          <li>
            Chegaram <strong>três novos tipos de perfil</strong> na FootEra:{" "}
            <strong>Learning</strong> (focado em cursos e certificados),{" "}
            <strong>Marca</strong> (parceiras/patrocinadoras) e{" "}
            <strong>Federação</strong> (canal institucional com eventos e conteúdos
            oficiais).
          </li>
          <li>
            <strong>Seguir alguém</strong> agora funciona por solicitação: você pede para
            seguir e a pessoa precisa aceitar — dá para aceitar ou recusar pedidos direto
            na tela de <strong>notificações</strong>.
          </li>
          <li>
            O perfil de <strong>Atleta</strong> ganhou uma aba nova de{" "}
            <strong>Conquistas</strong>, mostrando emblemas e certificados conquistados.
          </li>
          <li>
            Perfis de <strong>Clube</strong> e <strong>Escolinha</strong> também ganharam
            a aba <strong>Conquistas</strong>, com emblemas e certificados da organização.
          </li>
          <li>
            O perfil de <strong>Clube</strong> ganhou uma aba de{" "}
            <strong>Dashboard</strong> própria.
          </li>
          <li>
            Contas verificadas agora mostram um selo <strong>“Verificado”</strong> no
            topo do perfil.
          </li>
          <li>
            <strong>Editar perfil</strong> ficou bem mais completo: agora dá para
            preencher <strong>Bio, CPF, CEP, país, estado, cidade e endereço</strong>.
          </li>
          <li>
            Perfis de organização (Clube, Escolinha, Marca, Federação) passaram a ter
            campos próprios para editar <strong>CNPJ, telefones, e-mail público, site
            oficial, sede e descrição</strong>.
          </li>
          <li>
            <strong>Professores</strong> agora podem enviar solicitação de vínculo direto
            pelo próprio perfil para se conectar com um clube ou escolinha.
          </li>
          <li>
            A <strong>foto de perfil</strong> ganhou um jeito novo e mais confiável de
            carregar, com um ícone padrão quando a pessoa ainda não tem foto.
          </li>
          <li>
            Ao acessar o perfil de clubes, escolinhas, profissionais, olheiros, marcas e
            federações que também têm página de <strong>Creator</strong>, aparece um
            botão para ver a página Creator dessa pessoa/organização.
          </li>
          <li>
            Agora dá para <strong>desvincular um treino em conjunto</strong> direto pelo
            perfil da pessoa, com uma confirmação antes de desfazer.
          </li>
          <li>
            Avisos e mensagens de erro (por exemplo, ao tentar seguir sem estar logado)
            agora aparecem como <strong>notificações discretas</strong> na tela em vez de
            pop-ups de alerta.
          </li>
          <li>
            Notificações podem ser enviadas para o seu computador/celular se vc habilitar essa opção.
          </li>
          <li>
            A seção <strong>“Minhas postagens”</strong> no perfil recebeu um visual
            levemente atualizado.
          </li>
        </ul>
      </UpdateCard>

      <UpdateCard type="atualizacao" title="✨ Atualizações — 20/02/2026">
        <ul className="list-disc list-inside space-y-1">
          <li>
            Implementamos um sistema de <strong>“lixeira” para contas</strong>:
            ao excluir, a conta vai para lixeira e só é removida definitivamente após{" "}
            <strong>30 dias</strong>.
          </li>
          <li>
            Adicionamos <strong>restauração de conta</strong> dentro do prazo de 30 dias
            (pelo usuário ou pelo admin).
          </li>
          <li>
            Criamos o <strong>status online</strong> (online / ausente / offline) exibido no{" "}
            <strong>perfil único</strong> e no sistema de <strong>mensagens</strong>.
          </li>
          <li>
            Novo controle de privacidade: o usuário pode{" "}
            <strong>bloquear nas configurações</strong> se o status online será exibido.
          </li>
          <li>
            O status online agora aparece apenas para conexões permitidas, como{" "}
            <strong>seguidores mútuos</strong> e pessoas que <strong>treinam juntas</strong>.
          </li>
          <li>
            Treinos de <strong>professores parceiros</strong> agora podem ser publicados para{" "}
            <strong>toda a FootEra</strong> (treino parceiro) ou apenas para{" "}
            <strong>seus próprios alunos</strong> (treino normal), com opção dedicada.
          </li>
          <li>
            Criamos o módulo de <strong>Metodologias</strong> (para assinantes), com aulas
            que podem ter <strong>vários treinos</strong>, blocos por <strong>semana</strong>,
            pontuação e agendamento.
          </li>
          <li>
            Metodologias agora suportam <strong>video-aulas</strong> (10min a 1h), com
            pontuação proporcional ao tempo e opção de assistir em{" "}
            <strong>dia aleatório</strong>.
          </li>
          <li>
            Adicionamos <strong>thumbUrl</strong> para vídeos das metodologias.
          </li>
          <li>
            Ao finalizar uma metodologia, liberamos{" "}
            <strong>avaliação com nota</strong> (similar aos treinos).
          </li>
          <li>
            Evitamos duplicação: agora não é possível criar{" "}
            <strong>mais de uma metodologia com o mesmo nome</strong> por acidente, com
            alerta de sucesso/erro e suporte a foto da metodologia.
          </li>
          <li>
            Metodologias agora podem ser separadas por público:{" "}
            <strong>Atletas</strong>, <strong>Profissionais</strong> ou <strong>Ambos</strong>.
          </li>
          <li>
            Criamos base para novos modelos de assinatura:{" "}
            <strong>Plus</strong> (treinos + metodologias) e plano voltado para{" "}
            <strong>learnings</strong>.
          </li>
          <li>
            Fluxo de assinatura melhorado: se o usuário já tem plano de learnings, ao
            “assinar metodologia” ele não vai para pagamento — a metodologia é liberada e
            passa a contar no limite de metodologias selecionadas.
          </li>
          <li>
            Adicionamos modo na criação de treino para indicar se o treino é{" "}
            <strong>destinado a metodologia</strong>.
          </li>
          <li>
            Nova dinâmica por turma: o professor pode escolher uma{" "}
            <strong>turma</strong>, selecionar um treino do dia, marcar{" "}
            <strong>presença</strong> e contabilizar <strong>pontos</strong> para os presentes.
          </li>
        </ul>
      </UpdateCard>

      <UpdateCard type="correcoes" title="🐞 Correções de bugs — 20/02/2026">
        <ul className="list-disc list-inside space-y-1">
          <li>
            Correção nos <strong>exercícios temporários</strong> e em casos onde treinos
            apareciam <strong>sem exercícios</strong> ou <strong>sem vídeos</strong>.
          </li>
          <li>
            Correção em “treinos novos” que às vezes vinham{" "}
            <strong>sem exercícios</strong>, <strong>sem pontuação</strong>,{" "}
            <strong>sem data agendada</strong> ou <strong>sem imagem</strong>.
          </li>
          <li>
            Ajuste para permitir <strong>reagir aos posts</strong> também na página de{" "}
            <strong>perfil</strong>, igual ao feed.
          </li>
          <li>
            Ajuste no <strong>Gerenciar Atletas</strong> para exibir corretamente treinos do{" "}
            <strong>mês anterior</strong> quando o calendário mostra datas no mês seguinte.
          </li>
          <li>
            Reduzimos a quantidade de vezes que <strong>treino agendado</strong> aparecia
            duplicado no <strong>Gerenciar Turma</strong>.
          </li>
          <li>
            Correção no criar metodologias para listar{" "}
            <strong>todos os treinos do professor/escolinha/clube criador</strong>.
          </li>
          <li>
            Correção no filtro de “<strong>treinos criados recentemente</strong>” que estava
            exibindo todos os vinculados em vez de apenas os do usuário logado.
          </li>
          <li>
            Ajuste para incluir treinos onde o professor é{" "}
            <strong>colaborador</strong> tanto em “treinos criados recentemente” quanto em
            “meus treinos”.
          </li>
          <li>
            Ajustes para metodologias avulsas: liberar apenas a{" "}
            <strong>metodologia comprada</strong> quando aplicável.
          </li>
          <li>
            Metodologias concluídas agora podem aparecer como{" "}
            <strong>atividades recentes</strong> também em perfis de{" "}
            <strong>clube/escolinha</strong>.
          </li>
          <li>
            Testes e correções para garantir que metodologias postadas apareçam em{" "}
            <strong>Atividades Recentes</strong> no perfil de clube.
          </li>
        </ul>
      </UpdateCard>

      <UpdateCard type="correcoes" title="🐞 Correções de bugs — 15/01/2026">
        <ul className="list-disc list-inside space-y-1">
          <li>Ajustes na exibição e filtragem de treinos para atletas, professores, clubes e escolinhas.</li>
          <li>Correção na contagem e visualização de treinos realizados, utilizados e vinculados.</li>
          <li>Melhorias no agendamento de treinos, exibindo apenas opções válidas conforme vínculos do usuário.</li>
          <li>Correção de inconsistências no gerenciamento de atletas, turmas e quantidade de alunos vinculados.</li>
          <li>Ajustes no fluxo de criação, edição e exclusão de treinos, garantindo permissões corretas.</li>
          <li>Correções no carregamento e salvamento de dados ao editar treinos existentes.</li>
          <li>Melhorias na exibição de imagens e fotos de perfil, com fallback automático para a logo da FootEra.</li>
          <li>Ajustes na página Explorar, corrigindo buscas, filtros e resultados exibidos.</li>
          <li>Correções no sistema de mensagens, exibindo corretamente conversas e últimas interações.</li>
          <li>Ajustes no sistema de eventos, agendas e convocações de atletas.</li>
          <li>Correções na exibição de conquistas, observados e informações de perfil.</li>
          <li>Melhorias nas configurações de conta, assinatura e acesso a pagamentos.</li>
          <li>Ajustes no controle de trial gratuito e ativação consciente do plano.</li>
          <li>Correções visuais e funcionais em telas administrativas e de gerenciamento.</li>
        </ul>
      </UpdateCard>
      
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

      <UpdateCard type="correcoes" title="🐞 Correções de bugs — 19/01/2026">
        <ul className="list-disc list-inside space-y-1">
          <li>Correção no carregamento de treinos agendados;</li>
          <li>Ajustes em notificações duplicadas;</li>
          <li>Correção de erros em eventos com datas inválidas;</li>
          <li>Melhoria na estabilidade geral da plataforma.</li>
        </ul>
      </UpdateCard>

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