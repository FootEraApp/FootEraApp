import {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import * as QRCode from "qrcode";

import {
  Ban,
  Copy,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import {
  toast,
} from "@/lib/toast";

import {
  API,
} from "../../config.js";

import {
  PUBLIC_PATHS,
  publicAppUrl,
} from "../../utils/publicRoutes.js";

type Props = {
  open: boolean;

  token:
    | string
    | null;

  titulo: string;

  onClose:
    () => void;

  onTokenChange:
    (
      token:
        string
    ) => void;
    
  onDisabled?:
    () => void;
};

function lerTokenAuth() {
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

export default function ConviteQrModal({
  open,
  token,
  titulo,
  onClose,
  onTokenChange,
  onDisabled,
}: Props) {
  const [
    qrDataUrl,
    setQrDataUrl,
  ] = useState("");

  const [
    gerandoQr,
    setGerandoQr,
  ] = useState(false);

  const [
    renovando,
    setRenovando,
  ] = useState(false);

  const [
    desativando,
    setDesativando,
  ] = useState(false);

  const url =
    useMemo(
      () =>
        token
          ? publicAppUrl(
              PUBLIC_PATHS.join(
                token
              )
            )
          : "",
      [token]
    );

  useEffect(() => {
    if (
      !open ||
      !token ||
      !url
    ) {
      setQrDataUrl("");
      return;
    }

    let ativo =
      true;

    async function gerar() {
      try {
        setGerandoQr(
          true
        );

        const dataUrl =
          await QRCode.toDataURL(
            url,
            {
              width: 320,
              margin: 2,
              errorCorrectionLevel:
                "M",
            }
          );

        if (ativo) {
          setQrDataUrl(
            dataUrl
          );
        }
      } catch (
        error
      ) {
        console.error(
          "[ConviteQrModal] Erro ao gerar QR:",
          error
        );

        if (ativo) {
          setQrDataUrl("");
        }
      } finally {
        if (ativo) {
          setGerandoQr(
            false
          );
        }
      }
    }

    void gerar();

    return () => {
      ativo = false;
    };
  }, [
    open,
    token,
    url,
  ]);

  if (
    !open ||
    !token
  ) {
    return null;
  }

  const conviteToken = token;

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(
        url
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

  async function renovar() {
    const confirmar =
      window.confirm(
        "Renovar este QR Code? O QR/link atual deixará de funcionar e um novo será criado."
      );

    if (!confirmar) {
      return;
    }

    const authToken =
      lerTokenAuth();

    if (!authToken) {
      toast.error(
        "Sua sessão expirou. Entre novamente."
      );

      return;
    }

    try {
      setRenovando(
        true
      );

      const {
        data,
      } =
        await axios.post(
          `${API.BASE_URL}/api/convites/${encodeURIComponent(
            conviteToken
          )}/renovar`,
          {
            expiresInDays:
              30,
          },
          {
            headers: {
              Authorization:
                `Bearer ${authToken}`,
            },
          }
        );

      const novoToken =
        String(
          data?.token ??
            data?.convite
              ?.token ??
            ""
        ).trim();

      if (!novoToken) {
        throw new Error(
          "O servidor não retornou o novo token."
        );
      }

      onTokenChange(
        novoToken
      );

      toast.success(
        "QR Code renovado!"
      );
    } catch (
      error: any
    ) {
      console.error(
        "[ConviteQrModal] renovar:",
        error
      );

      toast.error(
        error?.response?.data
          ?.message ||
          error?.response?.data
            ?.error ||
          error?.message ||
          "Não foi possível renovar o QR Code."
      );
    } finally {
      setRenovando(
        false
      );
    }
  }

  async function desativar() {
    const confirmar =
      window.confirm(
        "Desativar este convite? O QR Code e o link deixarão de funcionar."
      );

    if (!confirmar) {
      return;
    }

    const authToken =
      lerTokenAuth();

    if (!authToken) {
      toast.error(
        "Sua sessão expirou. Entre novamente."
      );

      return;
    }

    try {
      setDesativando(
        true
      );

      await axios.post(
        `${API.BASE_URL}/api/convites/${encodeURIComponent(
          conviteToken
        )}/cancelar`,
        {},
        {
          headers: {
            Authorization:
              `Bearer ${authToken}`,
          },
        }
      );

      toast.success(
        "Convite e QR Code desativados."
      );

      onDisabled?.();
      onClose();
    } catch (
      error: any
    ) {
      console.error(
        "[ConviteQrModal] desativar:",
        error
      );

      toast.error(
        error?.response?.data
          ?.message ||
          error?.response?.data
            ?.error ||
          error?.message ||
          "Não foi possível desativar o convite."
      );
    } finally {
      setDesativando(
        false
      );
    }
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-[130]
        flex
        items-center
        justify-center
        bg-black/50
        p-4
      "
      onClick={
        onClose
      }
    >
      <div
        className="
          relative
          w-full
          max-w-md
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
            text-zinc-500
            hover:bg-zinc-100
          "
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-10 text-center">
          <h2 className="text-lg font-bold text-green-950">
            QR Code do convite
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {titulo}
          </p>
        </div>

        <div
          className="
            mt-5
            flex
            min-h-[320px]
            items-center
            justify-center
            rounded-2xl
            border
            border-zinc-200
            bg-white
            p-4
          "
        >
          {gerandoQr ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Gerando QR Code...
            </div>
          ) : qrDataUrl ? (
            <img
              src={
                qrDataUrl
              }
              alt={`QR Code - ${titulo}`}
              className="
                h-auto
                w-full
                max-w-[320px]
              "
            />
          ) : (
            <p className="text-sm text-red-600">
              Não foi possível gerar o QR Code.
            </p>
          )}
        </div>

        <div
          className="
            mt-4
            rounded-xl
            border
            border-zinc-200
            bg-zinc-50
            p-3
          "
        >
          <p
            className="
              break-all
              text-xs
              text-zinc-600
            "
          >
            {url}
          </p>
        </div>

        <button
          type="button"
          onClick={
            copiarLink
          }
          className="
            mt-3
            inline-flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-emerald-600
            px-4
            py-3
            text-sm
            font-semibold
            text-white
            hover:bg-emerald-700
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
          "
        >
          <button
            type="button"
            onClick={
              renovar
            }
            disabled={
              renovando ||
              desativando
            }
            className="
              inline-flex
              min-h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-amber-200
              bg-amber-50
              px-3
              py-2
              text-sm
              font-semibold
              text-amber-800
              hover:bg-amber-100
              disabled:opacity-60
            "
          >
            {renovando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            Renovar
          </button>

          <button
            type="button"
            onClick={
              desativar
            }
            disabled={
              renovando ||
              desativando
            }
            className="
              inline-flex
              min-h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-3
              py-2
              text-sm
              font-semibold
              text-red-700
              hover:bg-red-100
              disabled:opacity-60
            "
          >
            {desativando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}

            Desativar
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-zinc-500">
          O QR Code abre exatamente o mesmo convite /join/:token.
        </p>
      </div>
    </div>
  );
}