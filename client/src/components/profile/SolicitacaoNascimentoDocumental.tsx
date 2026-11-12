// client/src/components/profile/SolicitacaoNascimentoDocumental.tsx

import { useEffect, useState } from "react";
import { API } from "../../config.js";

type Pedido = {
  id: string;
  dataSolicitada: string;
  status: string;
  criadoEm: string;
  documento?: {
    id: string;
    mimeType: string;
    criadoEm: string;
  } | null;
};

const BASE =
  `${API.BASE_URL}/api/correcao-nascimento`;

function obterToken(): string {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

async function respostaJson(res: Response) {
  return res.json().catch(() => null);
}

type Props = {
  token?: string;
};

export default function SolicitacaoNascimentoDocumental({
  token,
}: Props) {
  const [dataSolicitada, setDataSolicitada] =
    useState("");

  const [motivo, setMotivo] = useState("");
  const [arquivo, setArquivo] =
    useState<File | null>(null);

  const [pedidos, setPedidos] =
    useState<Pedido[]>([]);

  const [carregando, setCarregando] =
    useState(false);

  const [uploadDisponivel, setUploadDisponivel] =
    useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const tokenAtual = () =>
  token?.trim() || obterToken();

  async function carregar() {
    const resposta = await fetch(
      `${BASE}/minha`,
      {
        headers: {
          Authorization: `Bearer ${tokenAtual()}`,
        },
      }
    );

    const dados = await respostaJson(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados?.message ||
        `Falha HTTP ${resposta.status}`
      );
    }

    setPedidos(
      Array.isArray(dados?.solicitacoes)
        ? dados.solicitacoes
        : []
    );
  }

    useEffect(() => {
    void carregar().catch((erro) => {
        setErro(
        erro instanceof Error
            ? erro.message
            : "Falha ao consultar solicitações."
        );
    });

    void fetch(
        `${BASE}/disponibilidade-documento`,
        {
        headers: {
            Authorization: `Bearer ${tokenAtual()}`,
        },
        }
    )
        .then(async (resposta) => {
        if (!resposta.ok) {
            throw new Error("DISPONIBILIDADE_INDISPONIVEL");
        }

        const dados = await resposta.json();

        setUploadDisponivel(
            dados?.uploadDisponivel === true
        );
        })
        .catch(() => {
        setUploadDisponivel(false);
        });
    }, [token]);

  async function enviarArquivo(
    solicitacaoId: string,
    escolhido: File
  ) {
    if (
      escolhido.size === 0 ||
      escolhido.size > 5 * 1024 * 1024 ||
      ![
        "application/pdf",
        "image/jpeg",
        "image/png",
      ].includes(escolhido.type)
    ) {
      throw new Error(
        "Escolha um PDF, JPG ou PNG de até 5 MB."
      );
    }

    const form = new FormData();
    form.append("documento", escolhido);

    const resposta = await fetch(
      `${BASE}/${encodeURIComponent(solicitacaoId)}/documento`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenAtual()}`,
        },
        body: form,
      }
    );

    const dados = await respostaJson(resposta);

    if (!resposta.ok) {
      throw new Error(
        dados?.message ||
        dados?.code ||
        `Falha no envio HTTP ${resposta.status}`
      );
    }
  }

  async function solicitar() {
    setErro("");
    setSucesso("");

    if (!uploadDisponivel) {
        setErro(
        "O envio de documentos está temporariamente indisponível."
        );
        return;
    }

    if (!arquivo) {
        setErro("Escolha um documento comprobatório.");
        return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch(
        `${BASE}/solicitar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenAtual()}`,
          },
          body: JSON.stringify({
            dataSolicitada,
            motivo,
          }),
        }
      );

      const dados = await respostaJson(resposta);

      if (!resposta.ok) {
        throw new Error(
          dados?.message ||
          dados?.code ||
          `Falha HTTP ${resposta.status}`
        );
      }

      const solicitacaoId = String(
        dados?.solicitacao?.id ?? ""
      );

      if (!solicitacaoId) {
        throw new Error(
          "Solicitação criada, mas ID não retornado. Atualize a lista."
        );
      }

      try {
        await enviarArquivo(
          solicitacaoId,
          arquivo
        );

        setSucesso(
          "Solicitação e documento recebidos para análise."
        );

        setArquivo(null);
        setMotivo("");
        setDataSolicitada("");
      } catch (erroUpload) {
        setErro(
          "Solicitação criada, mas documento não enviado. " +
          "Use a opção de enviar documento pendente abaixo. " +
          (erroUpload instanceof Error
            ? erroUpload.message
            : "")
        );
      }

      await carregar();
    } catch (erroSolicitacao) {
      setErro(
        erroSolicitacao instanceof Error
          ? erroSolicitacao.message
          : "Falha ao solicitar correção."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function reenviar(
    solicitacaoId: string,
    escolhido: File
  ) {
    if (!uploadDisponivel) {
    setErro(
        "O envio de documentos está temporariamente indisponível."
    );
    return;
    }

    setCarregando(true);
    setErro("");
    setSucesso("");

    try {
      await enviarArquivo(
        solicitacaoId,
        escolhido
      );

      await carregar();

      setSucesso(
        "Documento anexado à solicitação."
      );
    } catch (erroUpload) {
      setErro(
        erroUpload instanceof Error
          ? erroUpload.message
          : "Falha no envio."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="mx-4 mb-4 space-y-3 rounded-xl bg-white p-4 shadow">
      <h2 className="font-bold text-gray-800">
        Corrigir data de nascimento
      </h2>

      <p className="text-sm text-gray-600">
        A correção depende de análise autorizada.
        Informe a data correta e anexe um
        documento oficial que a comprove.
        Não envie documentos pelo feed ou por mensagens.
      </p>

      <label className="block text-sm font-medium">
        Data correta
        <input
          type="date"
          value={dataSolicitada}
          onChange={(e) =>
            setDataSolicitada(e.target.value)
          }
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>

      <label className="block text-sm font-medium">
        Motivo (20–1000 caracteres)
        <textarea
          value={motivo}
          onChange={(e) =>
            setMotivo(e.target.value)
          }
          minLength={20}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>

      <label className="block text-sm font-medium">
        Documento (PDF, JPG ou PNG; máximo 5 MB)
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          onChange={(e) =>
            setArquivo(e.target.files?.[0] ?? null)
          }
          className="mt-1 block w-full text-sm"
        />
      </label>

            {!uploadDisponivel && (
        <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
            O envio de documentos para correção de nascimento
            está temporariamente indisponível.
            Você poderá solicitar a correção quando
            o serviço estiver habilitado.
        </p>
        )}

      <button
        type="button"
        disabled={
        !uploadDisponivel ||
        carregando ||
        !dataSolicitada ||
        motivo.trim().length < 20 ||
        !arquivo
        }
        onClick={() => void solicitar()}
        className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {carregando
          ? "Enviando..."
          : "Solicitar correção"}
      </button>

      {erro && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {erro}
        </p>
      )}

      {sucesso && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
        >
          {sucesso}
        </p>
      )}

      <h3 className="font-semibold text-gray-800">
        Minhas solicitações
      </h3>

      {pedidos.length === 0 && (
        <p className="text-sm text-gray-500">
          Nenhuma solicitação registrada.
        </p>
      )}

      {pedidos.map((pedido) => (
        <div
          key={pedido.id}
          className="space-y-2 rounded-lg border p-3 text-sm"
        >
          <p>
            <strong>Data solicitada:</strong>{" "}
            {pedido.dataSolicitada.slice(0, 10)}
          </p>

          <p>
            <strong>Situação:</strong>{" "}
            {pedido.status.replace(/_/g, " ")}
          </p>

          <p>
            <strong>Documento:</strong>{" "}
            {pedido.documento
              ? "Recebido"
              : "Ainda não enviado"}
          </p>

          {!pedido.documento &&
            [
              "PENDENTE_VERIFICACAO",
              "EM_ANALISE",
            ].includes(pedido.status) && (
              <label className="block">
                Enviar documento pendente
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  disabled={carregando || !uploadDisponivel}
                  onChange={(e) => {
                    const escolhido =
                      e.target.files?.[0];

                    if (escolhido) {
                      void reenviar(
                        pedido.id,
                        escolhido
                      );
                    }

                    e.currentTarget.value = "";
                  }}
                  className="mt-1 block w-full text-sm"
                />
              </label>
            )}
        </div>
      ))}
    </section>
  );
}