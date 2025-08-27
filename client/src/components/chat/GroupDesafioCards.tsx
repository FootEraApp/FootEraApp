import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";

export type MsgGrupo = {
  id: string;
  grupoId: string;
  usuarioId: string;
  criadaEm: string;
  conteudo: string;
  tipo:
    | "NORMAL"
    | "DESAFIO"
    | "POST"
    | "USUARIO"
    | "CONQUISTA"
    | "GRUPO_DESAFIO"
    | "GRUPO_DESAFIO_BONUS";
  conteudoJson?: any;
  desafioEmGrupoId?: string | null;
  usuario?: { id: string; nome: string; foto?: string | null };
};

function formatarData(d?: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

export function CardDesafioGrupo({ msg }: { msg: MsgGrupo }) {
  const [, navigate] = useLocation();

  const {
    titulo,
    prazo,
    pontos,
    pontuacao,
    enviados: enviadosJson = 0,
    total: totalJson = 0,
    linkSubmissao,
    desafioId: desafioIdJson,
  } = (msg.conteudoJson || {}) as {
    titulo: string;
    prazo?: string;
    pontos?: number;
    pontuacao?: number;
    enviados?: number;
    total?: number;
    linkSubmissao?: string;
    desafioId?: string;
  };

  const pts = typeof pontos === "number" ? pontos : pontuacao ?? 0;

  const [contagem, setContagem] = useState<{ enviados: number; total: number }>({
    enviados: enviadosJson ?? 0,
    total: totalJson ?? 0,
  });

  useEffect(() => {
    let alive = true;
    if (!msg.desafioEmGrupoId) return;

    fetch(`${API.BASE_URL}/api/desafios/em-grupo/${msg.desafioEmGrupoId}/progresso`, {
      headers: { Authorization: `Bearer ${Storage.token || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setContagem({
          enviados: Number(data.enviados) || 0,
          total: Number(data.total) || 0,
        });
      })
      .catch(() => {  });

    return () => { alive = false; };
  }, [msg.desafioEmGrupoId]);

  const desafioId =
    desafioIdJson ||
    (msg.conteudoJson && (msg.conteudoJson.desafioOficialId || msg.conteudoJson.desafio_id));

  const handleEnviarAgora = () => {
    if (msg.desafioEmGrupoId && desafioId) {
      navigate(`/submissao/grupo/${msg.desafioEmGrupoId}/${desafioId}`);
    } else if (linkSubmissao && linkSubmissao.startsWith("/submissao/")) {
      navigate(linkSubmissao);
    } else {
      alert("Não foi possível abrir a página de submissão: faltam IDs.");
    }
  };

  return (
    <div className="max-w-md rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm">
      <div className="font-semibold">Desafio em Grupo</div>
      <div className="mt-1">🏁 <b>{titulo}</b></div>
      <div className="mt-1">🗓️ Prazo: {formatarData(prazo)}</div>
      <div className="mt-1">⭐ Pontos: {pts}</div>
      <div className="mt-1">📈 Progresso: {contagem.enviados}/{contagem.total}</div>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-yellow-500 px-3 py-1 text-white hover:bg-yellow-600"
          onClick={handleEnviarAgora}
        >
          Enviar agora
        </button>
      </div>
    </div>
  );
}

export function CardBonus({ msg }: { msg: MsgGrupo }) {
  const { titulo, bonus = 0 } =
    (msg.conteudoJson || {}) as { titulo?: string; bonus?: number };
  return (
    <div className="max-w-md rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
      <div className="font-semibold">🎉 BÔNUS liberado</div>
      <div className="mt-1">
        {titulo ? `"${titulo}"` : "Desafio"} concluído por todos no prazo.
      </div>
      <div className="mt-1">Cada um recebeu +{bonus} pts.</div>
    </div>
  );
}

export function BubbleMensagem({
  msg,
  isMine,
  baseUrl,
}: {
  msg: MsgGrupo;
  isMine: boolean;
  baseUrl: string;
}) {
  return (
    <div
      className={`p-2 rounded max-w-sm ${isMine ? "bg-blue-100 self-end ml-auto" : "bg-gray-200"}`}
      title={msg.usuario?.nome}
    >
      {msg.usuario && (
        <div className="text-xs text-gray-600 mb-1 flex items-center gap-2">
          <img
            src={
              msg.usuario.foto
                ? `${baseUrl}${msg.usuario.foto}`
                : "https://via.placeholder.com/24"
            }
            alt={msg.usuario.nome}
            className="w-6 h-6 rounded-full object-cover border"
          />
          <span className="font-medium">{msg.usuario.nome}</span>
        </div>
      )}
      <div className="whitespace-pre-wrap">{msg.conteudo}</div>
      <div className="text-[10px] text-gray-500 mt-1">
        {new Date(msg.criadaEm).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

export function MensagemItemGrupo({
  msg,
  meId,
  baseUrl,
}: {
  msg: MsgGrupo;
  meId?: string | null;
  baseUrl: string;
}) {
  if (msg.tipo === "GRUPO_DESAFIO" && msg.conteudoJson) {
    return <CardDesafioGrupo msg={msg} />;
  }
  if (msg.tipo === "GRUPO_DESAFIO_BONUS" && msg.conteudoJson) {
    return <CardBonus msg={msg} />;
  }
  return <BubbleMensagem msg={msg} isMine={msg.usuarioId === meId} baseUrl={baseUrl} />;
}
