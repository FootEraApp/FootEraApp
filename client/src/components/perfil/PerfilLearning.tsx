import { useEffect, useState } from "react";
import axios from "axios";
import { BookOpen, GraduationCap } from "lucide-react";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

export default function PerfilLearning({ idDaUrl }: { idDaUrl?: string }) {
  const [data, setData] = useState<any>(null);
  const token = Storage.token;
  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const id = isOwn ? "me" : idDaUrl;

  useEffect(() => {
    if (!token || !id) return;

    axios
      .get(`${API.BASE_URL}/api/perfil/learning/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [id, token]);

  if (!data) {
    return <div className="p-10 text-center text-red-600">Perfil Learning não encontrado.</div>;
  }

  const usuario = data.usuario ?? {};

  return (
    <div className="min-h-screen bg-[#f5f2e8] pb-24">
      <div className="bg-green-900 text-white p-8 text-center">
        <div className="mx-auto w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
          <GraduationCap size={44} />
        </div>
        <h1 className="text-3xl font-extrabold">{usuario.nome ?? "Learning"}</h1>
        <p className="text-white/80 mt-2">Conta Learning</p>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-5 grid gap-4">
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="text-xl font-bold text-green-900 mb-2">Meus cursos e conteúdos</h2>
          <p className="text-green-900/70">
            Aqui ficam os cursos, lives, webinars e metodologias comprados ou assinados.
          </p>
        </section>

        <section className="bg-white rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <BookOpen className="text-green-700" />
            <div>
              <h3 className="font-bold text-green-900">Progresso salvo</h3>
              <p className="text-sm text-green-900/70">
                O usuário pode pausar, continuar e receber certificado ao concluir.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}