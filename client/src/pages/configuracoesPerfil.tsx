// client/src/pages/configuracoesPerfil
import { Switch } from "../components/ui/switch.js";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { API, FLAGS, MESSAGES } from "../config.js";
import Atualizacoes from "../components/Atualizacoes.js";
import BottomNav from "@/components/layout/BottomNav.js";
import socket from "../services/socket.js";
import GoogleButton from "../components/auth/GoogleButton";
import {
  ativarPushNotifications,
  desativarPushNotifications,
  getPushDeviceStatus,
  type PushDeviceStatus,
} from "../services/pushNotifications.js";

type FeedbackTipo = "sugestao" | "bug";

const TUTORIAL_ENABLED = false;

export default function ConfiguracoesPerfil() {
  const [, setLocation] = useLocation();
  const [visivel, setVisivel] = useState(true);
  const [mensagens, setMensagens] = useState(true);
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const [notifMensagens, setNotifMensagens] = useState(true);
  const [notifTreinos, setNotifTreinos] = useState(true);
  const [notifEventos, setNotifEventos] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [showEncerrarModal, setShowEncerrarModal] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [segLoading, setSegLoading] = useState(false);
  const [segMsg, setSegMsg] = useState<string | null>(null);
  const [segErr, setSegErr] = useState<string | null>(null);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenhaNova, setShowSenhaNova] = useState(false);
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
  const [showPrivacidadeModal, setShowPrivacidadeModal] = useState(false);
  const [showNotificacoesModal, setShowNotificacoesModal] = useState(false);
  const [showSegurancaModal, setShowSegurancaModal] = useState(false);
  const [mostrarOnline, setMostrarOnline] = useState(true);
  const [googleLinked, setGoogleLinked] = useState<boolean>(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googlePicture, setGooglePicture] = useState<string | null>(null);
  const [googleLinkedAt, setGoogleLinkedAt] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSuccess, setGoogleSuccess] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [pushErr, setPushErr] = useState<string | null>(null);
  const [pushDeviceStatus, setPushDeviceStatus] = useState<PushDeviceStatus | "checking">("checking");
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [pushHasSubscription, setPushHasSubscription] = useState(false);

  const REQUIRED_PHRASE = "Excluir Conta Footera";

  const tipoUsuario =
    localStorage.getItem("tipoUsuario") ||
    sessionStorage.getItem("tipoUsuario") ||
    localStorage.getItem("usuarioTipoRaw") ||
    sessionStorage.getItem("usuarioTipoRaw") ||
    "";

  const tipoNorm = String(tipoUsuario).toLowerCase();
  const bloqueiaCreator = tipoNorm === "atleta" || tipoNorm === "learning";

  function getToken() {
    return (
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      ""
    );
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLocation("/login");
      return;
    }
  }, []);

    async function apiTrocarSenha() {
      setSegErr(null);
      setSegMsg(null);
      setSegLoading(true);
      try {
        const resp = await fetch(`${API.REST}/configuracoes-perfil/seguranca/senha`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ senhaAtual, senhaNova }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data?.message || "Erro ao trocar senha.");

        setSegMsg("Senha alterada! Você será deslogado para entrar novamente.");
        setSenhaAtual("");
        setSenhaNova("");

        setTimeout(async () => {
        try {
        } finally {
          try { socket?.disconnect(); } catch {}
          localStorage.clear();
          sessionStorage.clear();
          setLocation("/login");
        }
      }, 800);

      } catch (e: any) {
        setSegErr(e?.message || "Erro ao trocar senha.");
      } finally {
        setSegLoading(false);
      }
    }

  async function apiEncerrarSessoes() {
    setSegErr(null);
    setSegMsg(null);
    setSegLoading(true);

    const token = getToken();

    try {
      const resp = await fetch(`${API.REST}/configuracoes-perfil/seguranca/encerrar-sessoes`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || "Erro ao encerrar sessões.");
    } catch (e: any) {
      setSegErr(e?.message || "Erro ao encerrar sessões.");
    } finally {
      try { socket?.disconnect(); } catch {}
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
      setLocation("/login");
      setSegLoading(false);
    }
  }

  async function confirmarLogout() {
    const ok = confirm("Tem certeza que deseja sair?");
    if (!ok) return;

    const token = getToken();

    try {
      if (token) {
        
      }
    } finally {
      try { socket?.disconnect(); } catch {}
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
      setLocation("/login");
    }
  }

  async function carregarPrivacidade() {
    const resp = await fetch(`${API.REST}/configuracoes-perfil/privacidade`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await resp.json().catch(() => ({}));

    setVisivel(data?.perfilVisivel ?? true);
    setMensagens(data?.permitirMensagens ?? true);
    setMostrarEmail(data?.mostrarEmail ?? false);
    setMostrarOnline(data?.mostrarOnline ?? true);
  }

  async function salvarPrivacidade(patch: any) {
    await fetch(`${API.REST}/configuracoes-perfil/privacidade`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(patch),
    });
  }

  async function carregarNotificacoes() {
    const resp = await fetch(`${API.REST}/configuracoes-perfil/notificacoes`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await resp.json();
    setNotifMensagens(!!data.notifMensagens);
    setNotifTreinos(!!data.notifTreinos);
    setNotifEventos(!!data.notifEventos);
    setNotifMarketing(!!data.notifMarketing);
  }

  async function salvarNotificacoes(patch: any) {
    await fetch(`${API.REST}/configuracoes-perfil/notificacoes`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(patch),
    });
  }

  async function atualizarStatusPush(options?: { desativadoManual?: boolean }) {
    try {
      setPushDeviceStatus("checking");

      const status = await getPushDeviceStatus();

      setPushDeviceStatus(status.status);
      setPushPermission(status.permission);
      setPushHasSubscription(status.hasSubscription);

      if (status.status === "subscribed") {
        setPushMsg("Notificações ativadas neste dispositivo ✅");
        setPushErr(null);
        return;
      }

      if (status.status === "denied") {
        setPushMsg(null);
        setPushErr(
          "Notificações bloqueadas no navegador. Para ativar, libere as notificações nas configurações do site."
        );
        return;
      }

      if (status.status === "unsupported") {
        setPushMsg(null);
        setPushErr("Este navegador/dispositivo não suporta notificações push.");
        return;
      }

      if (status.status === "granted_without_subscription") {
        setPushErr(null);
        setPushMsg(
          options?.desativadoManual
            ? "Notificações desativadas neste dispositivo. Você pode ativar novamente quando quiser."
            : "Notificações do sistema ainda não estão ativas neste dispositivo. Clique em Ativar neste navegador para receber avisos fora do site."
        );
        return;
      }

      if (status.status === "default") {
        setPushMsg(
          "Notificações ainda não foram ativadas neste dispositivo. Clique em Ativar neste navegador para escolher."
        );
        setPushErr(null);
        return;
      }

      setPushMsg(null);
      setPushErr(null);
    } catch (e: any) {
      setPushDeviceStatus("default");
      setPushMsg(null);
      setPushErr(e?.message || "Não foi possível verificar o status das notificações.");
    }
  }

  async function testarPushNesteDispositivo() {
    try {
      setPushLoading(true);
      setPushMsg(null);
      setPushErr(null);

      const resp = await fetch(`${API.BASE_URL}/api/notificacoes/push/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(data?.message || "Não foi possível enviar push de teste.");
      }

      const totalDispositivos = Number(
        data?.totalDispositivos ??
          data?.pushSubscriptions ??
          data?.total ??
          0
      );

      if (totalDispositivos > 0) {
        setPushMsg(
          "Push de teste enviado. Verifique as notificações do Windows/Chrome e a página de notificações."
        );
        setPushErr(null);
      } else {
        setPushMsg(null);
        setPushErr(
          "A notificação interna foi criada, mas este navegador ainda não está cadastrado para push. Clique em Ativar neste navegador primeiro."
        );
      }

      await atualizarStatusPush();
    } catch (e: any) {
      setPushMsg(null);
      setPushErr(e?.message || "Erro ao testar push.");
      await atualizarStatusPush();
    } finally {
      setPushLoading(false);
    }
  }

  async function excluirConta(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    try {
      setDeleting(true);
      const resp = await fetch(`${API.REST}/configuracoes/configuracoes/minha-conta`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.ok) {
        localStorage.clear();
        sessionStorage.clear();
        alert(data?.message || "Conta movida para lixeira por 30 dias.");
        setLocation("/login");
        return;
      }

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
          Authorization: `Bearer ${getToken()}`,
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

    async function carregarGoogleStatus() {
    try {
      setGoogleError(null);

      const resp = await fetch(`${API.REST}/configuracoes-perfil/seguranca/google`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(data?.message || "Erro ao carregar status do Google.");
      }

      setGoogleLinked(!!data?.linked);
      setGoogleEmail(data?.googleEmail ?? null);
      setGooglePicture(data?.googlePicture ?? null);
      setGoogleLinkedAt(data?.googleLinkedAt ?? null);
    } catch (e: any) {
      setGoogleError(e?.message || "Erro ao carregar status do Google.");
    }
  }

  async function handleGoogleLink(credential: string) {
    try {
      setGoogleError(null);
      setGoogleSuccess(null);
      setGoogleLoading(true);

      console.log("TOKEN GOOGLE LINK:", getToken());
      const resp = await fetch(`${API.BASE_URL}/api/auth/google/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ credential }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(data?.message || "Não foi possível vincular sua conta Google.");
      }

      setGoogleSuccess(data?.message || "Conta Google vinculada com sucesso.");
      await carregarGoogleStatus();
    } catch (e: any) {
      setGoogleError(e?.message || "Erro ao vincular conta Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function desvincularGoogle() {
    const ok = confirm("Tem certeza que deseja desvincular sua conta Google?");
    if (!ok) return;

    try {
      setGoogleError(null);
      setGoogleSuccess(null);
      setGoogleLoading(true);

      const resp = await fetch(`${API.REST}/configuracoes-perfil/seguranca/google`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        throw new Error(data?.message || "Não foi possível desvincular a conta Google.");
      }

      setGoogleSuccess(data?.message || "Conta Google desvinculada com sucesso.");
      await carregarGoogleStatus();
    } catch (e: any) {
      setGoogleError(e?.message || "Erro ao desvincular conta Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      
      <header className="bg-green-900 text-white py-3 px-3 flex items-center relative">
        <Link
          href="/perfil"
          aria-label="Voltar para perfil"
          className="inline-flex h-10 w-10 items-center justify-center
            rounded-full bg-white/10 text-white
            hover:bg-white/20 focus:outline-none
            focus:ring-2 focus:ring-white/30 z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold pointer-events-none">
          Configurações
        </h1>
      </header>

      <div className="bg-white mx-4 mt-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Conta</h2>
        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🛡️ Privacidade</p>
            <p className="text-sm text-gray-600">Gerencie quem pode ver seu perfil</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setShowPrivacidadeModal(true);
              await carregarPrivacidade();
            }}
            className="text-green-800 font-semibold"
          >
            Configurar
          </button>
        </div>

        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🔔 Notificações</p>
            <p className="text-sm text-gray-600">Controle quais notificações receber</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setShowNotificacoesModal(true);
              await carregarNotificacoes();
              await atualizarStatusPush();
            }}
            className="text-green-800 font-semibold"
          >
            Gerenciar
          </button>
        </div>

        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🔑 Segurança</p>
            <p className="text-sm text-gray-600">Alterar senha ou configurações de acesso</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSegErr(null);
              setSegMsg(null);
              setSenhaAtual("");
              setSenhaNova("");
              setShowSegurancaModal(true);
              setShowSenhaAtual(false);
              setShowSenhaNova(false);
              await carregarGoogleStatus();
            }}
            className="text-green-800 font-semibold"
          >
            Alterar
          </button>
        </div>

        <div className="flex justify-between py-2 items-start">
          <div>
            <p className="font-semibold">💲 Assinaturas</p>
            <p className="text-sm text-gray-600">Ajuste sua assinatura e forma de pagamento</p>
          </div>

          {FLAGS.PAGAMENTOS_ENABLED ? (
            <Link href="/pagamentos" className="text-green-800 font-semibold">
              Alterar
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => alert(MESSAGES.PAGAMENTOS_EM_REFORMULACAO)}
              className="text-green-800 font-semibold"
            >
              Alterar
            </button>
          )}
        </div>

        {tipoNorm === "learning" && (
          <div className="flex justify-between py-3 items-start border-t">
            <div>
              <p className="font-semibold">🔄 Mudar tipo de perfil</p>
              <p className="text-sm text-gray-600">
                Transforme sua conta Learning em atleta, professor, scout ou organização.
              </p>
            </div>

            <Link href="/perfil/mudar-tipo" className="text-green-800 font-semibold">
              Alterar
            </Link>
          </div>
        )}
        {!bloqueiaCreator && (
          <div className="flex justify-between py-2 items-start border-t">
            <div>
              <p className="font-semibold">🎓 Creator</p>
              <p className="text-sm text-gray-600">
                Acesse seu painel de cursos, vendas e metodologias
              </p>
            </div>

            <Link href="/creator/dashboard" className="text-green-800 font-semibold">
              Acessar
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-gray-800 font-bold mb-1">Tutorial</h2>
            <p className="text-sm text-gray-600">
              Aprenda passo a passo como usar a plataforma (criar treinos, gerenciar atletas e mais).
            </p>
            {!TUTORIAL_ENABLED && (
              <p className="text-xs text-orange-700 mt-2 font-semibold">
                🚧 Em breve — este tutorial ainda está em desenvolvimento.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!TUTORIAL_ENABLED}
            onClick={() => setLocation("/treinos/tutorial")}
            className={`shrink-0 px-3 py-2 rounded-md text-sm font-semibold ${
              TUTORIAL_ENABLED
                ? "bg-green-700 text-white hover:bg-green-800"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
            title={TUTORIAL_ENABLED ? "Abrir tutorial" : "Tutorial em breve"}
          >
            {TUTORIAL_ENABLED ? "Acessar" : "Bloqueado"}
          </button>
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
              e clique em <span className="font-semibold">Excluir</span>. Mas caso for necessario você tem 30 dias para restaurar a conta.
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

      {showPrivacidadeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">🛡️ Privacidade</h3>
              <button
                type="button"
                onClick={() => setShowPrivacidadeModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-1 mb-4">
              Ajuste quem pode ver seu perfil e como as pessoas podem interagir com você.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-medium">Perfil Visível para Todos</span>
                <Switch
                    checked={visivel}
                    onCheckedChange={(v) => {
                      setVisivel(v);
                      salvarPrivacidade({ perfilVisivel: v });
                    }}
                  />
              </div>

              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-medium">Permitir Mensagens Diretas</span>
                <Switch
                  checked={mensagens}
                  onCheckedChange={(v) => {
                    setMensagens(v);
                    salvarPrivacidade({ permitirMensagens: v });
                  }}
                />
              </div>

              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-medium">Mostrar Online / Último online</span>
                <Switch
                  checked={mostrarOnline}
                  onCheckedChange={(v) => {
                    setMostrarOnline(v);
                    salvarPrivacidade({ mostrarOnline: v });
                  }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Mostrar E-mail no Perfil</span>
                <Switch
                  checked={mostrarEmail}
                  onCheckedChange={(v) => {
                    setMostrarEmail(v);
                    salvarPrivacidade({ mostrarEmail: v });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotificacoesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">🔔 Notificações</h3>
              <button
                type="button"
                onClick={() => setShowNotificacoesModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-1 mb-4">
              Escolha quais avisos você quer receber.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-medium">Mensagens</span>
                <Switch
                  checked={notifMensagens}
                  onCheckedChange={(v) => {
                    setNotifMensagens(v);
                    salvarNotificacoes({ notifMensagens: v });
                  }}
                />
              </div>

              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-medium">Treinos</span>
                <Switch
                  checked={notifTreinos}
                  onCheckedChange={(v) => {
                    setNotifTreinos(v);
                    salvarNotificacoes({ notifTreinos: v });
                  }}
                />
              </div>

              <div className="flex justify-between items-center border-b pb-3">
                <span className="font-medium">Eventos</span>
                <Switch
                  checked={notifEventos}
                  onCheckedChange={(v) => {
                    setNotifEventos(v);
                    salvarNotificacoes({ notifEventos: v });
                  }}
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Novidades / Marketing</span>
                <Switch
                  checked={notifMarketing}
                  onCheckedChange={(v) => {
                    setNotifMarketing(v);
                    salvarNotificacoes({ notifMarketing: v });
                  }}
                />
                </div>
                <div className="rounded-lg border border-green-100 bg-white p-4 mt-4">
                <div className="font-semibold text-green-900">
                  Notificações no dispositivo
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  Ative para receber avisos mesmo com o site fechado.
                </p>

                {pushMsg && (
                  <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {pushMsg}
                  </div>
                )}

                {pushErr && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {pushErr}
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-500">
                  Permissão do navegador:{" "}
                  <span className="font-semibold">
                    {pushPermission || "verificando"}
                  </span>
                  {" · "}
                  Status no dispositivo:{" "}
                  <span className="font-semibold">
                    {pushDeviceStatus === "checking"
                      ? "verificando"
                      : pushHasSubscription
                      ? "ativo"
                      : "inativo"}
                  </span>
                </div>

                {pushDeviceStatus === "denied" && (
                  <p className="mt-3 text-sm text-red-600 font-medium">
                    ❌ Notificações bloqueadas neste navegador. Para ativar,
                    clique no cadeado ao lado da URL do site e libere notificações.
                    Depois recarregue a página.
                  </p>
                )}

                {pushDeviceStatus === "granted_without_subscription" && (
                  <p className="mt-3 text-sm text-red-600 font-medium">
                    ⚠️ Notificações do sistema não estão ativas neste dispositivo.
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={
                      pushLoading ||
                      pushDeviceStatus === "denied" ||
                      pushDeviceStatus === "unsupported"
                    }
                    onClick={async () => {
                      try {
                        setPushLoading(true);
                        setPushMsg(null);
                        setPushErr(null);

                        await ativarPushNotifications();
                        await atualizarStatusPush();

                        setPushMsg("Notificações ativadas neste dispositivo ✅");
                        setPushErr(null);
                      } catch (e: any) {
                        setPushMsg(null);
                        setPushErr(e?.message || "Não foi possível ativar notificações.");
                        await atualizarStatusPush();
                      } finally {
                        setPushLoading(false);
                      }
                    }}
                    className="rounded-md bg-green-700 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {pushLoading ? "Processando..." : "Ativar neste navegador"}
                  </button>

                  <button
                    type="button"
                    disabled={pushLoading || pushDeviceStatus === "unsupported"}
                    onClick={async () => {
                      try {
                        setPushLoading(true);
                        setPushMsg(null);
                        setPushErr(null);

                        await desativarPushNotifications();
                        await atualizarStatusPush({ desativadoManual: true });

                        setPushMsg(
                          "Notificações desativadas neste dispositivo. Você pode ativar novamente quando quiser."
                        );
                        setPushErr(null);
                      } catch (e: any) {
                        setPushMsg(null);
                        setPushErr(e?.message || "Não foi possível desativar notificações.");
                        await atualizarStatusPush();
                      } finally {
                        setPushLoading(false);
                      }
                    }}
                    className="rounded-md border border-red-200 bg-white px-4 py-2 text-red-600 text-sm font-semibold disabled:opacity-50"
                  >
                    Desativar neste dispositivo
                  </button>

                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={() => atualizarStatusPush()}
                    className="rounded-md border border-gray-200 bg-white px-4 py-2 text-gray-700 text-sm font-semibold disabled:opacity-50"
                  >
                    Verificar status
                  </button>

                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={testarPushNesteDispositivo}
                    className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 text-sm font-semibold disabled:opacity-50"
                  >
                    Enviar teste
                  </button>

                </div>
               </div>
              </div>
             </div>
        </div>
      )}

      {showSegurancaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">🔑 Segurança</h3>
              <button
                type="button"
                onClick={() => setShowSegurancaModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-1 mb-4">
              Troque sua senha ou revise opções de acesso.
            </p>

            <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700 space-y-3">
            <div className="font-semibold">Ações</div>

            <div className="rounded-md border border-gray-200 p-3">
              <div className="font-medium flex items-center gap-2">🔗 Conta Google</div>

              <div className="mt-2 text-xs text-gray-600">
                Vincule sua conta Google para poder entrar com Google e com login normal.
              </div>

              <div className="mt-3 flex items-center gap-3">
                <img
                  src={googlePicture || "/assets/usuarios/footera-logo.png"}
                  alt="Google"
                  className="h-10 w-10 rounded-full object-cover border"
                />

                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {googleLinked ? "Conta Google conectada" : "Conta Google não conectada"}
                  </div>

                  <div className="text-xs text-gray-500">
                    {googleLinked
                      ? googleEmail || "Google vinculado"
                      : "Você ainda não vinculou uma conta Google."}
                  </div>

                  {googleLinkedAt ? (
                    <div className="text-[11px] text-gray-400 mt-1">
                      Vinculada em: {new Date(googleLinkedAt).toLocaleString("pt-BR")}
                    </div>
                  ) : null}
                </div>
              </div>

              {googleError && (
                <div className="mt-3 text-sm text-red-600">{googleError}</div>
              )}

              {googleSuccess && (
                <div className="mt-3 text-sm text-green-700">{googleSuccess}</div>
              )}

              <div className="mt-3">
                {!googleLinked ? (
                  <GoogleButton
                    text="continue_with"
                    onCredential={handleGoogleLink}
                    disabled={googleLoading}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={desvincularGoogle}
                    disabled={googleLoading}
                    className="w-full rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                  >
                    {googleLoading ? "Processando..." : "Desvincular conta Google"}
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-md border border-gray-200 p-3">
              <div className="font-medium flex items-center gap-2">🔒 Trocar senha</div>

              <div className="mt-3 space-y-2">
                <div className="relative">
                  <input
                    type={showSenhaAtual ? "text" : "password"}
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="Senha atual"
                    className="w-full rounded-md border border-gray-300 pl-3 pr-10 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaAtual((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showSenhaAtual ? "Ocultar senha atual" : "Mostrar senha atual"}
                  >
                    {showSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showSenhaNova ? "text" : "password"}
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                    placeholder="Nova senha"
                    className="w-full rounded-md border border-gray-300 pl-3 pr-10 py-2 text-sm outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaNova((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showSenhaNova ? "Ocultar nova senha" : "Mostrar nova senha"}
                  >
                    {showSenhaNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {segErr && <div className="text-sm text-red-600">{segErr}</div>}
                {segMsg && <div className="text-sm text-green-700">{segMsg}</div>}

                <button
                  type="button"
                  onClick={apiTrocarSenha}
                  disabled={segLoading || !senhaAtual || !senhaNova}
                  className="w-full rounded-md bg-green-700 text-white px-3 py-2 text-sm font-semibold hover:bg-green-800 disabled:opacity-60"
                >
                  {segLoading ? "Salvando..." : "Salvar nova senha"}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 text-left"
              onClick={() => setShowEncerrarModal(true)}
              disabled={segLoading}
            >
              🧹 Encerrar sessões
              <div className="text-xs text-gray-500">
                Isso vai deslogar você em todos os dispositivos.
              </div>
            </button>
          </div>
        </div>
      </div>
    )}

    {showEncerrarModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900">
            Encerrar sessões
          </h3>

          <p className="text-sm text-gray-600 mt-2">
            Tem certeza que deseja sair da sua conta em <strong>todos os dispositivos</strong>?
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEncerrarModal(false)}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={async () => {
                setShowEncerrarModal(false);
                await apiEncerrarSessoes();
              }}
              className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Encerrar sessões
            </button>
          </div>
        </div>
      </div>
    )}
    <BottomNav />
    </div>
  );
}