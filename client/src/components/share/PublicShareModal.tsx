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

type UsuarioShare = {
  id: string;
  nome: string;
  foto?: string | null;
};

type DirectTipo =
  | "NORMAL"
  | "POST"
  | "DESAFIO"
  | "USUARIO";

type Props = {
  open: boolean;
  onClose: () => void;

  titulo: string;

  // Ex.: /treino/123
  path: string;

  directTipo?: DirectTipo;

  // POST → id do post
  // USUARIO → id do usuário
  // DESAFIO → id do desafio
  // NORMAL → opcional; usa título + URL se não informar
  directConteudo?: string;

  mostrarDirect?: boolean;
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
  directTipo = "NORMAL",
  directConteudo,
  mostrarDirect = true,
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

  const token =
    lerToken();

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

        const response =
          await fetch(
            `${API.BASE_URL}/api/seguidores/mutuos`,
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

  async function copiar() {
    try {
      await navigator.clipboard
        .writeText(url);

      toast.success(
        "Link copiado!"
      );
    } catch {
      toast.error(
        "Não foi possível copiar o link."
      );
    }
  }

  function whatsapp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        `${titulo}\n${url}`
      )}`,
      "_blank",
      "noopener,noreferrer"
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
          url,
        });

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
                Você ainda não possui contatos mútuos.
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
                          w-[76px]
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
  );
}