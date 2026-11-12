
import { useEffect, useState } from "react";
import { API } from "../../config.js";
import { formatarUrlFoto } from "../../utils/formatarFoto.js";

const FALLBACK_AVATAR =
  "/assets/usuarios/footera-logo-fundo-verde.png";

type UsuarioDestinatario = {
  id: string;
  nome: string;
  nomeDeUsuario: string;
  foto: string | null;
};

type Props = {
  organizacaoId: string;
  nomeOrganizacao: string;
  token: string;
};

export default function TransferirPropriedade({
  organizacaoId,
  nomeOrganizacao,
  token,
}: Props) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<UsuarioDestinatario[]>([]);
  const [selecionado, setSelecionado] =
    useState<UsuarioDestinatario | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    setSelecionado(null);
    setBusca("");
    setResultados([]);
    setMensagem("");
    setErro("");
  }, [organizacaoId]);

  useEffect(() => {
    if (selecionado || busca.trim().length < 3 || !token) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      setBuscando(true);

      try {
        const url =
          `${API.REST}/gerenciar-organizacoes/minhas/` +
          `${encodeURIComponent(organizacaoId)}` +
          `/transferencias/destinatarios?q=` +
          encodeURIComponent(busca.trim());

        const resposta = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
          throw new Error(
            dados?.message ?? "Erro ao buscar usuários.",
          );
        }

        if (!controller.signal.aborted) {
          setResultados(
            Array.isArray(dados.items) ? dados.items : [],
          );
          setErro("");
        }
      } catch (error: any) {
        if (!controller.signal.aborted) {
          setErro(error?.message ?? "Erro na busca.");
          setResultados([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setBuscando(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [busca, selecionado, organizacaoId, token]);

  async function enviarSolicitacao() {
    if (!selecionado || enviando) return;

    const confirmou = window.confirm(
      `Enviar solicitação de propriedade de ${nomeOrganizacao} ` +
      `para ${selecionado.nome}? A propriedade só mudará após a aceitação.`,
    );

    if (!confirmou) return;

    setEnviando(true);
    setErro("");
    setMensagem("");

    try {
      const resposta = await fetch(
        `${API.REST}/gerenciar-organizacoes/minhas/` +
          `${encodeURIComponent(organizacaoId)}/transferencias`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            destinatarioId: selecionado.id,
          }),
        },
      );

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          dados?.message ?? "Não foi possível enviar a solicitação.",
        );
      }

      setMensagem(
        `Solicitação enviada para ${selecionado.nome}. ` +
        "A propriedade continua com você até a aceitação. " +
        "Você pode acompanhar a resposta no Histórico de transferências, em Configurações.",
        );
    } catch (error: any) {
      setErro(error?.message ?? "Erro ao solicitar transferência.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">
        Transferir propriedade
      </h3>

      <p className="mt-2 text-sm text-gray-600">
        Selecione outro usuário para assumir {nomeOrganizacao}.
        A transferência depende da aceitação do destinatário.
      </p>

      <input
        type="search"
        value={busca}
        onChange={(event) => {
          setBusca(event.target.value);
          setSelecionado(null);
          setMensagem("");
        }}
        placeholder="Digite o nome, @usuário ou ID"
        className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
      />

      {buscando && (
        <p className="mt-2 text-sm text-gray-500">
          Buscando usuários...
        </p>
      )}

      {!selecionado && resultados.length > 0 && (
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2">
          {resultados.map((usuario) => (
            <button
              type="button"
              key={usuario.id}
              onClick={() => {
                setSelecionado(usuario);
                setBusca(usuario.nome);
                setResultados([]);
              }}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-green-50"
            >
              <img
                src={
                    typeof usuario.foto === "string" &&
                    usuario.foto.trim()
                    ? formatarUrlFoto(usuario.foto, "usuarios")
                    : FALLBACK_AVATAR
                }
                onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = FALLBACK_AVATAR;
                }}
                alt={`Foto de ${usuario.nome}`}
                className="h-11 w-11 shrink-0 rounded-full border border-gray-200 object-cover"
                />

              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {usuario.nome}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  @{usuario.nomeDeUsuario}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selecionado && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="mb-3 text-sm font-semibold text-green-900">
            Destinatário selecionado
            </p>

            <div className="flex items-center gap-3">
            <img
                src={
                typeof selecionado.foto === "string" &&
                selecionado.foto.trim()
                    ? formatarUrlFoto(selecionado.foto, "usuarios")
                    : FALLBACK_AVATAR
                }
                onError={(e) => {
                const img = e.currentTarget;
                img.onerror = null;
                img.src = FALLBACK_AVATAR;
                }}
                alt={`Foto de ${selecionado.nome}`}
                className="h-12 w-12 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">
                {selecionado.nome}
                </p>

                <p className="truncate text-xs text-gray-600">
                @{selecionado.nomeDeUsuario}
                </p>
            </div>

            <button
                type="button"
                onClick={() => {
                setSelecionado(null);
                setBusca("");
                setResultados([]);
                setMensagem("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold"
            >
                Trocar
            </button>
            </div>
        </div>
        )}

      {erro && (
        <p className="mt-2 text-sm text-red-600">{erro}</p>
      )}

      {mensagem && (
        <p className="mt-2 text-sm text-green-700">{mensagem}</p>
      )}

      <button
        type="button"
        disabled={!selecionado || enviando || Boolean(mensagem)}
        onClick={enviarSolicitacao}
        className="mt-4 w-full rounded-xl bg-green-800 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando
          ? "Enviando solicitação..."
          : "Enviar solicitação de transferência"}
      </button>
    </section>
  );
}