import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Copy,
  Mail,
  Send,
  Share2,
  X,
  QrCode,
} from "lucide-react";

import {
  toast,
} from "@/lib/toast";

import {
  API,
} from "../../config.js";

import {
  publicAppUrl,
} from "../../utils/publicRoutes.js";

import {
  publicImgUrl,
} from "../../utils/publicUrl.js";

import PublicQrModal from "./PublicQrModal.js";

type UsuarioShare = {
  id: string;
  nome: string;
  foto?: string | null;
  tipo?: string | null;
  papeis?: string[];
};

export type PapelDestinatario =
  | "Atleta"
  | "Professor"
  | "Clube"
  | "Escolinha"
  | "Escola"
  | "Olheiro"
  | "Marca"
  | "Federacao"
  | "Learning"
  | "Creator";
  
type DirectTipo =
  | "NORMAL"
  | "POST"
  | "DESAFIO"
  | "USUARIO";

export type ShareAction =
  | "copiar"
  | "whatsapp"
  | "email"
  | "nativo"
  | "footera"
  | "direct"
  | "qrcode";

type Props = {
  open: boolean;
  onClose: () => void;
  titulo: string;
  path: string;
  directTipo?: DirectTipo;
  mensagemWhatsApp?: string;
  directConteudo?: string;
  mostrarDirect?: boolean;
  destinatarioPapel?: PapelDestinatario;
  destinatarioPapeis?: PapelDestinatario[];
  onAction?: (
    action: ShareAction
  ) => void | Promise<void>;
};

const FOTO_FALLBACK =
  "/assets/usuarios/footera-logo-fundo-verde.png";

function lerToken() {
  return (
    localStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    ""
  );
}

