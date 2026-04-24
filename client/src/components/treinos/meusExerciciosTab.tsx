import { useEffect, useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { API } from "../../config.js";
import ExercicioCard, { type ExercicioItem } from "./exercicioCard.js";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export default function MeusExerciciosTab() {
  const [items, setItems] = useState<ExercicioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [somenteFavoritos, setSomenteFavoritos] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [faixaEtariaFiltro, setFaixaEtariaFiltro] = useState("Todos");
  const [nivelFiltro, setNivelFiltro] = useState("Todos");

  async function carregar() {
    try {
      setLoading(true);
      setErro("");

      const token = getToken();
      if (!token) {
        throw new Error("Usuário não autenticado.");
      }

      const params = new URLSearchParams();
      if (busca.trim()) params.set("busca", busca.trim());
      if (somenteFavoritos) params.set("favorito", "true");
      if (tipoFiltro !== "Todos") params.set("tipo", tipoFiltro);
      if (faixaEtariaFiltro !== "Todos") params.set("faixaEtaria", faixaEtariaFiltro);
      if (nivelFiltro !== "Todos") params.set("nivel", nivelFiltro);

      const res = await fetch(
        `${API.BASE_URL}/api/exercicios/meus?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao carregar exercícios.");
      }

      setItems(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar exercícios.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      carregar();
    }, busca.trim() ? 250 : 0);

    return () => clearTimeout(timer);
  }, [busca, somenteFavoritos, tipoFiltro, faixaEtariaFiltro, nivelFiltro]);

  async function handleDuplicar(id: string) {
    try {
      const token = getToken();

      const res = await fetch(`${API.BASE_URL}/api/exercicios/${id}/duplicar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao duplicar exercício.");
      }

      await carregar();
    } catch (e: any) {
      alert(e?.message || "Erro ao duplicar exercício.");
    }
  }

  async function handleFavoritar(id: string, favoritoAtual: boolean) {
    try {
      const token = getToken();

      const novoFavorito = !favoritoAtual;

      const res = await fetch(`${API.BASE_URL}/api/exercicios/${id}/favoritar`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          favorito: novoFavorito,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Erro ao favoritar exercício.");
      }

      setItems((prev) => {
        // se estiver na aba Favoritos e o item foi desfavoritado,
        // ele some imediatamente da lista
        if (somenteFavoritos && !novoFavorito) {
          return prev.filter((item) => item.id !== id);
        }

        return prev.map((item) =>
          item.id === id ? { ...item, favorito: novoFavorito } : item
        );
      });
    } catch (e: any) {
      alert(e?.message || "Erro ao favoritar exercício.");
    }
  }

  async function handleExcluir(id: string) {
    try {
      const token = getToken();

      const confirmar = window.confirm("Tem certeza que deseja excluir este exercício?");
      if (!confirmar) return;

      const res = await fetch(`${API.BASE_URL}/api/exercicios/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || "Erro ao excluir exercício.");
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir exercício.");
    }
  }

  function handleEditar(id: string) {
    window.location.href = `/treinos/exercicios/editar/${id}`;
  }

  function handleNovo() {
    window.location.href = `/treinos/exercicios/novo`;
  }

  function handleUsarNoTreino(item: ExercicioItem) {
    const atuais = JSON.parse(
      sessionStorage.getItem("treino_exercicios_preselecionados") || "[]"
    ) as ExercicioItem[];

    const semDuplicar = [...atuais.filter((x) => x.id !== item.id), item];

    sessionStorage.setItem(
      "treino_exercicios_preselecionados",
      JSON.stringify(semDuplicar)
    );

    window.location.href = "/treinos?aba=treino";
  }

  const totalTexto = useMemo(() => {
    if (loading) return "Carregando...";
    if (!items.length) return "Nenhum exercício cadastrado.";
    return `${items.length} exercício${items.length > 1 ? "s" : ""}`;
  }, [items, loading]);

  return (
    <section className="space-y-5">
      <div className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-[#173D34]">
              Meus Exercícios
            </h2>
            <p className="mt-1 text-gray-600">
              Cadastre seus exercícios para montar treinos customizados.
            </p>
            <p className="mt-2 text-sm text-gray-500">{totalTexto}</p>
          </div>

          <button
            type="button"
            onClick={handleNovo}
            className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#0D6A43] px-5 py-4 font-semibold text-white hover:bg-[#0B5A39]"
          >
            <Plus size={22} />
            Novo exercício
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou código"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-[#0D6A43]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSomenteFavoritos(false)}
              className={`rounded-xl border px-4 py-3 font-medium ${
                !somenteFavoritos
                  ? "border-[#0D6A43] bg-[#EAF7F0] text-[#0D6A43]"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              Todos
            </button>

            <button
              type="button"
              onClick={() => setSomenteFavoritos(true)}
              className={`rounded-xl border px-4 py-3 font-medium ${
                somenteFavoritos
                  ? "border-[#0D6A43] bg-[#EAF7F0] text-[#0D6A43]"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              Favoritos
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#0D6A43]"
            >
              <option value="Todos">Tipo: Todos</option>
              <option value="Tecnico">Técnico</option>
              <option value="Fisico">Físico</option>
              <option value="Tatico">Tático</option>
              <option value="Mental">Mental</option>
            </select>

            <select
              value={faixaEtariaFiltro}
              onChange={(e) => setFaixaEtariaFiltro(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#0D6A43]"
            >
              <option value="Todos">Faixa etária: Todas</option>
              <option value="Sub3">Sub-3</option>
              <option value="Sub5">Sub-5</option>
              <option value="Sub7">Sub-7</option>
              <option value="Sub9">Sub-9</option>
              <option value="Sub11">Sub-11</option>
              <option value="Sub13">Sub-13</option>
              <option value="Sub15">Sub-15</option>
              <option value="Sub16">Sub-16</option>
              <option value="Livre">Livre</option>
            </select>

            <select
              value={nivelFiltro}
              onChange={(e) => setNivelFiltro(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#0D6A43]"
            >
              <option value="Todos">Nível: Todos</option>
              <option value="Base">Base</option>
              <option value="Avancado">Avançado</option>
              <option value="Performance">Performance</option>
            </select>
          </div>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="rounded-[20px] border border-gray-200 bg-white p-6 text-gray-500">
          Carregando exercícios...
        </div>
      ) : !items.length ? (
        <div className="rounded-[20px] border border-gray-200 bg-white p-6 text-gray-500">
          {somenteFavoritos
            ? "Você não possui exercícios favoritos."
            : "Você ainda não cadastrou nenhum exercício."}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ExercicioCard
              key={item.id}
              item={item}
              onDuplicar={handleDuplicar}
              onEditar={handleEditar}
              onFavoritar={handleFavoritar}
              onExcluir={handleExcluir}
              onUsarNoTreino={handleUsarNoTreino}
            />
          ))}
        </div>
      )}
    </section>
  );
}