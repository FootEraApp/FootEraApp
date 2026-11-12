
import { useCallback, useEffect, useState } from "react";
import { API } from "../../config.js";

type Solicitacao = {
  id: string;
  status: string;
  criadoEm: string;
  expiraEm: string;
  organizacao: {
    id: string;
    nome: string;
    tipo: string;
  } | null;
  proprietarioAtual?: {
    id: string;
    nome: string;
    nomeDeUsuario: string;
    foto: string | null;
    } | null;
};

type Props = {
  token: string;
};

export default function TransferenciasRecebidas({ token }: Props) {
  const [items, setItems] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const transferenciaEmDestaque =
    new URLSearchParams(window.location.search)
        .get("transferenciaId");
  const carregar = useCallback(
    async (signal?: AbortSignal) => {
      const resposta = await fetch(
        `${API.REST}/gerenciar-organizacoes/transferencias/recebidas`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        },
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados?.message || "Não foi possível carregar as solicitações.",
        );
      }

      if (!signal?.aborted) {
        setItems(Array.isArray(dados.items) ? dados.items : []);
      }
    },
    [token],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    carregar(controller.signal)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setErro(error.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [carregar]);

  async function responder(item: Solicitacao, aceitar: boolean) {
    if (respondendo) return;

    const acao = aceitar ? "aceitar" : "recusar";
    const nome = item.organizacao?.nome ?? "esta organização";

    if (
      !window.confirm(
        `Deseja ${acao} a transferência de propriedade de ${nome}?`
      )
    ) {
      return;
    }

    setRespondendo(item.id);
    setErro("");
    setMensagem("");

    try {
      const resposta = await fetch(
        `${API.REST}/gerenciar-organizacoes/transferencias/` +
          `${encodeURIComponent(item.id)}/responder`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ aceitar }),
        },
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados?.message || "Não foi possível responder.",
        );
      }

      if (aceitar) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.assign("/login");
        return;
      } else {
        setItems((anteriores) =>
            anteriores.filter((solicitacao) => solicitacao.id !== item.id),
      );
        setMensagem("Solicitação recusada.");
      }

    } catch (error: any) {
      setErro(
        error?.message || "Não foi possível responder à solicitação.",
      );
    } finally {
      setRespondendo(null);
    }
  }

  return (
    <section
      id="transferencias-propriedade"
      className="mx-4 mb-4 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Transferências de propriedade
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Organizações que outras pessoas querem transferir para você.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            setErro("");
            try {
              await carregar();
            } catch (error: any) {
              setErro(error?.message || "Erro ao atualizar.");
            } finally {
              setLoading(false);
            }
          }}
          className="text-sm font-medium text-green-800"
        >
          Atualizar
        </button>
      </div>

      {loading && (
        <p className="mt-3 text-sm text-gray-600">
          Carregando solicitações...
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="mt-3 text-sm text-gray-600">
          Você não possui solicitações de transferência pendentes.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            id={`transferencia-${item.id}`}
            className={
                item.id === transferenciaEmDestaque
                ? "rounded-xl border-2 border-green-600 bg-green-50 p-3"
                : "rounded-xl border border-gray-200 p-3"
            }
            >
            <p className="font-semibold text-gray-900">
              {item.organizacao?.nome ?? "Organização"}
            </p>

            {item.proprietarioAtual && (
            <p className="mt-1 text-sm text-gray-600">
                Enviada por: {item.proprietarioAtual.nome}
                {" "}(@{item.proprietarioAtual.nomeDeUsuario})
            </p>
            )}

            <p className="text-xs text-gray-500">
              {item.organizacao?.tipo ?? "Institucional"}
            </p>

            <p className="mt-2 text-sm text-gray-600">
              Você foi convidado a assumir a propriedade desta organização.
              Ao aceitar, passará a ter responsabilidades administrativas
              sobre ela.
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Expira em: {new Date(item.expiraEm).toLocaleDateString("pt-BR")}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={respondendo !== null}
                onClick={() => responder(item, false)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Recusar
              </button>

              <button
                type="button"
                disabled={respondendo !== null}
                onClick={() => responder(item, true)}
                className="flex-1 rounded-lg bg-green-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {respondendo === item.id
                  ? "Processando..."
                  : "Aceitar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {erro && (
        <p className="mt-3 text-sm text-red-600">{erro}</p>
      )}

      {mensagem && (
        <p className="mt-3 text-sm text-green-700">{mensagem}</p>
      )}
    </section>
  );
}