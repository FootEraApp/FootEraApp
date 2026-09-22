import {
  useEffect,
  useState,
} from "react";

import * as QRCode from "qrcode";

import {
  Copy,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";

import {
  toast,
} from "@/lib/toast";

type Props = {
  open: boolean;
  titulo: string;
  url: string;
  onClose: () => void;
};

export default function PublicQrModal({
  open,
  titulo,
  url,
  onClose,
}: Props) {
  const [
    qrDataUrl,
    setQrDataUrl,
  ] = useState("");

  const [
    gerando,
    setGerando,
  ] = useState(false);

  useEffect(() => {
    if (
      !open ||
      !url
    ) {
      setQrDataUrl("");
      return;
    }

    let ativo =
      true;

    async function gerarQr() {
      try {
        setGerando(
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
          "[PublicQrModal] Erro ao gerar QR:",
          error
        );

        if (ativo) {
          setQrDataUrl("");
        }
      } finally {
        if (ativo) {
          setGerando(
            false
          );
        }
      }
    }

    void gerarQr();

    return () => {
      ativo = false;
    };
  }, [
    open,
    url,
  ]);

  if (!open) {
    return null;
  }

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

  return (
    <div
      className="
        fixed
        inset-0
        z-[140]
        flex
        items-center
        justify-center
        bg-black/55
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
            QR Code
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
          {gerando ? (
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
              copiarLink
            }
            className="
              inline-flex
              min-h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-emerald-600
              px-3
              py-2
              text-sm
              font-semibold
              text-white
              hover:bg-emerald-700
            "
          >
            <Copy className="h-4 w-4" />

            Copiar link
          </button>

          <a
            href={
              url
            }
            className="
              inline-flex
              min-h-11
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-emerald-200
              bg-emerald-50
              px-3
              py-2
              text-sm
              font-semibold
              text-emerald-800
              hover:bg-emerald-100
            "
          >
            <ExternalLink className="h-4 w-4" />

            Abrir
          </a>
        </div>

        <p className="mt-3 text-center text-xs text-zinc-500">
          Escaneie para abrir este conteúdo no FootEra.
        </p>
      </div>
    </div>
  );
}