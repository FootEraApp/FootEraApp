import { toast } from "@/lib/toast";
import { useState, useEffect } from "react";
import { API, APP } from "../../config.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

interface Usuario {
  id: string;
  nome: string;
  foto?: string;
}

interface GrupoParaLista {
  id: string;
  nome: string;
  descricao?: string | null;
  ownerId: string;
  totalMembros?: number;
  ultimaMensagem?: string | null;
  ultimaMensagemTipo?: string | null;
  ultimaMensagemEm?: string | null;
}

interface GrupoRespostaApi {
  id: string;
  nome: string;
  descricao?: string | null;
  ownerId: string;
  membros?: Array<{
    usuarioId?: string;
    usuario?: Usuario;
  }>;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onGrupoCriado?: (grupo: GrupoParaLista) => void;
  usuarioId: string;
  token: string;
}

function getAvatarSrc(foto?: string) {
  if (!foto || !foto.trim()) return AVATAR_FALLBACK;
  if (foto.startsWith("http://") || foto.startsWith("https://")) return foto;
  return `${API.BASE_URL}${foto}`;
}

export function ModalGrupos({ aberto, onFechar, onGrupoCriado, usuarioId, token }: Props) {
  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [descricaoGrupo, setDescricaoGrupo] = useState("");
  const [membrosSelecionados, setMembrosSelecionados] = useState<Set<string>>(new Set([usuarioId]));
  const [criando, setCriando] = useState(false);
  const [buscaMembro, setBuscaMembro] = useState("");
  const selecionadosCount = membrosSelecionados.size;
 
  useEffect(() => {
    if (!aberto) return;

    async function fetchSeguidoresMutuos() {
      try {
        const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar seguidores mútuos");
        const data: Usuario[] = await res.json();
        setUsuariosMutuos(data);
      } catch (err) {
        console.error(err);
      }
    }

    setNomeGrupo("");
    setDescricaoGrupo("");
    setBuscaMembro("");
    setMembrosSelecionados(new Set([usuarioId]));  

    fetchSeguidoresMutuos();
  }, [aberto, token, usuarioId]);

  function toggleMembro(id: string) {
    if (id === usuarioId) return;

    setMembrosSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      novo.add(usuarioId);
      return novo;
    });
  }

  function normalizarTexto(texto: string) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  const termoBuscaNormalizado = normalizarTexto(buscaMembro);

  const usuariosFiltrados = usuariosMutuos.filter((usuario) =>
    normalizarTexto(usuario.nome).includes(termoBuscaNormalizado)
  );

  async function criarGrupo() {
    const nomeLimpo = nomeGrupo.trim();
    const descricaoLimpa = descricaoGrupo.trim();

    if (!nomeLimpo) {
      toast.error("Informe um nome para o grupo");
      return;
    }

    if (!usuarioId) {
      toast.error("Sessão inválida. Entre novamente.");
      return;
    }

    if (criando) return;

    const membros = Array.from(
      new Set<string>([
        usuarioId,
        ...membrosSelecionados,
      ])
    );

    try {
      setCriando(true);

      const res = await fetch(`${API.BASE_URL}/api/grupos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: nomeLimpo,
          descricao: descricaoLimpa || undefined,
          membros,
        }),
      });

      const data: GrupoRespostaApi | { error?: string } | null =
        await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Erro ao criar grupo"
        );
      }

      if (!data || !("id" in data) || !data.id) {
        throw new Error(
          "O grupo foi criado, mas a resposta do servidor é inválida."
        );
      }

      const novoGrupo: GrupoParaLista = {
        id: data.id,
        nome: data.nome,
        descricao: data.descricao ?? null,
        ownerId: data.ownerId,
        totalMembros: Array.isArray(data.membros)
          ? data.membros.length
          : membros.length,
        ultimaMensagem: null,
        ultimaMensagemTipo: null,
        ultimaMensagemEm: null,
      };

      onGrupoCriado?.(novoGrupo);

      toast.success("Grupo criado com sucesso!");
      onFechar();
    } catch (err) {
      console.error("Erro ao criar grupo:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao criar grupo"
      );
    } finally {
      setCriando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-50"
      onClick={onFechar}
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[80vh] rounded-lg p-6 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Criar Grupo</h2>
          <button onClick={onFechar} className="text-gray-500 hover:text-gray-700 font-bold text-2xl">
            &times;
          </button>
        </header>

        <div className="grid gap-3 mb-4">
          <input
            type="text"
            placeholder="Nome do grupo"
            value={nomeGrupo}
            onChange={(e) => setNomeGrupo(e.target.value)}
            className="border p-2 rounded w-full"
          />

          <textarea
            placeholder="Descrição (opcional)"
            value={descricaoGrupo}
            onChange={(e) => setDescricaoGrupo(e.target.value)}
            className="border p-2 rounded resize-none h-20 w-full"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">Selecione membros:</p>

            <span className="text-sm text-gray-500">
              {selecionadosCount} selecionado(s)
            </span>
          </div>

          <div className="relative mb-3">
            <input
              type="text"
              value={buscaMembro}
              onChange={(event) => setBuscaMembro(event.target.value)}
              placeholder="Buscar membro pelo nome..."
              className="
                w-full border rounded-lg
                px-3 py-2 pr-10
                text-sm
                focus:outline-none
                focus:ring-2
                focus:ring-green-600
                focus:border-green-600
              "
            />

            {buscaMembro && (
              <button
                type="button"
                onClick={() => setBuscaMembro("")}
                className="
                  absolute right-3 top-1/2
                  -translate-y-1/2
                  text-gray-400
                  hover:text-gray-700
                  text-lg
                "
                title="Limpar busca"
                aria-label="Limpar busca de membros"
              >
                &times;
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto border rounded p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2 select-none opacity-90">
              <input type="checkbox" checked readOnly disabled />
              <img
                src={AVATAR_FALLBACK}
                alt="Você"
                className="w-8 h-8 rounded-full object-cover border"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = AVATAR_FALLBACK;
                }}
              />
              <span className="flex-1">
                você <span className="text-xs text-green-700 font-semibold">(admin/owner)</span>
              </span>
            </label>

            {usuariosMutuos.length === 0 && (
              <p className="sm:col-span-2 text-sm text-gray-500 py-2">
                Nenhum usuário disponível.
              </p>
            )}

            {usuariosMutuos.length > 0 &&
              usuariosFiltrados.length === 0 && (
                <p className="sm:col-span-2 text-sm text-gray-500 py-2">
                  Nenhum membro encontrado para “{buscaMembro}”.
                </p>
              )}

            {usuariosFiltrados.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={membrosSelecionados.has(u.id)}
                  onChange={() => toggleMembro(u.id)}
                  disabled={u.id === usuarioId}
                />
                <img
                  src={getAvatarSrc(u.foto)}
                  alt={u.nome}
                  className="w-8 h-8 rounded-full object-cover border"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = AVATAR_FALLBACK;
                  }}
                />
                <span className="flex-1">
                  {u.nome}
                  {u.id === usuarioId && (
                    <span className="ml-2 text-xs text-green-700 font-semibold">(admin/owner)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void criarGrupo()}
          disabled={criando}
          className="
            bg-green-600 text-white px-4 py-2 rounded
            hover:bg-green-700 mt-4 w-full
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          {criando ? "Criando grupo..." : "Criar Grupo"}
        </button>
      </div>
    </div>
  );
}