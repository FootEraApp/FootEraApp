// client/src/components/admin/CorrecoesNascimentoAdmin.tsx

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { API } from "../../config.js";

type Status =
  | "PENDENTE_VERIFICACAO"
  | "EM_ANALISE"
  | "APROVADA"
  | "REJEITADA";

type Solicitacao = {
  id: string;
  usuarioId: string;
  dataSolicitada: string;
  motivo: string;
  status: Status;
  criadoEm: string;
  revisadoEm: string | null;

  documento?: {
    id: string;
    mimeType: string;
    tamanhoBytes: number;
    criadoEm: string;
  } | null;

  usuario: {
    nome: string;
    nomeDeUsuario: string;
    email: string;
    dataNascimento: string | null;
  };
};

type Decisao = "APROVAR" | "REJEITAR";

const BASE =
  `${API.BASE_URL}/api/admin/correcoes-nascimento`;

function obterToken(): string {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function dataCivil(valor?: string | null): string {
  if (!valor) return "Não informada";

  const iso = valor.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return "Data inválida";
  }

  const [ano, mes, dia] = iso.split("-");

  return `${dia}/${mes}/${ano}`;
}

function dataHora(valor?: string | null): string {
  if (!valor) return "—";

  const data = new Date(valor);

  return Number.isFinite(data.getTime())
    ? data.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "—";
}

async function respostaJson(res: Response) {
  return res.json().catch(() => null);
}

function mensagemErro(
  res: Response,
  dados: any
): string {
  if (res.status === 401) {
    return "Sessão expirada. Entre novamente.";
  }

  if (res.status === 403) {
    return "Você não possui permissão para esta ação.";
  }

  if (
    dados?.code ===
    "PRIMARY_GUARDIAN_REQUIRED_FOR_BIRTH_DATE"
  ) {
    return (
      "O atleta ficará com menos de 12 anos. " +
      "Regularize o responsável principal antes de aprovar."
    );
  }

  if (dados?.code === "BIRTH_DOCUMENT_REQUIRED") {
    return "O usuário ainda não anexou o documento.";
  }

  if (
    dados?.code === "BIRTH_DOCUMENT_NOT_REVIEWED"
  ) {
    return (
      "Baixe e confira o documento com esta " +
      "conta administrativa antes da aprovação."
    );
  }

  if (dados?.code === "REQUEST_ALREADY_DECIDED") {
    return "Esta solicitação já foi decidida.";
  }

  return String(
    dados?.message ||
    dados?.code ||
    `Erro HTTP ${res.status}`
  );
}

