import { useEffect, useState } from "react";
import { Link } from "wouter";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import { API } from "../config.js";

 function Explorar() {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("atletas");
  const [dados, setDados] = useState({
    atletas: [],
    clubes: [],
    escolas: [],
    desafios: [],
    professores: []
  });

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/explorar?q=${busca}`)
      .then((res) => res.json())
      .then(setDados)
      .catch(console.error);
  }, [busca]);

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
        {["atletas", "escolas", "clubes", "desafios", "profilers"].map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-center rounded-t-lg text-sm ${
              aba === tab ? "bg-white font-bold border-b-2 border-green-900" : "bg-green-100"
            }`}
            onClick={() => setAba(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 pb-24">
        {aba === "atletas" && (
          <>
            <h2 className="text-xl font-bold my-2">Atletas em Destaque</h2>
            <div className="grid grid-cols-2 gap-3">
              {dados.atletas.map((a: any) => (
                <Link href={`/perfil/${a.usuario.id}`} key={a.id}>
                  <div key={a.id} className="bg-white rounded shadow p-2 flex flex-col items-center">
                    <img
                      src={formatarUrlFoto(a.foto) || "/placeholder.png"}
                      alt={`${a.usuario.nome} profile`}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                    <p className="mt-2 font-medium">{a.usuario.nome}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {aba === "escolas" && (
          <>
            <h2 className="text-xl font-bold my-4">Escolas de Futebol</h2>
            <div className="space-y-3">
              {dados.escolas.map((e: any) => (
                <div key={e.id} className="bg-white rounded shadow p-3 flex items-center gap-3">
                  <img
                    src={formatarUrlFoto(e.logo) || "/placeholder.png"}
                    alt="Logo da escola"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-bold">{e.nome}</h3>
                    <p className="text-sm text-gray-600">{e.cidade}, {e.estado}</p>
                    <p className="text-sm">{e.siteOficial || "Site indisponível"}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {aba === "clubes" && (
          <>
            <h2 className="text-xl font-bold my-4">Clubes</h2>
            <div className="space-y-3">
              {dados.clubes.map((c: any) => (
                <div key={c.id} className="bg-white rounded shadow p-3 flex items-center gap-3">
                  <img
                    src={formatarUrlFoto(c.logo) || "/placeholder.png"}
                    alt="Logo do clube"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-bold">{c.nome}</h3>
                    <p className="text-sm text-gray-600">{c.cidade}, {c.estado}</p>
                    <p className="text-sm">Clube Profissional</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {aba === "desafios" && (
          <>
            <h2 className="text-xl font-bold my-4">Desafios</h2>
            <div className="grid grid-cols-2 gap-3">
              {dados.desafios.map((d: any) => (
                <div key={d.id} className="bg-white rounded shadow p-2 flex flex-col items-center">
                  <img
                    src={formatarUrlFoto(d.imagemUrl) || "/placeholder.png"}
                    alt={d.titulo}
                    className="w-24 h-24 object-cover rounded-full"
                  />
                  <p className="mt-2 text-center text-sm">{d.titulo}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {aba === "profilers" && (
          <>
            <h2 className="text-xl font-bold my-4">Profissionais</h2>
            {dados.professores.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {dados.professores.map((p: any) => (
                <Link href={`/perfil/${p.usuario.id}`} key={p.id}>
                  <div key={p.id} className="bg-white rounded shadow p-2 flex flex-col items-center">
                    <img
                      src={
                        formatarUrlFoto(p.usuario.foto)}
                      alt="Foto do usuário"
                      className="w-24 h-24 rounded-full object-cover"
                    />

                    <p className="mt-2 font-medium">{p.usuario.nome}</p>
                  </div>
                </Link>
              ))}
            </div>
            ) : (
              <p className="text-center text-gray-600">Nenhum profissional encontrado</p>
            )}
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          <House /> 
        </Link>
        <Link href="/explorar" className="hover:underline">
          <Search /> 
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus /> 
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball /> 
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User /> 
        </Link>
      </nav>
    </div>
  );
}

export default Explorar;