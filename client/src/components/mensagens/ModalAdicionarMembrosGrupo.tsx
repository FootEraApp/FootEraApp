import { toast } from "@/lib/toast";
import { useEffect, useMemo, useState } from "react";
import { API, APP } from "../../config.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

type Usuario = {
  id: string;
  nome: string;
  foto?: string | null;
};

interface Props {
  aberto: boolean;
  onFechar: () => void;
  token: string;
  usuarioId: string;
  grupoId: string;
  membrosAtuaisIds: string[];
  onConfirmar: (membrosIds: string[]) => Promise<void> | void;
}

function getAvatarSrc(foto?: string | null) {
  if (!foto || !foto.trim()) return AVATAR_FALLBACK;
  if (foto.startsWith("http://") || foto.startsWith("https://")) return foto;
  return `${API.BASE_URL}${foto}`;
}

export function ModalAdicionarMembrosGrupo({
  aberto,
  onFechar,
  token,
  usuarioId,
  grupoId,
  membrosAtuaisIds,
  onConfirmar,
}: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;

    async function carregar() {
      try {
        const res = await fetch(`${API.BASE_URL}/api/grupos/${grupoId}/usuarios-adicionaveis`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erro ao carregar contatos");
        const data: Usuario[] = await res.json();
        setUsuarios(data);
        setSelecionados(new Set());
      } catch (err) {
        console.error(err);
        setUsuarios([]);
      }
    }

    setBusca("");
    carregar();
  }, [aberto, token, grupoId]);

  const usuariosDisponiveis = useMemo(() => {
    const membrosSet = new Set(membrosAtuaisIds);
    return usuarios.filter((u) => !membrosSet.has(u.id) && u.id !== usuarioId);
  }, [usuarios, membrosAtuaisIds, usuarioId]);

  const usuariosFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return usuariosDisponiveis;
    return usuariosDisponiveis.filter((u) =>
      (u.nome || "").toLowerCase().includes(term)
    );
  }, [busca, usuariosDisponiveis]);

  function toggleUsuario(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmar() {
    const ids = Array.from(selecionados);
    if (ids.length === 0) {
      toast.error("Selecione ao menos um usuário.");
      return;
    }

    try {
      setSalvando(true);
      await onConfirmar(ids);
      onFechar();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-zinc-900">Adicionar membros</h2>
          <button
            type="button"
            onClick={onFechar}
            className="text-zinc-500 hover:text-zinc-800 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar usuário..."
            className="w-full border rounded-xl px-4 py-2 text-sm"
          />

          <div className="max-h-[45vh] overflow-y-auto border rounded-xl p-3 space-y-2">
            {usuariosFiltrados.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhum usuário disponível para adicionar.</p>
            )}

            {usuariosFiltrados.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-3 rounded-xl border p-2 cursor-pointer hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(u.id)}
                  onChange={() => toggleUsuario(u.id)}
                />

                <img
                  src={getAvatarSrc(u.foto)}
                  alt={u.nome}
                  className="w-10 h-10 rounded-full object-cover border"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = AVATAR_FALLBACK;
                  }}
                />

                <span className="text-sm font-medium text-zinc-800">{u.nome}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-60"
          >
            {salvando ? "Adicionando..." : "Adicionar selecionados"}
          </button>
        </div>
      </div>
    </div>
  );
}