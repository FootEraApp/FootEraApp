import { Switch } from "../components/ui/switch.js";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import Atualizacoes from "../components/Atualizacoes.js";
import BottomNav from "@/components/layout/BottomNav.js";

type FeedbackTipo = "sugestao" | "bug";

export default function ConfiguracoesPerfil() {
  const [, setLocation] = useLocation();
  const [visivel, setVisivel] = useState(true);
  const [mensagens, setMensagens] = useState(true);
  const [mostrarEmail, setMostrarEmail] = useState(false);

  const REQUIRED_PHRASE = "Excluir Conta Footera";

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTipo, setFeedbackTipo] = useState<FeedbackTipo>("sugestao");
  const [feedbackMensagem, setFeedbackMensagem] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

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

  async function enviarFeedback(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const mensagem = feedbackMensagem.trim();
    if (!mensagem) {
      setFeedbackError("Digite uma mensagem antes de enviar.");
      return;
    }

    try {
      setFeedbackSending(true);

      const resp = await fetch(`${API.REST}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Storage.token}`,
        },
        body: JSON.stringify({
          tipo: feedbackTipo,
          mensagem,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.message || "Não foi possível enviar seu feedback.");
      }

      setFeedbackSuccess("Feedback enviado com sucesso! Obrigado por ajudar a melhorar a FootEra ⚽");
      setFeedbackMensagem("");
    } catch (err: any) {
      setFeedbackError(err?.message || "Erro ao enviar seu feedback.");
    } finally {
      setFeedbackSending(false);
    }
  }

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

      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-1">Atualizações e Feedback</h2>
        <p className="text-sm text-gray-600 mb-3">
          Veja o que mudou na FootEra e nos conte como podemos melhorar a plataforma. 🚀
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowUpdatesModal(true)}
            className="w-full sm:w-1/2 inline-flex items-center justify-center rounded-md border border-green-700 text-green-800 px-3 py-2 text-sm font-semibold hover:bg-green-50"
          >
            📅 Ver últimas atualizações
          </button>

          <button
            type="button"
            onClick={() => {
              setShowFeedbackModal(true);
              setFeedbackError(null);
              setFeedbackSuccess(null);
            }}
            className="w-full sm:w-1/2 inline-flex items-center justify-center rounded-md bg-green-700 text-white px-3 py-2 text-sm font-semibold hover:bg-green-800"
          >
            💬 Enviar feedback / reportar erro
          </button>
        </div>
      </div>

      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Ações da Conta</h2>
        <button
          onClick={confirmarLogout}
          className="w-full flex items-center justify-center gap-2 border border-red-600 text-red-600 py-2 rounded-md hover:bg-red-50"
        >
          <span>↪️</span> Sair
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-xl shadow bg-white border border-red-200 p-4">
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

      {showUpdatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Novidades da FootEra</h3>
              <button
                type="button"
                onClick={() => setShowUpdatesModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-1 mb-3">
              Acompanhe o que mudou em cada versão da plataforma. Sempre que sair uma atualização,
              vamos listar aqui o que foi melhorado, corrigido ou lançado. 🙂
            </p>

            <div className="mt-1 flex-1 overflow-y-auto border-t pt-3">
              <Atualizacoes />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowUpdatesModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Enviar feedback / reportar erro</h3>
              <button
                type="button"
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackError(null);
                  setFeedbackSuccess(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-1">
              Sua opinião ajuda a deixar a FootEra cada vez melhor. Conte pra gente o que deu errado
              ou o que você sente falta na plataforma. ⚽✨
            </p>

            <form onSubmit={enviarFeedback} className="mt-4 space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Tipo de mensagem</span>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackTipo("sugestao")}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      feedbackTipo === "sugestao"
                        ? "border-green-700 bg-green-50 text-green-800 font-semibold"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    💡 Sugestão
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackTipo("bug")}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      feedbackTipo === "bug"
                        ? "border-red-600 bg-red-50 text-red-700 font-semibold"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    🐞 Erro / Bug
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Mensagem
                </label>
                <textarea
                  rows={5}
                  value={feedbackMensagem}
                  onChange={(e) => setFeedbackMensagem(e.target.value)}
                  placeholder={
                    feedbackTipo === "bug"
                      ? "Conte o que você estava fazendo, em qual tela, e o que aconteceu de estranho..."
                      : "Conte o que você gostaria de ver na FootEra, melhorias, novas funções..."
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200 resize-none"
                  required
                />
              </div>

              {feedbackError && (
                <div className="text-sm text-red-600">{feedbackError}</div>
              )}

              {feedbackSuccess && (
                <div className="text-sm text-green-700">{feedbackSuccess}</div>
              )}

              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setFeedbackError(null);
                    setFeedbackSuccess(null);
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                  disabled={feedbackSending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-green-700 text-white hover:bg-green-800 text-sm disabled:opacity-60"
                  disabled={feedbackSending}
                >
                  {feedbackSending ? "Enviando..." : "Enviar feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />

    </div>
  );
}
