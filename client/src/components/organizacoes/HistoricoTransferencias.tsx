
import { useCallback, useEffect, useState } from "react";
import { API } from "../../config.js";
import { formatarUrlFoto } from "../../utils/formatarFoto.js";

type Pessoa = {
  id: string;
  nome: string;
  nomeDeUsuario: string | null;
  foto: string | null;
};

type Registro = {
  id: string;
  sentido: "ENVIADA" | "RECEBIDA";
  status: string;
  statusEfetivo: string;
  criadoEm: string;
  expiraEm: string;
  respondidoEm: string | null;
  concluidoEm: string | null;
  organizacao: {
    id: string;
    nome: string;
    tipo: string;
  } | null;
  remetente: Pessoa | null;
  destinatario: Pessoa | null;
};

const FOTO_PADRAO =
  "/assets/usuarios/footera-logo-fundo-verde.png";

const nomesStatus: Record<string, string> = {
  PENDENTE: "Pendente",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
};

function formatarData(valor: string | null) {
  if (!valor) return "—";

  const data = new Date(valor);

  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
}

export default function HistoricoTransferencias({
  token,
}: {
  token: string;
}) {
  const [aba, setAba] =
    useState<"ENVIADA" | "RECEBIDA">("ENVIADA");
  const [items, setItems] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async (signal?: AbortSignal) => {
    const resposta = await fetch(
      `${API.REST}/gerenciar-organizacoes/transferencias/historico`,
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
        dados?.message ?? "Não foi possível carregar o histórico.",
      );
    }

    if (!signal?.aborted) {
      setItems(Array.isArray(dados.items) ? dados.items : []);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setErro("");

    carregar(controller.signal)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setErro(error?.message ?? "Erro ao carregar histórico.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [carregar]);

  const registros = items.filter(
    (item) => item.sentido === aba,
  );

  return (
    <section className="mx-4 mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">
            Histórico de transferências
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Consulte solicitações enviadas e recebidas,
            inclusive as já respondidas.
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
              setErro(error?.message ?? "Erro ao atualizar.");
            } finally {
              setLoading(false);
            }
          }}
          className="text-sm font-semibold text-green-800"
        >
          Atualizar
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {(["ENVIADA", "RECEBIDA"] as const).map((sentido) => (
          <button
            key={sentido}
            type="button"
            onClick={() => setAba(sentido)}
            className={
              aba === sentido
                ? "flex-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white"
                : "flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
            }
          >
            {sentido === "ENVIADA" ? "Enviadas" : "Recebidas"}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-3 text-sm text-gray-500">
          Carregando histórico...
        </p>
      )}

      {!loading && !erro && registros.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">
          Nenhuma transferência encontrada nesta categoria.
        </p>
      )}

      {erro && (
        <p className="mt-3 text-sm text-red-600">{erro}</p>
      )}

      <div className="mt-3 space-y-3">
        {registros.map((item) => {
          const pessoa =
            aba === "ENVIADA"
              ? item.destinatario
              : item.remetente;

          const status = item.statusEfetivo;
          const destaque =
            new URLSearchParams(window.location.search)
              .get("transferenciaId") === item.id;

          return (
            <article
              key={item.id}
              className={
                destaque
                  ? "rounded-xl border-2 border-green-600 bg-green-50 p-3"
                  : "rounded-xl border border-gray-200 p-3"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {item.organizacao?.nome ?? "Organização"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.organizacao?.tipo ?? "Institucional"}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                  {nomesStatus[status] ?? status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <img
                  src={
                    pessoa?.foto
                      ? formatarUrlFoto(pessoa.foto, "usuarios")
                      : FOTO_PADRAO
                  }
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FOTO_PADRAO;
                  }}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {pessoa?.nome ?? "Usuário"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {aba === "ENVIADA"
                      ? "Destinatário"
                      : "Remetente"}
                    {pessoa?.nomeDeUsuario
                      ? ` · @${pessoa.nomeDeUsuario}`
                      : ""}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-600">
                Enviada: {formatarData(item.criadoEm)}
              </p>

              {item.respondidoEm && (
                <p className="mt-1 text-xs text-gray-600">
                  Respondida: {formatarData(item.respondidoEm)}
                </p>
              )}

              {status === "PENDENTE" && (
                <p className="mt-2 text-sm text-amber-700">
                  Aguardando resposta até{" "}
                  {formatarData(item.expiraEm)}.
                </p>
              )}

              {status === "RECUSADA" && aba === "ENVIADA" && (
                <p className="mt-2 text-sm text-gray-600">
                  A pessoa recusou seu pedido. Se você ainda
                  for proprietário, poderá solicitar novamente.
                </p>
              )}

              {status === "ACEITA" && (
                <p className="mt-2 text-sm text-green-800">
                  Transferência concluída.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}