export default function PublicShareModal({
  open,
  onClose,
  titulo,
  path,
  mensagemWhatsApp,
  directTipo = "NORMAL",
  directConteudo,
  mostrarDirect = true,
  destinatarioPapel,
  onAction,
  destinatarioPapeis,
}: Props) {
  const [
    usuarios,
    setUsuarios,
  ] = useState<UsuarioShare[]>(
    []
  );

  const [
    selecionados,
    setSelecionados,
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [
    enviando,
    setEnviando,
  ] = useState(false);

  const [
    qrOpen,
    setQrOpen,
  ] = useState(false);

  const token =
    lerToken();

  const papeisDestino =
    Array.from(
      new Set([
        ...(destinatarioPapeis ?? []),

        ...(destinatarioPapel
          ? [destinatarioPapel]
          : []),
      ])
    ).sort();

  const papeisDestinoKey =
    papeisDestino.join(",");

  const url =
    useMemo(
      () =>
        publicAppUrl(
          path
        ),
      [path]
    );

  useEffect(() => {
    if (!open) {
      setQrOpen(
        false
      );

      return;
    }

    setSelecionados(
      new Set()
    );

    if (
      !token ||
      !mostrarDirect
    ) {
      setUsuarios([]);
      return;
    }

    let ativo = true;

    async function carregar() {
      try {
        setCarregando(true);

        const params =
          new URLSearchParams();

        params.set(
          "modo",
          "convite"
        );

        if (papeisDestinoKey) {
          params.set(
            "papeis",
            papeisDestinoKey
          );
        }

        const query =
          `?${params.toString()}`;

        const response =
          await fetch(
            `${API.BASE_URL}/api/seguidores/mutuos${query}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          response.ok
            ? await response
                .json()
                .catch(
                  () => []
                )
            : [];

        if (!ativo) {
          return;
        }

        setUsuarios(
          Array.isArray(
            data
          )
            ? data
            : []
        );
      } catch {
        if (ativo) {
          setUsuarios([]);
        }
      } finally {
        if (ativo) {
          setCarregando(
            false
          );
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [
    open,
    token,
    mostrarDirect,
    papeisDestinoKey,
  ]);

  if (!open) {
    return null;
  }

  function toggleUsuario(
    id: string
  ) {
    setSelecionados(
      (anterior) => {
        const novo =
          new Set(
            anterior
          );

        if (
          novo.has(id)
        ) {
          novo.delete(id);
        } else {
          novo.add(id);
        }

        return novo;
      }
    );
  }

  async function notificarAcao(
    action: ShareAction
  ) {
    if (!onAction) {
      return;
    }

    try {
      await onAction(action);
    } catch (error) {
      console.error(
        "[PublicShareModal] Erro ao registrar ação:",
        error
      );
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard
        .writeText(url);

      void notificarAcao(
        "copiar"
      );

      toast.success(
        "Link copiado!"
      );
    } catch {
      toast.error(
        "Não foi possível copiar o link."
      );
    }
  }

  function abrirQrCode() {
    void notificarAcao(
      "qrcode"
    );

    setQrOpen(
      true
    );
  }

  function whatsapp() {
    const mensagem =
      String(
        mensagemWhatsApp ||
          titulo
      ).trim();

    const texto =
      `${mensagem}\n\n${url}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        texto
      )}`,
      "_blank",
      "noopener,noreferrer"
    );

    void notificarAcao(
      "whatsapp"
    );
  }

  function email() {
    const subject =
      encodeURIComponent(
        titulo
      );

    const body =
      encodeURIComponent(
        `Confira no FootEra:\n${url}`
      );

    void notificarAcao(
      "email"
    );

    window.location.href =
      `mailto:?subject=${subject}&body=${body}`;
  }

  async function compartilharNativo() {
    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title: titulo,
          text:
            mensagemWhatsApp ||
            titulo,
          url,
        });

        void notificarAcao(
          "nativo"
        );

        return;
      }

      await copiar();
    } catch (
      error: any
    ) {
      if (
        error?.name !==
        "AbortError"
      ) {
        toast.error(
          "Não foi possível compartilhar."
        );
      }
    }
  }

  async function enviarDirect() {
    if (
      !token ||
      selecionados.size ===
        0
    ) {
      return;
    }

    try {
      setEnviando(true);

      await Promise.all(
        Array.from(
          selecionados
        ).map(
          async (
            paraId
          ) => {
            const conteudo =
              directConteudo ??
              (
                directTipo ===
                "NORMAL"
                  ? `${titulo}\n${url}`
                  : path
              );

            const response =
              await fetch(
                `${API.BASE_URL}/api/mensagem`,
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json",

                    Authorization:
                      `Bearer ${token}`,
                  },

                  body:
                    JSON.stringify({
                      paraId,
                      conteudo,
                      tipo:
                        directTipo,
                    }),
                }
              );

            if (
              !response.ok
            ) {
              const data =
                await response
                  .json()
                  .catch(
                    () => ({})
                  );

              throw new Error(
                data?.error ||
                  data?.message ||
                  "Não foi possível enviar."
              );
            }
          }
        )
      );

      await notificarAcao(
        "direct"
      );
      toast.success(
        "Compartilhado pelo Direct!"
      );

      onClose();
    } catch (
      error: any
    ) {
      toast.error(
        error?.message ||
          "Não foi possível enviar pelo Direct."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        bg-black/45
        px-3
        py-4
      "
      onClick={
        onClose
      }
    >
      <div
        className="
          relative
          w-full
          max-w-[480px]
          max-h-[88dvh]
          overflow-y-auto
          rounded-2xl
          bg-white
          p-5
          shadow-2xl
        "
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <button
          type="button"
          onClick={
            onClose
          }
          className="
            absolute
            right-3
            top-3
            rounded-full
            p-2
            text-gray-500
            hover:bg-gray-100
          "
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <h2
          className="
            pr-10
            text-center
            text-lg
            font-bold
            text-green-950
          "
        >
          Compartilhar
        </h2>

        <p
          className="
            mt-1
            text-center
            text-sm
            text-gray-500
          "
        >
          {titulo}
        </p>

        {mostrarDirect && (
          <section className="mt-5">
            <p
              className="
                mb-2
                text-sm
                font-medium
                text-gray-700
              "
            >
              Enviar pelo Direct:
            </p>

            {!token ? (
              <p className="text-sm text-gray-500">
                Entre na FootEra para enviar para seus contatos.
              </p>
            ) : carregando ? (
              <p className="text-sm text-gray-500">
                Carregando contatos...
              </p>
            ) : usuarios.length ===
              0 ? (
              <p className="text-sm text-gray-500">
                {papeisDestino.length > 0
                  ? `Nenhum contato vinculado ou seguidor mútuo com os papéis ${papeisDestino.join(
                      " ou "
                    )} disponível.`
                  : "Você ainda não possui contatos vinculados ou seguidores mútuos."}
              </p>
            ) : (
              <div
                className="
                  flex
                  gap-3
                  overflow-x-auto
                  pb-2
                "
              >
                {usuarios.map(
                  (
                    usuario
                  ) => {
                    const selecionado =
                      selecionados.has(
                        usuario.id
                      );

                    const foto =
                      publicImgUrl(
                        usuario.foto
                      ) ||
                      FOTO_FALLBACK;

                    return (
                      <button
                        key={
                          usuario.id
                        }
                        type="button"
                        onClick={() =>
                          toggleUsuario(
                            usuario.id
                          )
                        }
                        className="
                          w-[92px]
                          shrink-0
                          text-center
                        "
                      >
                        <div
                          className={`
                            mx-auto
                            h-14
                            w-14
                            overflow-hidden
                            rounded-full
                            border-2
                            ${
                              selecionado
                                ? "border-green-600"
                                : "border-transparent"
                            }
                          `}
                        >
                        <img
                            src={foto}
                            alt={usuario.nome}
                            onError={(e) => {
                                e.currentTarget.onerror =
                                null;

                                e.currentTarget.src =
                                FOTO_FALLBACK;
                            }}
                            className="
                                h-full
                                w-full
                                object-cover
                            "
                        />
                        </div>

                        <span
                          className="
                            mt-1
                            block
                            truncate
                            text-xs
                            text-gray-700
                          "
                        >
                          {
                            usuario.nome
                          }
                        </span>
                        {Array.isArray(
                          usuario.papeis
                        ) &&
                          usuario.papeis.length >
                            0 && (
                            <span
                              className="
                                mt-0.5
                                block
                                truncate
                                text-[10px]
                                text-gray-500
                              "
                              title={
                                usuario.papeis.join(
                                  ", "
                                )
                              }
                            >
                              {usuario.papeis.join(
                                " · "
                              )}
                            </span>
                          )}
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {token && (
              <button
                type="button"
                disabled={
                  selecionados.size ===
                    0 ||
                  enviando
                }
                onClick={() =>
                  void enviarDirect()
                }
                className="
                  mt-3
                  inline-flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-green-700
                  px-4
                  py-3
                  font-semibold
                  text-white
                  disabled:bg-gray-300
                  disabled:text-gray-600
                "
              >
                <Send className="h-4 w-4" />

                {enviando
                  ? "Enviando..."
                  : `Enviar para ${selecionados.size} contato(s)`}
              </button>
            )}
          </section>
        )}

        <div className="my-5 border-t" />

        <input
        value={url}
        readOnly
        onFocus={(e) =>
            e.currentTarget.select()
        }
        className="
            w-full
            rounded-xl
            border
            border-gray-300
            bg-white
            px-3
            py-2.5
            text-sm
            text-gray-900
            placeholder:text-gray-400
            selection:bg-green-100
            selection:text-gray-900
        "
        />

        <button
          type="button"
          onClick={() =>
            void copiar()
          }
          className="
            mt-3
            inline-flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-green-700
            px-4
            py-3
            font-semibold
            text-white
            hover:bg-green-800
          "
        >
          <Copy className="h-4 w-4" />
          Copiar link
        </button>

        <button
          type="button"
          onClick={
            abrirQrCode
          }
          className="
            mt-2
            inline-flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-emerald-300
            bg-emerald-50
            px-4
            py-3
            font-semibold
            text-emerald-800
            hover:bg-emerald-100
          "
        >
          <QrCode className="h-5 w-5" />

          Mostrar QR Code
        </button>

        <div
          className="
            mt-3
            grid
            grid-cols-2
            gap-2
            sm:grid-cols-4
          "
        >
          <button
            type="button"
            onClick={
              whatsapp
            }
            className="
              rounded-xl
              bg-green-500
              px-3
              py-3
              text-sm
              font-semibold
              text-white
            "
          >
            WhatsApp
          </button>

          <button
            type="button"
            onClick={
              email
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-1
              rounded-xl
              bg-blue-500
              px-3
              py-3
              text-sm
              font-semibold
              text-white
            "
          >
            <Mail className="h-4 w-4" />
            E-mail
          </button>

          <button
            type="button"
            onClick={() =>
              void compartilharNativo()
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-1
              rounded-xl
              border
              border-green-300
              bg-green-50
              px-3
              py-3
              text-sm
              font-semibold
              text-green-800
            "
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </button>

          <a
            href={url}
            onClick={() => {
            void notificarAcao(
                "footera"
            );
            }}
            className="
              flex
              items-center
              justify-center
              rounded-xl
              border
              border-green-300
              bg-green-100
              px-3
              py-3
              text-center
              text-sm
              font-semibold
              text-green-800
            "
          >
            Ver no FootEra
          </a>
        </div>
      </div>
        </div>

    <PublicQrModal
      open={
        qrOpen
      }
      titulo={
        titulo
      }
      url={
        url
      }
      onClose={() =>
        setQrOpen(
          false
        )
      }
    />
  </>
);
}