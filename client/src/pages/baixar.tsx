import { useEffect } from "react";
import { ExternalLink, Smartphone } from "lucide-react";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=br.app.footera";

export default function BaixarPage() {
  useEffect(() => {
    document.title = "Baixe o FootEra";

    window.location.replace(PLAY_STORE_URL);
  }, []);

  return (
    <main className="min-h-screen bg-[#169c36] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 text-center shadow-xl">
        <img
          src="/icon-180.png"
          alt="FootEra"
          className="w-24 h-24 rounded-2xl mx-auto mb-5"
        />

        <h1 className="text-3xl font-bold text-green-900">
          FootEra
        </h1>

        <p className="mt-3 text-gray-600">
          Redirecionando para a Google Play...
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Smartphone size={17} />
          Disponível para Android
        </div>

        <a
          href={PLAY_STORE_URL}
          className="mt-6 inline-flex items-center gap-2 font-semibold text-[#169c36] hover:underline"
        >
          Abrir Google Play
          <ExternalLink size={16} />
        </a>
      </div>
    </main>
  );
}