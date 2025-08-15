import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  Heart,
  MessageCircle,
  Share,
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

interface Midia {
  id: string;
  url: string;
  tipo: "video" | "imagem";
}

interface Desafio {
  id: string;
  titulo: string;
  nivel: string;
  pontos: number;
  categoria: string[];
  imagemUrl?: string;
}

interface Usuario {
  nome: string;
  foto?: string;
}

interface Atleta {
  id: string;
  usuario: Usuario;
}

interface Submissao {
  id: string;
  desafio: Desafio;
  atleta: Atleta;
  midias: Midia[];
  createdAt: string;
  usuarioId: string;
}

const DesafiosPage: React.FC = () => {
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [filtroSeguindo, setFiltroSeguindo] = useState(false);
  const [filtroNivel, setFiltroNivel] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [seguindoIds, setSeguindoIds] = useState<string[]>([]);

  const token = Storage.token;

  useEffect(() => {
    const fetchSubmissoesEseguindo = async () => {
      try {
        const [submissoesRes, seguindoRes] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/desafios/submissoes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API.BASE_URL}/api/seguidores/meus-seguidos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setSubmissoes(submissoesRes.data);
        setSeguindoIds(seguindoRes.data);

        console.log("Submissões carregadas:", submissoesRes.data.length);
        console.log("IDs que sigo:", seguindoRes.data);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    fetchSubmissoesEseguindo();
  }, [token]);

  const seguindoSet = useMemo(() => {
    return new Set(seguindoIds.map((id) => id.toLowerCase()));
  }, [seguindoIds]);

  const submissoesFiltradas = useMemo(() => {
    console.log("Filtro Seguindo ativo?", filtroSeguindo);
    return submissoes.filter((s) => {
      const nivelOk = !filtroNivel || s.desafio.nivel.toLowerCase() === filtroNivel;
      const categoriaOk = !filtroCategoria || s.desafio.categoria.includes(filtroCategoria);
      const usuarioIdLower = s.usuarioId.toLowerCase();
      const seguindoOk = !filtroSeguindo || seguindoSet.has(usuarioIdLower);

      console.log(`Submissão ${s.id} do usuario ${s.usuarioId} (lower: ${usuarioIdLower}) - seguindoOk: ${seguindoOk}`);

      return nivelOk && categoriaOk && seguindoOk;
    });
  }, [submissoes, filtroNivel, filtroCategoria, filtroSeguindo, seguindoSet]);

  return (
    <div className="max-w-3xl mx-auto p-4 ">
      <h1 className="text-2xl font-bold mb-4">Desafios dos Atletas</h1>

      <button
        onClick={() => setMostrarFiltros(!mostrarFiltros)}
        className="flex items-center gap-2 mb-2"
      >
        {mostrarFiltros ? "Esconder filtros" : "Mostrar filtros"}
        {mostrarFiltros ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {mostrarFiltros && (
        <div className="flex flex-wrap gap-4 mb-4 items-center">

          <button
            className={`px-4 py-2 rounded-full border ${
              filtroSeguindo ? "bg-green-500 text-white" : "bg-white text-gray-700"
            }`}
            onClick={() => {
              setFiltroSeguindo((prev) => {
                console.log("Filtro Seguindo mudou para:", !prev);
                return !prev;
              });
            }}
          >
            {filtroSeguindo ? "Seguindo ✓" : "Seguindo"}
          </button>

          <select
            className="px-3 py-2 border rounded-full"
            value={filtroNivel ?? ""}
            onChange={(e) => setFiltroNivel(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">Todos os níveis</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
          </select>

          <select
            className="px-3 py-2 border rounded-full"
            value={filtroCategoria ?? ""}
            onChange={(e) => setFiltroCategoria(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {Array.from(new Set(submissoes.flatMap((s) => s.desafio.categoria))).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

      {submissoesFiltradas.length === 0 ? (
        <p className="text-gray-500">Nenhuma submissão encontrada.</p>
      ) : (
        submissoesFiltradas.map((sub) => {
          const midia = sub.midias[0];
          const isVideo = midia?.tipo.toLowerCase() === "video";

          return (
            <div key={sub.id} className="bg-white shadow rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <img
                  src={
                    sub.atleta.usuario.foto
                      ? `${API.BASE_URL}${sub.atleta.usuario.foto}`
                      : "/default-profile.png"
                  }
                  alt="Perfil"
                  className="w-10 h-10 rounded-full mr-3 object-cover"
                />
                <div>
                  <p className="font-semibold">{sub.atleta.usuario.nome}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(sub.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>

              <h2 className="text-lg font-bold">{sub.desafio.titulo}</h2>
              <div className="flex flex-wrap gap-2 text-sm my-2">
                <span className="bg-gray-200 px-2 py-1 rounded">Nível: {sub.desafio.nivel}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {sub.desafio.pontos} pontos
                </span>
                {sub.desafio.categoria.map((cat, idx) => (
                  <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    {cat}
                  </span>
                ))}
              </div>

              {midia && (
                <div className="mt-3 mb-4">
                  {isVideo ? (
                    <video
                      src={`${API.BASE_URL}${midia.url}`}
                      controls
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <img
                      src={`${API.BASE_URL}${midia.url}`}
                      alt="Submissão"
                      className="w-full rounded-lg"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-gray-600 mt-2">
                <div className="flex items-center gap-1 cursor-pointer">
                  <Heart className="w-4 h-4" />
                  <span>Gostei</span>
                </div>
                <div className="flex items-center gap-1 cursor-pointer">
                  <MessageCircle className="w-4 h-4" />
                  <span>Comentar</span>
                </div>
                <div className="flex items-center gap-1 cursor-pointer">
                  <Share className="w-4 h-4" />
                  <span>Compartilhar</span>
                </div>
              </div>
            </div>
          );
        })
      )}

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
};

export default DesafiosPage;