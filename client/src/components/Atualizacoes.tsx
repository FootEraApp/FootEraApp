import React from "react";

export default function Atualizacoes() {
  return (
    <div className="space-y-4 text-sm text-gray-800">
      <div>
        <h4 className="text-base font-bold text-green-800">
          🚀 Lançamento da FootEra
        </h4>
        <p className="mt-1">
          Bem-vindo(a) à primeira versão oficial da plataforma <strong>FootEra</strong>! ⚽
        </p>
      </div>

      <div>
        <p>
          Nesta fase inicial, você já consegue:
        </p>
        <ul className="mt-1 list-disc list-inside space-y-1">
          <li>Criar e acompanhar seu perfil de atleta, professor, clube ou escolinha;</li>
          <li>Explorar a plataforma, interagir com treinos e funcionalidades principais;</li>
          <li>Usar os recursos básicos que estamos construindo para o ecossistema do futebol.</li>
        </ul>
      </div>

      <div>
        <p>
          🔧 Estamos trabalhando constantemente em novas funcionalidades, melhorias de usabilidade
          e correções de bugs. Muitas atualizações ainda estão por vir!
        </p>
        <p className="mt-2">
          Sempre que lançarmos uma nova versão, vamos listar aqui o que mudou para você acompanhar
          a evolução da FootEra de perto. 💚
        </p>
      </div>
    </div>
  );
}
