import {
  MapPin,
  ShieldCheck,
} from "lucide-react";

import {
  publicImgUrl,
} from "../../utils/publicUrl.js";

type Props = {
  usuarioId:
    string;

  usuario?: {
    nome?:
      string | null;

    nomeDeUsuario?:
      string | null;

    foto?:
      string | null;

    verified?:
      boolean;

    cidade?:
      string | null;

    estado?:
      string | null;
  } | null;

  dadosEspecificos?:
    Record<
      string,
      any
    > | null;
};

export default function PerfilResponsavelPublico({
  usuarioId,
  usuario,
  dadosEspecificos,
}: Props) {
  const nome =
    String(
      dadosEspecificos
        ?.nome ??
      usuario?.nome ??
      "Responsável"
    ).trim() ||
    "Responsável";

  const username =
    String(
      usuario
        ?.nomeDeUsuario ??
      ""
    )
      .replace(
        /^@/,
        ""
      )
      .trim();

  const foto =
    publicImgUrl(
      dadosEspecificos
        ?.foto ??
      usuario?.foto ??
      null
    );

  const cidade =
    String(
      dadosEspecificos
        ?.cidade ??
      usuario?.cidade ??
      ""
    ).trim();

  const estado =
    String(
      dadosEspecificos
        ?.estado ??
      usuario?.estado ??
      ""
    ).trim();

  const local =
    [
      cidade,
      estado,
    ]
      .filter(
        Boolean
      )
      .join(" - ");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gray-100">
            {foto ? (
              <img
                src={foto}
                alt={nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400">
                {nome
                  .slice(
                    0,
                    1
                  )
                  .toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-gray-950">
                {nome}
              </h1>

              {usuario?.verified && (
                <ShieldCheck
                  size={18}
                  className="shrink-0 text-green-700"
                />
              )}
            </div>

            {username && (
              <p className="mt-1 text-sm text-gray-500">
                @{username}
              </p>
            )}
            
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="break-all text-xs text-gray-500">
                ID: {usuarioId}
              </span>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(usuarioId);
                }}
                className="rounded-lg border border-green-200 px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-50"
              >
                Copiar ID
              </button>
            </div>

            <div className="mt-3 inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
              Responsável
            </div>

            {local && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
                <MapPin
                  size={15}
                />

                <span>
                  {local}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <h2 className="font-semibold text-gray-900">
            Perfil de responsável
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            Este usuário possui um perfil de Responsável na FootEra.
          </p>
        </div>
      </section>
    </div>
  );
}