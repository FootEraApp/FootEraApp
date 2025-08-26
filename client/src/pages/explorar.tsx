import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

type UsuarioBasic = { id: string; nome: string; foto?: string | null };
type AtletaItem = { id: string; usuario: UsuarioBasic; usuarioId?: string; foto?: string | null; tipoTreino?: string | null };
type ProfessorItem = { id: string; usuario: UsuarioBasic; foto?: string | null };
type ClubeItem = { id: string; nome: string; cidade?: string | null; estado?: string | null; logo?: string | null };
type EscolaItem = { id: string; nome: string; cidade?: string | null; estado?: string | null; logo?: string | null; siteOficial?: string | null };
type DesafioItem = { id: string; titulo: string; imagemUrl?: string | null };

type DadosExplorar = {
  atletas: AtletaItem[];
  professores: ProfessorItem[];
  clubes: ClubeItem[];
  escolas: EscolaItem[];
  desafios: DesafioItem[];
};

function Explorar() {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"atletas" | "escolas" | "clubes" | "desafios" | "professores">("atletas");
  const [dados, setDados] = useState<DadosExplorar>({ atletas: [], professores: [], clubes: [], escolas: [], desafios: [] });

  const loggedUserId = useMemo(
    () =>
      (Storage?.usuarioId ??
        (typeof window !== "undefined" ? localStorage.getItem("usuarioId") : "") ??
        "") as string,
    []
  );

  const filtrarEu = useMemo(
    () => <T extends { usuario?: { id?: string }; usuarioId?: string; id?: string }>(arr: T[]) =>
      arr.filter((x) => {
        const uid = (x.usuario?.id ?? x.usuarioId ?? x.id ?? "") as string;
        return uid !== loggedUserId;
      }),
    [loggedUserId]
  );

  useEffect(() => {
    const token =
      Storage?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : "");

    axios
      .get(`${API.BASE_URL}/api/explorar`, {
        params: { q: busca, excludeUsuarioId: loggedUserId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then(({ data }) => {
        setDados({
          atletas: filtrarEu<AtletaItem>(data.atletas || []),
          professores: filtrarEu<ProfessorItem>(data.professores || []),
          clubes: (data.clubes || []) as ClubeItem[],
          escolas: (data.escolas || []) as EscolaItem[],
          desafios: (data.desafios || []) as DesafioItem[],
        });
      })
      .catch((e) => {
        console.error(e);
        setDados({ atletas: [], professores: [], clubes: [], escolas: [], desafios: [] });
      });
  }, [busca, loggedUserId, filtrarEu]);

  const abas: Array<["atletas" | "escolas" | "clubes" | "desafios" | "professores", string]> = [
    ["atletas", "Atletas"],
    ["escolas", "Escolas"],
    ["clubes", "Clubes"],
    ["desafios", "Desafios"],
    ["professores", "Profissionais"],
  ];

  return (
    <div className="min-h-screen bg-cream text-green-900">
      <div className="bg-green-900 p-4 text-white text-center text-2xl font-bold">FOOTERA</div>

      <div className="p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar"
          className="w-full p-2 rounded border"
        />
      </div>

      <div className="flex justify-around mb-2 px-2">
        {abas.map(([tab, label]) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-center rounded-t-lg text-sm ${
              aba === tab ? "bg-white font-bold border-b-2 border-green-900" : "bg-green-100"
            }`}
            onClick={() => setAba(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-24">
        {aba === "atletas" && (
          <>
            <h2 className="text-xl font-bold my-2">Atletas em Destaque</h2>
            <div className="grid grid-cols-2 gap-3">
              {dados.atletas.map((a) => {
                const foto = formatarUrlFoto(a.foto ?? a.usuario?.foto) || "/placeholder.png";
                return (
                  <Link href={`/perfil/${a.usuario.id}`} key={a.id}>
                    <div className="bg-white rounded shadow p-2 flex flex-col items-center">
                      <img src={foto} alt={`${a.usuario.nome} profile`} className="w-24 h-24 rounded-full object-cover" />
                      <p className="mt-2 font-medium">{a.usuario.nome}</p>
                      {a.tipoTreino && (
                        <span className="mt-1 text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-800">
                          {a.tipoTreino}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {aba === "escolas" && (
          <>
            <h2 className="text-xl font-bold my-4">Escolas de Futebol</h2>
            <div className="space-y-3">
              {dados.escolas.map((e) => {
                const logo = formatarUrlFoto(e.logo) || "/placeholder.png";
                return (
                  <div key={e.id} className="bg-white rounded shadow p-3 flex items-center gap-3">
                    <img src={logo} alt="Logo da escola" className="w-16 h-16 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold">{e.nome}</h3>
                      <p className="text-sm text-gray-600">
                        {e.cidade ?? "Cidade"}{e.estado ? `, ${e.estado}` : ""}
                      </p>
                      <p className="text-sm">{e.siteOficial || "Site indisponível"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aba === "clubes" && (
          <>
            <h2 className="text-xl font-bold my-4">Clubes</h2>
            <div className="space-y-3">
              {dados.clubes.map((c) => {
                const logo = formatarUrlFoto(c.logo) || "/placeholder.png";
                return (
                  <div key={c.id} className="bg-white rounded shadow p-3 flex items-center gap-3">
                    <img src={logo} alt="Logo do clube" className="w-16 h-16 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold">{c.nome}</h3>
                      <p className="text-sm text-gray-600">
                        {c.cidade ?? "Cidade"}{c.estado ? `, ${c.estado}` : ""}
                      </p>
                      <p className="text-sm">Clube Profissional</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aba === "desafios" && (
          <>
            <h2 className="text-xl font-bold my-4">Desafios</h2>
            <div className="grid grid-cols-2 gap-3">
              {dados.desafios.map((d) => {
                const img = formatarUrlFoto(d.imagemUrl) || "/placeholder.png";
                return (
                  <div key={d.id} className="bg-white rounded shadow p-2 flex flex-col items-center">
                    <img src={img} alt={d.titulo} className="w-24 h-24 object-cover rounded-full" />
                    <p className="mt-2 text-center text-sm">{d.titulo}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aba === "professores" && (
          <>
            <h2 className="text-xl font-bold my-4">Profissionais</h2>
            {dados.professores.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {dados.professores.map((p) => {
                  const foto = formatarUrlFoto(p.usuario?.foto) || "/placeholder.png";
                  return (
                    <Link href={`/perfil/${p.usuario.id}`} key={p.id}>
                      <div className="bg-white rounded shadow p-2 flex flex-col items-center">
                        <img src={foto} alt="Foto do usuário" className="w-24 h-24 rounded-full object-cover" />
                        <p className="mt-2 font-medium">{p.usuario.nome}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-600">Nenhum profissional encontrado</p>
            )}
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline"><House /></Link>
        <Link href="/explorar" className="hover:underline"><Search /></Link>
        <Link href="/post" className="hover:underline"><CirclePlus /></Link>
        <Link href="/treinos" className="hover:underline"><Volleyball /></Link>
        <Link href="/perfil" className="hover:underline"><User /></Link>
      </nav>
    </div>
  );
}

export default Explorar;