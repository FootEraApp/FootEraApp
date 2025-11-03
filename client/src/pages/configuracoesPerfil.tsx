// client/src/pages/configuracoesPerfil.tsx
import { Switch } from "../components/ui/switch.js";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export default function ConfiguracoesPerfil() {
  const [, setLocation] = useLocation();
  const [visivel, setVisivel] = useState(true);
  const [mensagens, setMensagens] = useState(true);
  const [mostrarEmail, setMostrarEmail] = useState(false);

  // Frase de confirmação (case-sensitive)
  const REQUIRED_PHRASE = "Excluir Conta Footera";

  // modal excluir conta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = Storage.token;
    if (!token) {
      setLocation("/login");
      return;
    }
  }, []);

  function confirmarLogout() {
    if (confirm("Tem certeza que deseja sair?")) {
      localStorage.clear();
      sessionStorage.clear();
      setLocation("/login");
    }
  }

  async function excluirConta(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    try {
      setDeleting(true);
      const resp = await fetch(`${API.REST}/configuracoes/minha-conta`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Storage.token}`,
        },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });

      if (resp.status === 204) {
        localStorage.clear();
        sessionStorage.clear();
        alert("Conta excluída com sucesso.");
        setLocation("/login");
        return;
      }

      const data = await resp.json().catch(() => ({}));
      setDeleteError(data?.message || "Não foi possível excluir a conta.");
    } catch {
      setDeleteError("Erro ao conectar com o servidor.");
    } finally {
      setDeleting(false);
    }
  }

  const matchConfirm = confirmText.trim() === REQUIRED_PHRASE;

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <header className="bg-green-900 text-white text-center py-3 text-xl font-bold">FOOTERA</header>

      <Link
        href="/perfil"
        aria-label="Voltar para perfil"
        className="inline-flex h-10 w-10 items-center justify-center
          rounded-full border border-green-800 bg-white text-green-900
          shadow-sm hover:bg-green-50 focus:outline-none
          focus:ring-2 focus:ring-green-700/30 mt-2 ml-2 mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* ----- Conta ----- */}
      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Conta</h2>
        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🛡️ Privacidade</p>
            <p className="text-sm text-gray-600">Gerencie quem pode ver seu perfil</p>
          </div>
          <button className="text-green-800 font-semibold">Configurar</button>
        </div>

        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🔔 Notificações</p>
            <p className="text-sm text-gray-600">Controle quais notificações receber</p>
          </div>
          <button className="text-green-800 font-semibold">Gerenciar</button>
        </div>

        <div className="flex justify-between py-2 items-start">
          <div>
            <p className="font-semibold">🔑 Segurança</p>
            <p className="text-sm text-gray-600">Alterar senha ou configurações de acesso</p>
          </div>
          <button className="text-green-800 font-semibold">Alterar</button>
        </div>
      </div>

      {/* ----- Dados e Privacidade ----- */}
      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Dados e Privacidade</h2>

        <div className="flex justify-between items-center py-3 border-b">
          <span className="font-medium">Perfil Visível para Todos</span>
          <Switch checked={visivel} onCheckedChange={setVisivel} />
        </div>

        <div className="flex justify-between items-center py-3 border-b">
          <span className="font-medium">Permitir Mensagens Diretas</span>
          <Switch checked={mensagens} onCheckedChange={setMensagens} />
        </div>

        <div className="flex justify-between items-center py-3">
          <span className="font-medium">Mostrar E-mail no Perfil</span>
          <Switch checked={mostrarEmail} onCheckedChange={setMostrarEmail} />
        </div>
      </div>

      {/* ----- Ações da Conta (Sair) ----- */}
      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Ações da Conta</h2>
        <button
          onClick={confirmarLogout}
          className="w-full flex items-center justify-center gap-2 border border-red-600 text-red-600 py-2 rounded-md hover:bg-red-50"
        >
          <span>↪️</span> Sair
        </button>
      </div>

      {/* ----- QUADRADO ESPECÍFICO: Excluir Conta ----- */}
      <div className="mx-4 mb-4 rounded-xl shadow bg-red-50 border border-red-200 p-4">
        <h3 className="text-red-700 font-bold text-lg">Excluir conta</h3>
        <p className="text-sm text-red-700 mt-1">
          Esta ação é <strong>irreversível</strong>. Todos os seus dados e conteúdos serão removidos.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            🗑️ Excluir conta
          </button>
          <span className="text-xs text-red-600/80 self-center sm:self-auto">
            Para confirmar, você terá que digitar{" "}
            <span className="font-semibold">"{REQUIRED_PHRASE}"</span>.
          </span>
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold text-red-600">Excluir conta</h3>

            <p className="text-sm text-gray-700 mt-2">
              Para confirmar a exclusão permanente, digite exatamente{" "}
              <span className="font-semibold text-gray-900">"{REQUIRED_PHRASE}"</span> no campo abaixo
              e clique em <span className="font-semibold">Excluir</span>.
            </p>

            <form onSubmit={excluirConta} className="mt-4">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`Digite ${REQUIRED_PHRASE} para confirmar`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-red-200"
                required
              />

              {deleteError && (
                <div className="mt-2 text-sm text-red-600">{deleteError}</div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  disabled={deleting || !matchConfirm}
                  title={
                    matchConfirm
                      ? "Excluir conta"
                      : `Digite exatamente "${REQUIRED_PHRASE}" para habilitar`
                  }
                >
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
}