export default function CorrecoesNascimentoAdmin() {
  const [solicitacoes, setSolicitacoes] =
    useState<Solicitacao[]>([]);

  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);

  const [carregando, setCarregando] =
    useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [selecionada, setSelecionada] =
    useState<Solicitacao | null>(null);

  const [decisao, setDecisao] =
    useState<Decisao>("APROVAR");

  const [motivoDecisao, setMotivoDecisao] =
    useState("");

  const [verificacaoRef, setVerificacaoRef] =
    useState("");

  const [
    confirmacaoDocumental,
    setConfirmacaoDocumental,
  ] = useState(false);

  const [salvando, setSalvando] =
    useState(false);

  const [baixandoId, setBaixandoId] =
    useState<string | null>(null);

  const carregar = useCallback(
    async (signal?: AbortSignal) => {
      setCarregando(true);
      setErro("");

      try {
        const params = new URLSearchParams({
          pagina: String(pagina),
        });

        if (status) {
          params.set("status", status);
        }

        const res = await fetch(
          `${BASE}?${params.toString()}`,
          {
            headers: {
              Authorization:
                `Bearer ${obterToken()}`,
            },
            signal,
          }
        );

        const dados = await respostaJson(res);

        if (!res.ok) {
          throw new Error(
            mensagemErro(res, dados)
          );
        }

        if (
          !Array.isArray(dados?.solicitacoes)
        ) {
          throw new Error(
            "Resposta inválida do servidor."
          );
        }

        if (!signal?.aborted) {
          setSolicitacoes(
            dados.solicitacoes
          );
        }
      } catch (e) {
        if (!signal?.aborted) {
          setErro(
            e instanceof Error
              ? e.message
              : "Falha ao carregar solicitações."
          );

          setSolicitacoes([]);
        }
      } finally {
        if (!signal?.aborted) {
          setCarregando(false);
        }
      }
    },
    [pagina, status]
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void carregar(controller.signal);

    return () => {
      controller.abort();
    };
  }, [carregar]);

  function abrir(
    item: Solicitacao,
    tipo: Decisao
  ) {
    setSelecionada(item);
    setDecisao(tipo);
    setMotivoDecisao("");
    setVerificacaoRef("");
    setConfirmacaoDocumental(false);
    setErro("");
    setSucesso("");
  }

  async function baixarDocumento(
    item: Solicitacao
  ) {
    setBaixandoId(item.id);
    setErro("");

    try {
      const res = await fetch(
        `${BASE}/${encodeURIComponent(item.id)}/documento`,
        {
          headers: {
            Authorization:
              `Bearer ${obterToken()}`,
          },
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const dados =
          await respostaJson(res);

        throw new Error(
          mensagemErro(res, dados)
        );
      }

      const blob = await res.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        blob.type === "application/pdf"
          ? "comprovante-nascimento.pdf"
          : blob.type === "image/png"
            ? "comprovante-nascimento.png"
            : "comprovante-nascimento.jpg";

      document.body.appendChild(link);

      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível baixar o documento."
      );
    } finally {
      setBaixandoId(null);
    }
  }

  async function confirmar() {
    if (!selecionada || salvando) {
      return;
    }

    const motivo =
      motivoDecisao.trim();

    const referencia =
      verificacaoRef.trim();

    if (
      motivo.length < 10 ||
      motivo.length > 1000
    ) {
      setErro(
        "A justificativa deve ter de 10 a 1000 caracteres."
      );
      return;
    }

    if (
      decisao === "APROVAR" &&
      (
        !confirmacaoDocumental ||
        referencia.length < 8 ||
        referencia.length > 200
      )
    ) {
      setErro(
        "Confirme a conferência e informe uma referência de 8 a 200 caracteres."
      );
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const acao =
        decisao === "APROVAR"
          ? "aprovar"
          : "recusar";

      const res = await fetch(
        `${BASE}/${encodeURIComponent(selecionada.id)}/${acao}`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${obterToken()}`,
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            motivoDecisao: motivo,

            ...(decisao === "APROVAR"
              ? {
                  verificacaoRef:
                    referencia,

                  confirmacaoDocumental:
                    true,
                }
              : {}),
          }),
        }
      );

      const dados = await respostaJson(res);

      if (!res.ok) {
        throw new Error(
          mensagemErro(res, dados)
        );
      }

      setSelecionada(null);

      setSucesso(
        decisao === "APROVAR"
          ? "Correção aprovada e auditada."
          : "Correção recusada e auditada."
      );

      await carregar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Falha ao registrar decisão."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-xl font-bold text-green-950">
          Correções de nascimento
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          Consulte as solicitações, confira os
          documentos e registre a decisão.
          Apenas superadministradores podem
          baixar comprovantes e decidir.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Situação

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPagina(1);
            }}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">
              Pendentes e em análise
            </option>

            <option value="PENDENTE_VERIFICACAO">
              Pendente
            </option>

            <option value="EM_ANALISE">
              Em análise
            </option>

            <option value="APROVADA">
              Aprovada
            </option>

            <option value="REJEITADA">
              Recusada
            </option>
          </select>
        </label>

        <button
          type="button"
          disabled={carregando}
          onClick={() => void carregar()}
          className="rounded-lg border border-green-800 px-4 py-2 text-green-900 disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

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

      {carregando && (
        <p className="text-sm text-gray-600">
          Carregando solicitações...
        </p>
      )}

      {!carregando &&
        solicitacoes.length === 0 && (
          <p className="text-sm text-gray-500">
            Nenhuma solicitação encontrada.
          </p>
        )}

      <div className="space-y-3">
        {solicitacoes.map((item) => {
          const aberta =
            item.status ===
              "PENDENTE_VERIFICACAO" ||
            item.status === "EM_ANALISE";

          return (
            <article
              key={item.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <h4 className="font-semibold">
                {item.usuario.nome} (@
                {item.usuario.nomeDeUsuario})
              </h4>

              <p className="text-sm text-gray-600">
                {item.usuario.email}
              </p>

              <p className="mt-2 text-sm">
                <strong>Data atual:</strong>{" "}
                {dataCivil(
                  item.usuario.dataNascimento
                )}
              </p>

              <p className="text-sm">
                <strong>Data solicitada:</strong>{" "}
                {dataCivil(
                  item.dataSolicitada
                )}
              </p>

              <p className="text-sm">
                <strong>Status:</strong>{" "}
                {item.status.replace(/_/g, " ")}
              </p>

              <p className="text-sm">
                <strong>Criada:</strong>{" "}
                {dataHora(item.criadoEm)}
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm">
                <strong>Motivo:</strong>{" "}
                {item.motivo}
              </p>

              <p className="mt-2 text-sm">
                <strong>Documento:</strong>{" "}
                {item.documento
                  ? "Recebido"
                  : "Não anexado"}
              </p>

              {item.documento && (
                <button
                  type="button"
                  disabled={
                    baixandoId === item.id
                  }
                  onClick={() =>
                    void baixarDocumento(item)
                  }
                  className="mt-2 rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 disabled:opacity-50"
                >
                  {baixandoId === item.id
                    ? "Baixando..."
                    : "Baixar comprovante"}
                </button>
              )}

              {aberta && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!item.documento}
                    onClick={() =>
                      abrir(item, "APROVAR")
                    }
                    className="rounded-lg bg-green-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Aprovar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      abrir(item, "REJEITAR")
                    }
                    className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Recusar
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 text-sm">
        <button
          type="button"
          disabled={pagina <= 1 || carregando}
          onClick={() =>
            setPagina((p) =>
              Math.max(1, p - 1)
            )
          }
          className="rounded-lg border px-3 py-2 disabled:opacity-40"
        >
          Anterior
        </button>

        <span>Página {pagina}</span>

        <button
          type="button"
          disabled={
            solicitacoes.length < 20 ||
            carregando
          }
          onClick={() =>
            setPagina((p) => p + 1)
          }
          className="rounded-lg border px-3 py-2 disabled:opacity-40"
        >
          Próxima
        </button>
      </div>

      {selecionada && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-correcao"
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <h4
              id="titulo-correcao"
              className="text-lg font-bold"
            >
              {decisao === "APROVAR"
                ? "Aprovar correção"
                : "Recusar correção"}
            </h4>

            <p className="text-sm">
              {selecionada.usuario.nome}
              {" — "}
              {dataCivil(
                selecionada.usuario
                  .dataNascimento
              )}
              {" → "}
              {dataCivil(
                selecionada.dataSolicitada
              )}
            </p>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">
                Justificativa (10–1000 caracteres)
              </span>

              <textarea
                value={motivoDecisao}
                onChange={(e) =>
                  setMotivoDecisao(
                    e.target.value
                  )
                }
                maxLength={1000}
                rows={4}
                className="w-full rounded-lg border p-3"
              />
            </label>

            {decisao === "APROVAR" && (
              <>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">
                    Referência da verificação
                  </span>

                  <input
                    value={verificacaoRef}
                    onChange={(e) =>
                      setVerificacaoRef(
                        e.target.value
                      )
                    }
                    maxLength={200}
                    placeholder="ID do processo documental"
                    className="w-full rounded-lg border p-3"
                  />
                </label>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      confirmacaoDocumental
                    }
                    onChange={(e) =>
                      setConfirmacaoDocumental(
                        e.target.checked
                      )
                    }
                    className="mt-1"
                  />

                  <span>
                    Confirmo que baixei e
                    conferi o documento,
                    comparando a data nele
                    com a data solicitada.
                  </span>
                </label>
              </>
            )}

            {erro && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={salvando}
                onClick={() => {
                  setSelecionada(null);
                  setErro("");
                }}
                className="rounded-lg border px-4 py-2"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  void confirmar()
                }
                className="rounded-lg bg-green-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {salvando
                  ? "Salvando..."
                  : decisao === "APROVAR"
                    ? "Confirmar aprovação"
                    : "Confirmar recusa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}