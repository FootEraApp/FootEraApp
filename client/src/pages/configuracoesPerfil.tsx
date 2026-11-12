import { toast } from "@/lib/toast";
import { Switch } from "../components/ui/switch.js";
import { useContext, useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { API, FLAGS, MESSAGES } from "../config.js";
import Atualizacoes from "../components/Atualizacoes.js";
import BottomNav from "@/components/layout/BottomNav.js";
import socket from "../services/socket.js";
import { ativarPushNotifications, desativarPushNotifications, getPushDeviceStatus, type PushDeviceStatus } from "../services/pushNotifications.js";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { ativarPushAndroidNativo, desativarPushAndroidNativo, fcmTokenPertenceAoUsuarioAtual, inicializarPushAndroidNativo, mostrarNotificacaoLocalTeste } from "../services/nativePushNotifications.js";
import { UserContext } from "../context/UserContext.js";
import TransferenciasRecebidas from "../components/organizacoes/TransferenciasRecebidas.js";
import HistoricoTransferencias from "../components/organizacoes/HistoricoTransferencias.js";
import SolicitacaoNascimentoDocumental from "../components/profile/SolicitacaoNascimentoDocumental.js";

type FeedbackTipo = "sugestao" | "bug";
type VisibilidadePerfil =
  | "PUBLICO"
  | "NAO_LISTADO"
  | "PRIVADO";

type SupervisaoPrivacidade = {
  supervisionado:
    boolean;
  permitirPerfilPublico:
    boolean;
  permitirMensagensDiretas:
    boolean;
  permitirMostrarEmail:
    boolean;
};

type ResponsavelDoAtleta = {
  id: string;
  status:
    | "PENDENTE"
    | "ATIVO"
    | "REVOGADO";
  principal:
    boolean;
  parentesco?:
    string | null;
  origemSolicitacao?:
    string | null;
  responsavel: {
    id: string;
    nome: string;
    nomeDeUsuario?:
      string | null;
    foto?:
      string | null;
  };
};

const TUTORIAL_ENABLED = FLAGS.TUTORIAL_ENABLED;

export default function ConfiguracoesPerfil() {
  const [, setLocation] = useLocation();
  const userContext = useContext(UserContext);

  const activeContext = userContext?.activeContext;

  const somenteGestaoConta =
    localStorage.getItem("somenteGestaoConta") === "true" ||
    sessionStorage.getItem("somenteGestaoConta") === "true";

  const organizacaoAtual =
    activeContext?.kind === "ORGANIZATION"
      ? activeContext
      : null;

  const podeSolicitarSaidaOrganizacao =
    organizacaoAtual?.organizationRole === "MEMBRO" &&
    Boolean(organizacaoAtual.organizationId);

  const papelAtual =
    activeContext?.kind === "PERSONAL"
      ? String(activeContext.tipoUsuario ?? "")
      : null;

  const papeisComExclusaoIndividual = [
    "Professor",
    "Olheiro",
    "Learning",
    "Atleta",
    "Responsavel",
    "Creator",
  ];

  const podeExcluirPapelAtual =
    papelAtual !== null &&
    activeContext?.kind === "PERSONAL" &&
    papeisComExclusaoIndividual.includes(papelAtual);

  const [showDeleteRoleModal, setShowDeleteRoleModal] =
    useState(false);

  const [confirmRoleText, setConfirmRoleText] =
    useState("");

  const [roleDeleteError, setRoleDeleteError] =
    useState<string | null>(null);

  const [deletingRole, setDeletingRole] =
    useState(false);
  const [
    visibilidadePerfil,
    setVisibilidadePerfil,
  ] = useState<VisibilidadePerfil | null>(
    null
  );

  const [
    privacidadeSaving,
    setPrivacidadeSaving,
  ] = useState(false);

  const [
    privacidadeInicial,
    setPrivacidadeInicial,
  ] = useState<{
    visibilidadePerfil: VisibilidadePerfil | null;
    permitirMensagens: boolean;
    mostrarOnline: boolean;
    mostrarEmail: boolean;
  } | null>(null);

  const [mensagens, setMensagens] = useState(true);
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const [notifMensagens, setNotifMensagens] = useState(true);
  const [notifTreinos, setNotifTreinos] = useState(true);
  const [notifEventos, setNotifEventos] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [pushErr, setPushErr] = useState<string | null>(null);
  const [pushDeviceStatus, setPushDeviceStatus] = useState<PushDeviceStatus | "checking">("checking");
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [pushHasSubscription, setPushHasSubscription] = useState(false);
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
  type ImpedimentoExclusaoConta = {
    codigo: string;
    categoria:
      | "ADMIN"
      | "ORGANIZACAO"
      | "RESPONSAVEL"
      | "ATLETA"
      | "PROFESSOR"
      | "CREATOR"
      | "ASSINATURA"
      | "FINANCEIRO"
      | "TRANSFERENCIA"
      | "LEARNING"
      | "EVENTO"
      | "OLHEIRO"
      | "CONTEUDO";
    titulo: string;
    descricao: string;
    orientacao: string;
    organizacaoId?: string | null;
    legadoId?: string | null;
  };

  const [deleteDetails, setDeleteDetails] = useState<{
    impedimentos: ImpedimentoExclusaoConta[];
    avisos: ImpedimentoExclusaoConta[];
    diagnosticoCompleto: boolean;
    podeSolicitarExclusao: boolean;
  } | null>(null);
  const [diagnosticoLoading, setDiagnosticoLoading] =
    useState(false);

  const [diagnosticoConsultado, setDiagnosticoConsultado] =
    useState(false);
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
  const [
    supervisao,
    setSupervisao,
  ] =
    useState<SupervisaoPrivacidade | null>(
      null
    );

  const [
    meusResponsaveis,
    setMeusResponsaveis,
  ] =
    useState<
      ResponsavelDoAtleta[]
    >([]);

  const [
    responsaveisLoading,
    setResponsaveisLoading,
  ] =
    useState(false);

  const [
    podeDesvincularResponsaveis,
    setPodeDesvincularResponsaveis,
  ] =
    useState(false);

  const [
    idadeAtleta,
    setIdadeAtleta,
  ] =
    useState<
      number | null
    >(null);

  const [
    showResponsaveisModal,
    setShowResponsaveisModal,
  ] =
    useState(false);

  const [
    desvinculandoResponsavelId,
    setDesvinculandoResponsavelId,
  ] =
    useState<
      string | null
    >(null);

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

  function decodeJwtPayload(token: string) {
    try {
      const payload = token.split(".")[1];
      if (!payload) return null;

      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(normalized)
          .split("")
          .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
          .join("")
      );

      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function getUsuarioIdAtual() {
    const direto =
      localStorage.getItem("usuarioId") ||
      sessionStorage.getItem("usuarioId") ||
      localStorage.getItem("userId") ||
      sessionStorage.getItem("userId") ||
      localStorage.getItem("idUsuario") ||
      sessionStorage.getItem("idUsuario") ||
      "";

    if (direto) return direto;

    const payload = decodeJwtPayload(getToken());

    return String(
      payload?.usuarioId ||
        payload?.userId ||
        payload?.id ||
        payload?.sub ||
        ""
    );
  }

  function isNativePushApp() {
    return Capacitor.isNativePlatform();
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLocation("/login");
      return;
    }
  }, []);

  useEffect(() => {
    if (
      tipoNorm !==
      "atleta"
    ) {
      return;
    }

    carregarMeusResponsaveis();
  }, [tipoNorm]);

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

  async function carregarMeusResponsaveis() {
    if (
      tipoNorm !==
      "atleta"
    ) {
      setMeusResponsaveis(
        []
      );

      setPodeDesvincularResponsaveis(
        false
      );

      setIdadeAtleta(
        null
      );

      return;
    }

    try {
      setResponsaveisLoading(
        true
      );

      const resposta =
        await fetch(
          `${API.BASE_URL}/api/responsaveis/atleta/me/responsaveis`,
          {
            headers: {
              Authorization:
                `Bearer ${getToken()}`,
            },
          }
        );

      const data =
        await resposta
          .json()
          .catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          data?.message ||
          "Não foi possível carregar seus responsáveis."
        );
      }

      setMeusResponsaveis(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );

      setPodeDesvincularResponsaveis(
        Boolean(
          data?.podeDesvincularResponsaveis
        )
      );

      setIdadeAtleta(
        typeof data?.idade ===
        "number"
          ? data.idade
          : null
      );
    } catch (
      error: any
    ) {
      console.error(
        "[ConfiguracoesPerfil] responsáveis:",
        error
      );

      setMeusResponsaveis(
        []
      );
    } finally {
      setResponsaveisLoading(
        false
      );
    }
  }

  async function desvincularResponsavel(
  item: ResponsavelDoAtleta
) {
  if (
    !podeDesvincularResponsaveis
  ) {
    toast.error(
      "Enquanto sua conta for supervisionada, você não pode remover um responsável ativo."
    );

    return;
  }

  const confirmar =
    window.confirm(
      `Deseja remover ${item.responsavel.nome} dos seus responsáveis?`
    );

  if (!confirmar) {
    return;
  }

  try {
    setDesvinculandoResponsavelId(
      item.id
    );

    const resposta =
      await fetch(
        `${API.BASE_URL}/api/responsaveis/atleta/me/responsaveis/${encodeURIComponent(
          item.id
        )}`,
        {
          method:
            "DELETE",

          headers: {
            Authorization:
              `Bearer ${getToken()}`,
          },
        }
      );

    const data =
      await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível remover o responsável."
      );
    }

    toast.success(
      data?.message ||
      "Responsável desvinculado."
    );

    await carregarMeusResponsaveis();
      } catch (
        error: any
      ) {
        toast.error(
          error?.message ||
          "Não foi possível remover o responsável."
        );
      } finally {
        setDesvinculandoResponsavelId(
          null
        );
      }
    }

  async function carregarPrivacidade() {
    const resp = await fetch(
      `${API.REST}/configuracoes-perfil/privacidade`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    const data =
      await resp
        .json()
        .catch(() => ({}));

    if (!resp.ok) {
      throw new Error(
        data?.message ||
          "Não foi possível carregar as configurações de privacidade."
      );
    }

    setSupervisao(
      data?.supervisao ??
      null
    );

    const proximaVisibilidade =
      (data?.visibilidadePerfil ??
        null) as VisibilidadePerfil | null;

    const proximasMensagens =
      data?.permitirMensagens ??
      true;

    const proximoMostrarOnline =
      data?.mostrarOnline ??
      true;

    const proximoMostrarEmail =
      data?.mostrarEmail ??
      false;

    setVisibilidadePerfil(
      proximaVisibilidade
    );

    setMensagens(
      proximasMensagens
    );

    setMostrarOnline(
      proximoMostrarOnline
    );

    setMostrarEmail(
      proximoMostrarEmail
    );

    setPrivacidadeInicial({
      visibilidadePerfil:
        proximaVisibilidade,
      permitirMensagens:
        proximasMensagens,
      mostrarOnline:
        proximoMostrarOnline,
      mostrarEmail:
        proximoMostrarEmail,
    });
  }

  async function salvarPrivacidade(
    patch: any
  ) {
    const resp = await fetch(
      `${API.REST}/configuracoes-perfil/privacidade`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${getToken()}`,
        },

        body: JSON.stringify(patch),
      }
    );

    const data =
      await resp
        .json()
        .catch(() => ({}));

    if (!resp.ok) {
      throw new Error(
        data?.message ||
        "Não foi possível salvar a configuração."
      );
    }

    return data;
  }

  function fecharPrivacidadeModal() {
    if (privacidadeInicial) {
      setVisibilidadePerfil(
        privacidadeInicial.visibilidadePerfil
      );

      setMensagens(
        privacidadeInicial.permitirMensagens
      );

      setMostrarOnline(
        privacidadeInicial.mostrarOnline
      );

      setMostrarEmail(
        privacidadeInicial.mostrarEmail
      );
    }

    setShowPrivacidadeModal(false);
  }

  async function salvarPrivacidadeModal() {
    try {
      setPrivacidadeSaving(true);

      const patch: Record<string, unknown> = {
        permitirMensagens: mensagens,
        mostrarOnline,
        mostrarEmail,
      };

      if (visibilidadePerfil) {
        patch.visibilidadePerfil =
          visibilidadePerfil;
      }

      const data =
        await salvarPrivacidade(
          patch
        );

      const visibilidadeSalva =
        (data?.visibilidadePerfil ??
          visibilidadePerfil ??
          null) as VisibilidadePerfil | null;

      const mensagensSalvas =
        data?.permitirMensagens ??
        mensagens;

      const onlineSalvo =
        data?.mostrarOnline ??
        mostrarOnline;

      const emailSalvo =
        data?.mostrarEmail ??
        mostrarEmail;

      setVisibilidadePerfil(
        visibilidadeSalva
      );

      setMensagens(
        mensagensSalvas
      );

      setMostrarOnline(
        onlineSalvo
      );

      setMostrarEmail(
        emailSalvo
      );

      setPrivacidadeInicial({
        visibilidadePerfil:
          visibilidadeSalva,
        permitirMensagens:
          mensagensSalvas,
        mostrarOnline:
          onlineSalvo,
        mostrarEmail:
          emailSalvo,
      });

      toast.success(
        "Configurações de privacidade salvas."
      );

      setShowPrivacidadeModal(
        false
      );
    } catch (e: any) {
      toast.error(
        e?.message ||
          "Não foi possível salvar as configurações de privacidade."
      );
    } finally {
      setPrivacidadeSaving(false);
    }
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

  async function excluirPapelAtual(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setRoleDeleteError(null);

    if (!papelAtual || !podeExcluirPapelAtual) {
      setRoleDeleteError(
        "Este perfil ainda não pode ser excluído por esta opção."
      );
      return;
    }

    if (confirmRoleText.trim() !== `Excluir ${papelAtual}`) {
      setRoleDeleteError(
        `Digite exatamente "Excluir ${papelAtual}".`
      );
      return;
    }

    try {
      setDeletingRole(true);

      const resposta = await fetch(
        `${API.REST}/usuarios/me/papeis/${encodeURIComponent(papelAtual)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(
          data?.message ||
            "Não foi possível excluir este perfil."
        );
      }

      if (!data?.activeContext?.key) {
        throw new Error(
          "O perfil foi desativado, mas não foi possível determinar o próximo contexto. Atualize a página."
        );
      }
      setShowDeleteRoleModal(false);
      setConfirmRoleText("");

      localStorage.clear();
      sessionStorage.clear();
      window.location.assign("/login");
    } catch (error: any) {
      setRoleDeleteError(
        error?.message ||
          "Erro ao excluir o perfil."
      );
    } finally {
      setDeletingRole(false);
    }
  }

  useEffect(() => {
    if (!showDeleteModal) return;

    const controller = new AbortController();

    async function carregarDiagnostico() {
      setDiagnosticoLoading(true);
      setDiagnosticoConsultado(false);
      setDeleteDetails(null);
      setDeleteError(null);

      try {
        const token = getToken();

        if (!token) {
          throw new Error("Sessão expirada. Entre novamente.");
        }

        const resp = await fetch(
          `${API.REST}/configuracoes/minha-conta/diagnostico`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          throw new Error(
            data?.message || "Não foi possível consultar as pendências.",
          );
        }

        if (controller.signal.aborted) return;

        const diagnostico = data?.diagnostico;

        setDeleteDetails({
          impedimentos: Array.isArray(diagnostico?.impedimentos)
            ? diagnostico.impedimentos
            : [],

          avisos: Array.isArray(diagnostico?.avisos)
            ? diagnostico.avisos
            : [],

          diagnosticoCompleto:
            diagnostico?.diagnosticoCompleto === true,

          podeSolicitarExclusao:
            diagnostico?.podeSolicitarExclusao === true,
        });

        setDiagnosticoConsultado(true);
      } catch (error: any) {
        if (controller.signal.aborted) return;

        setDeleteError(
          error?.message || "Erro ao consultar as pendências.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setDiagnosticoLoading(false);
        }
      }
    }

    void carregarDiagnostico();

    return () => controller.abort();
  }, [showDeleteModal]);

  async function excluirConta(e: React.FormEvent) {
    e.preventDefault();
    if (
      !diagnosticoConsultado ||
      diagnosticoLoading ||
      deleteDetails?.diagnosticoCompleto !== true ||
      deleteDetails?.podeSolicitarExclusao !== true ||
      Boolean(deleteDetails?.impedimentos.length)
    ) {
      return;
    }
    setDeleteError(null);
    setDeleteDetails(null);

    try {
      setDeleting(true);
      const resp = await fetch(`${API.REST}/configuracoes/minha-conta`, {
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
        toast.error(data?.message || "Conta movida para lixeira por 30 dias.");
        setLocation("/login");
        return;
      }

      setDeleteError(
        data?.message || "Não foi possível excluir a conta."
      );

      if (
        data?.code === "ACCOUNT_DELETE_BLOCKED" &&
        Array.isArray(data?.details?.impedimentos)
      ) {
        setDeleteDetails({
          impedimentos: data.details.impedimentos,
          avisos: Array.isArray(data.details.avisos)
            ? data.details.avisos
            : [],
          diagnosticoCompleto: false,
          podeSolicitarExclusao: false,
        });
      }
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

  async function atualizarStatusPush(options?: { desativadoManual?: boolean }) {
    try {
      setPushDeviceStatus("checking");

      if (isNativePushApp()) {
        const perm = await PushNotifications.checkPermissions();
        const receive = perm?.receive;

        if (!receive) {
          console.warn(
            "[push native] checkPermissions não retornou receive:",
            perm
          );

          setPushDeviceStatus("default");
          setPushPermission("default");
          setPushHasSubscription(false);
          setPushMsg(null);
          setPushErr(
            "O Android não retornou o estado da permissão de notificações."
          );

          return;
        }

        if (receive === "granted") {
          await inicializarPushAndroidNativo();

          setPushPermission("granted");

          if (fcmTokenPertenceAoUsuarioAtual()) {
            setPushDeviceStatus("subscribed");
            setPushHasSubscription(true);
            setPushMsg("Notificações nativas ativadas neste app Android ✅");
            setPushErr(null);
            return;
          }

          setPushDeviceStatus("granted_without_subscription");
          setPushHasSubscription(false);
          setPushMsg(
            "A permissão do Android está liberada, mas este app ainda não vinculou o token FCM à conta atual. Clique em Ativar no celular."
          );
          setPushErr(null);
          return;
        }

        if (receive === "denied") {
          setPushDeviceStatus("denied");
          setPushPermission("denied");
          setPushHasSubscription(false);
          setPushMsg(null);
          setPushErr(
            "Notificações bloqueadas no Android. Para ativar, abra as configurações do app FootEra no sistema e libere as notificações."
          );
          return;
        }

        setPushDeviceStatus("default");
        setPushPermission("default");
        setPushHasSubscription(false);
        setPushMsg(
          "Notificações ainda não foram ativadas neste app. Clique em Ativar no celular para permitir."
        );
        setPushErr(null);
        return;
      }

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
            : "Notificações do sistema ainda não estão ativas neste dispositivo. Clique em Ativar no celular para receber avisos fora do app/site."
        );
        return;
      }

      if (status.status === "default") {
        setPushMsg(
          "Notificações ainda não foram ativadas neste dispositivo. Clique em Ativar no celular para escolher."
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

      if (isNativePushApp()) {
        const usuarioAtual = getUsuarioIdAtual();
        const tokenSalvo = localStorage.getItem("footera:fcmToken") || "";
        const tokenUsuarioId =
          localStorage.getItem("footera:fcmTokenUsuarioId") || "";

        if (!tokenSalvo || !usuarioAtual || tokenUsuarioId !== usuarioAtual) {
          throw new Error(
            "Este app ainda não está vinculado à conta atual para push. Clique em Ativar no celular antes de enviar o teste."
          );
        }
      }

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

      const qtdWeb = Number(data?.pushSubscriptions || 0);
      const qtdNative = Number(data?.nativePushTokens || 0);
      const totalDispositivos = Number(
        data?.totalDispositivos ?? qtdWeb + qtdNative
      );

      if (totalDispositivos > 0) {
        if (isNativePushApp()) {
          await mostrarNotificacaoLocalTeste();
        }

        setPushMsg(
          isNativePushApp()
            ? `Push de teste enviado para ${totalDispositivos} dispositivo(s): ${qtdWeb} web e ${qtdNative} Android. Também disparei uma notificação local para confirmar a central do Android.`
            : `Push de teste enviado para ${totalDispositivos} dispositivo(s): ${qtdWeb} web e ${qtdNative} Android.`
        );
        setPushErr(null);
      } else {
        setPushMsg(null);
        setPushErr(
          "A notificação interna foi criada, mas este usuário não tem dispositivo push cadastrado. Clique em Ativar primeiro."
        );
      }
    } catch (e: any) {
      setPushMsg(null);
      setPushErr(e?.message || "Erro ao testar push.");
    } finally {
      await atualizarStatusPush();
      setPushLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("secao") !== "transferencias") {
      return;
    }

    const timeout = window.setTimeout(() => {
      document
        .getElementById("transferencias-propriedade")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen bg-transparent pb-24">

      <header className="bg-green-900 text-white py-3 px-3 flex items-center relative">
        {!somenteGestaoConta && (
          <Link
            href="/perfil"
            aria-label="Voltar para perfil"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 z-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}

        <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold pointer-events-none">
          Configurações
        </h1>
      </header>

      {somenteGestaoConta && (
        <div className="mx-4 mt-4 rounded-xl border border-green-200 bg-white p-4">
          <h2 className="font-bold text-green-900">
            Gestão da sua conta FootEra
          </h2>

          <p className="mt-2 text-sm text-gray-700">
            Sua conta não possui perfis ativos no momento.
            Você ainda pode consultar o histórico das transferências
            de propriedade e solicitar a exclusão da conta.
          </p>

          <p className="mt-2 text-xs text-gray-500">
            As organizações transferidas permanecem com os novos
            proprietários. Seus históricos não serão apagados.
          </p>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <h3 className="font-bold text-gray-900">
              O que deseja fazer agora?
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Você pode manter esta conta para consultar seus
              históricos, ativar um novo perfil independente
              ou solicitar a exclusão da conta.
            </p>

            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
              <h4 className="font-semibold text-green-900">
                Continuar utilizando o FootEra
              </h4>

              <p className="mt-2 text-sm text-gray-700">
                Ative um novo papel utilizando esta mesma conta.
                Sua antiga organização continuará com o novo
                proprietário.
              </p>

              <button
                type="button"
                onClick={() => setLocation("/perfil/recuperar")}
                className="mt-3 w-full rounded-lg bg-green-800 px-4 py-3 font-semibold text-white hover:bg-green-900"
              >
                Ativar outro perfil
              </button>
            </div>

            <p className="mt-4 text-sm text-gray-600">
              Se preferir, não precisa fazer nada agora.
              Seu histórico de transferências continuará
              disponível nesta página.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.assign("/login");
            }}
            className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Sair da conta
          </button>
        </div>
      )}

    {!somenteGestaoConta && (
      <>
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

              try {
                await carregarPrivacidade();
              } catch (e: any) {
                toast.error(
                  e?.message ||
                    "Não foi possível carregar as configurações de privacidade."
                );
              }
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
              setPushMsg(null);
              setPushErr(null);

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

        {tipoNorm ===
          "atleta" && (
          <div className="flex justify-between py-2 items-start border-b">
            <div>
              <p className="font-semibold">
                🛡️ Meus responsáveis
              </p>

              <p className="text-sm text-gray-600">
                Consulte os responsáveis vinculados à sua conta.
              </p>

              {idadeAtleta !==
                null && (
                <p className="mt-1 text-xs text-gray-500">
                  {idadeAtleta <
                  12
                    ? "Sua conta ainda é supervisionada."
                    : "Você já pode administrar seus vínculos de responsável."}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={async () => {
                setShowResponsaveisModal(
                  true
                );

                await carregarMeusResponsaveis();
              }}
              className="text-green-800 font-semibold"
            >
              Gerenciar
            </button>
          </div>
        )}

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
              onClick={() => toast.error(MESSAGES.PAGAMENTOS_EM_REFORMULACAO)}
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

      <SolicitacaoNascimentoDocumental />

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

      {podeExcluirPapelAtual && (
        <div className="mx-4 mb-4 rounded-xl shadow bg-white border border-amber-200 p-4">
          <h3 className="text-gray-900 font-bold text-lg">
            Excluir perfil atual
          </h3>

          <p className="text-sm text-gray-600 mt-2">
            Você está usando o perfil{" "}
            <strong>{papelAtual}</strong>.
            Ao excluí-lo, esse papel deixará de aparecer
            nas suas opções de perfil.
            Sua conta e os outros papéis continuarão ativos.
          </p>

          <p className="text-xs text-amber-800 mt-2">
            Os históricos e registros vinculados ao perfil
            serão preservados nesta etapa.
          </p>

          <button
            type="button"
            onClick={() => {
              setConfirmRoleText("");
              setRoleDeleteError(null);
              setShowDeleteRoleModal(true);
            }}
            className="mt-3 w-full sm:w-auto rounded-md border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Excluir somente {papelAtual}
          </button>
        </div>
      )}

      {organizacaoAtual && (
        <div className="mx-4 mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="font-bold text-lg text-gray-900">
            Minha organização
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            {organizacaoAtual.label}
          </p>

          <p className="mt-2 text-sm text-gray-600">
            {organizacaoAtual.organizationRole === "PROPRIETARIO"
              ? "Você é proprietário desta organização. Para deixar de ser proprietário, acesse Editar perfil e envie uma solicitação de transferência. A organização continuará ativa e seus históricos serão preservados."
              : podeSolicitarSaidaOrganizacao
                ? "Você pode solicitar a saída desta organização sem excluir a instituição nem seus históricos."
                : "Para deixar esta organização, primeiro é necessário resolver ou encerrar suas responsabilidades institucionais."}
          </p>

          {organizacaoAtual.organizationRole === "PROPRIETARIO" && (
            <Link
              href="/perfil/editar"
              className="mt-3 inline-flex items-center rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
            >
              Ir para transferência de propriedade
            </Link>
          )}
        </div>
      )}
          </>
      )}

      {getToken() && (
        <>
          {!somenteGestaoConta && (
            <TransferenciasRecebidas token={getToken()} />
          )}

          <HistoricoTransferencias token={getToken()} />
        </>
      )}

      <div className="mx-4 mb-4 rounded-xl shadow bg-white border border-red-200 p-4">
        <h3 className="text-red-700 font-bold text-lg">Excluir conta</h3>
        <p className="mt-1 text-sm text-red-700">
          Ao solicitar a exclusão, sua conta será desativada e movida
          para a lixeira, com possibilidade de restauração por até
          30 dias. A remoção definitiva dependerá das verificações
          de segurança e das regras de preservação de dados.
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

      {showDeleteRoleModal && papelAtual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-red-700">
              Excluir perfil {papelAtual}
            </h3>

            <p className="mt-2 text-sm text-gray-700">
              O perfil {papelAtual} deixará de ficar ativo.
              Seus outros perfis permanecerão disponíveis.
            </p>

            <p className="mt-3 text-sm text-gray-700">
              Para confirmar, digite:
              <strong className="ml-1">
                Excluir {papelAtual}
              </strong>
            </p>

            <form onSubmit={excluirPapelAtual} className="mt-4">
              <input
                type="text"
                value={confirmRoleText}
                onChange={(e) =>
                  setConfirmRoleText(e.target.value)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder={`Excluir ${papelAtual}`}
                required
              />

              {roleDeleteError && (
                <p className="mt-2 text-sm text-red-600">
                  {roleDeleteError}
                </p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deletingRole}
                  onClick={() => {
                    setShowDeleteRoleModal(false);
                    setConfirmRoleText("");
                    setRoleDeleteError(null);
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    deletingRole ||
                    confirmRoleText.trim() !==
                      `Excluir ${papelAtual}`
                  }
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deletingRole
                    ? "Excluindo..."
                    : "Excluir perfil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-xl shadow-lg p-5">
            <h3 className="text-lg font-semibold text-red-600">Excluir conta</h3>

            <p className="text-sm text-gray-700 mt-2">
              Para mover sua conta para a lixeira, digite exatamente{" "}
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
              {diagnosticoLoading && (
                <p className="mt-3 text-sm text-gray-600">
                  Verificando responsabilidades e vínculos da conta...
                </p>
              )}

              {diagnosticoConsultado &&
                deleteDetails?.diagnosticoCompleto === false && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">
                      Exclusão temporariamente indisponível
                    </p>

                    <p className="mt-1">
                      A verificação completa das responsabilidades
                      desta conta ainda não foi concluída.
                      Você poderá solicitar a exclusão quando
                      todas as verificações de segurança
                      estiverem disponíveis.
                    </p>
                  </div>
                )}

              {deleteError && (
                <div className="mt-2 text-sm text-red-600">
                  {deleteError}
                </div>
              )}

              {deleteDetails &&
                deleteDetails.impedimentos.length > 0 && (
                <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-semibold text-amber-900">
                    Antes de excluir sua conta, resolva estas pendências:
                  </p>

                  {deleteDetails.impedimentos.map((impedimento, index) => (
                    <div
                      key={`${impedimento.codigo}-${impedimento.organizacaoId ?? impedimento.legadoId ?? index}`}
                      className="rounded-lg border border-amber-200 bg-white p-3"
                    >
                      <p className="font-semibold text-gray-900">
                        {impedimento.titulo}
                      </p>

                      <p className="mt-1 text-gray-700">
                        {impedimento.descricao}
                      </p>

                      <p className="mt-2 font-medium text-gray-900">
                        Próxima etapa:
                      </p>

                      <p className="mt-1 text-gray-700">
                        {impedimento.orientacao}
                      </p>
                    </div>
                  ))}

                  <p className="text-xs text-amber-900">
                    Depois de resolver as pendências, solicite novamente
                    a exclusão da conta.
                  </p>
                </div>
              )}

              {deleteDetails &&
                deleteDetails.avisos.length > 0 && (
                  <div className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
                    <p className="font-semibold text-blue-900">
                      Históricos e registros que precisam ser preservados
                    </p>

                    {deleteDetails.avisos.map((aviso, index) => (
                      <div
                        key={`${aviso.codigo}-${aviso.organizacaoId ?? aviso.legadoId ?? index}`}
                        className="rounded-lg border border-blue-200 bg-white p-3"
                      >
                        <p className="font-semibold text-gray-900">
                          {aviso.titulo}
                        </p>

                        <p className="mt-1 text-gray-700">
                          {aviso.descricao}
                        </p>

                        <p className="mt-2 text-gray-600">
                          {aviso.orientacao}
                        </p>
                      </div>
                    ))}

                    <p className="text-xs text-blue-900">
                      Esses registros não impedem automaticamente a
                      exclusão lógica. A auditoria e as regras de
                      preservação ainda precisam ser concluídas.
                    </p>
                  </div>
                )}

              {diagnosticoConsultado &&
                !diagnosticoLoading &&
                deleteDetails?.impedimentos.length === 0 && (
                  <p className="mt-3 text-sm text-gray-600">
                    Nenhuma pendência foi identificada nas verificações
                    realizadas até agora.
                    {deleteDetails?.diagnosticoCompleto !== true
                      ? " A auditoria completa da conta ainda está pendente."
                      : " A verificação de pendências foi concluída."}
                  </p>
                )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmText("");
                    setDeleteError(null);
                    setDeleteDetails(null);
                  }}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  disabled={
                    deleting ||
                    diagnosticoLoading ||
                    !diagnosticoConsultado ||
                    !matchConfirm ||
                    deleteDetails?.diagnosticoCompleto !== true ||
                    deleteDetails?.podeSolicitarExclusao !== true ||
                    Boolean(deleteDetails?.impedimentos.length)
                  }
                  title={
                    deleteDetails?.diagnosticoCompleto !== true
                      ? "A exclusão está indisponível até a conclusão da auditoria."
                      : deleteDetails?.podeSolicitarExclusao !== true
                        ? "Resolva as pendências antes de excluir a conta."
                        : !matchConfirm
                          ? `Digite exatamente "${REQUIRED_PHRASE}" para habilitar`
                          : "Solicitar exclusão da conta"
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
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-4">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="shrink-0 px-5 pt-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  🛡️ Privacidade
                </h3>

                <button
                  type="button"
                  onClick={fecharPrivacidadeModal}
                  disabled={privacidadeSaving}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                  aria-label="Fechar privacidade"
                >
                  ✕
                </button>
              </div>

              <p className="mt-1 pb-4 text-sm text-gray-600">
                Ajuste quem pode ver seu perfil e como as pessoas podem interagir com você.
              </p>
              {supervisao?.supervisionado && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="font-semibold text-blue-900">
                    🛡️ Conta supervisionada
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-blue-800">
                    Algumas configurações precisam estar liberadas pelo seu responsável.
                    Você sempre pode escolher opções mais privadas.
                  </p>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <div className="border-b pb-4">
                  <div className="font-semibold text-gray-900">
                    Visibilidade do perfil
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    Escolha quem pode encontrar e visualizar seu perfil.
                  </p>

                  {visibilidadePerfil === null && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Seu perfil ainda usa a configuração antiga da FootEra.
                      Até você escolher uma opção, ele não será exibido
                      publicamente para visitantes.
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      disabled={
                        privacidadeSaving ||
                        (
                          supervisao
                            ?.supervisionado &&
                          !supervisao
                            .permitirPerfilPublico
                        )
                      }
                      onClick={() =>
                        setVisibilidadePerfil(
                          "PUBLICO"
                        )
                      }
                      className={`disabled:cursor-not-allowed disabled:opacity-50 w-full rounded-xl border p-3 text-left transition ${
                        visibilidadePerfil ===
                        "PUBLICO"
                          ? "border-green-700 bg-green-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white transition ${
                            visibilidadePerfil ===
                            "PUBLICO"
                              ? "border-green-700 shadow-[0_0_0_3px_rgba(21,128,61,0.12)]"
                              : "border-gray-300"
                          }`}
                        >
                          {visibilidadePerfil ===
                            "PUBLICO" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-green-700" />
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-gray-900">
                            Público
                          </div>

                          <div className="mt-1 text-xs leading-relaxed text-gray-600">
                            Qualquer pessoa pode visualizar seu perfil,
                            mesmo sem conta. Ele também pode aparecer no
                            Explorar.
                          </div>
                          {supervisao?.supervisionado &&
                            !supervisao.permitirPerfilPublico && (
                              <div className="mt-2 font-semibold text-amber-700">
                                🔒 Seu responsável precisa liberar esta opção.
                              </div>
                            )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={privacidadeSaving}
                      onClick={() =>
                        setVisibilidadePerfil(
                          "NAO_LISTADO"
                        )
                      }
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        visibilidadePerfil ===
                        "NAO_LISTADO"
                          ? "border-green-700 bg-green-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white transition ${
                            visibilidadePerfil ===
                            "NAO_LISTADO"
                              ? "border-green-700 shadow-[0_0_0_3px_rgba(21,128,61,0.12)]"
                              : "border-gray-300"
                          }`}
                        >
                          {visibilidadePerfil ===
                            "NAO_LISTADO" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-green-700" />
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-gray-900">
                            Não listado
                          </div>

                          <div className="mt-1 text-xs leading-relaxed text-gray-600">
                            Quem tiver o link pode visualizar seu perfil,
                            mas ele não aparece no Explorar público.
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={privacidadeSaving}
                      onClick={() =>
                        setVisibilidadePerfil(
                          "PRIVADO"
                        )
                      }
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        visibilidadePerfil ===
                        "PRIVADO"
                          ? "border-green-700 bg-green-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white transition ${
                            visibilidadePerfil ===
                            "PRIVADO"
                              ? "border-green-700 shadow-[0_0_0_3px_rgba(21,128,61,0.12)]"
                              : "border-gray-300"
                          }`}
                        >
                          {visibilidadePerfil ===
                            "PRIVADO" && (
                            <div className="h-2.5 w-2.5 rounded-full bg-green-700" />
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-gray-900">
                            Privado
                          </div>

                          <div className="mt-1 text-xs leading-relaxed text-gray-600">
                            Visitantes não podem visualizar seu perfil.
                            Dentro da FootEra, continuam valendo suas
                            regras de vínculo e conexão.
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-b pb-3">
                  <span className="font-medium">
                    Permitir Mensagens Diretas
                  </span>

                  <Switch
                    checked={mensagens}
                    disabled={
                      privacidadeSaving ||
                      (
                        supervisao
                          ?.supervisionado &&
                        !supervisao
                          .permitirMensagensDiretas &&
                        !mensagens
                      )
                    }
                    onCheckedChange={(v) => {
                      if (
                        privacidadeSaving
                      ) {
                        return;
                      }

                      if (
                        v === true &&
                        supervisao
                          ?.supervisionado &&
                        !supervisao
                          .permitirMensagensDiretas
                      ) {
                        toast.error(
                          "Seu responsável precisa liberar mensagens diretas."
                        );

                        return;
                      }

                      setMensagens(v);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-b pb-3">
                  <span className="font-medium">
                    Mostrar Online / Último online
                  </span>

                  <Switch
                    checked={mostrarOnline}
                    onCheckedChange={(v) => {
                      if (privacidadeSaving) {
                        return;
                      }

                      setMostrarOnline(v);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">
                      Mostrar e-mail para usuários da FootEra
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      Seu e-mail não será exibido para visitantes sem conta.
                    </div>
                  </div>

                  <Switch
                    checked={mostrarEmail}
                    disabled={
                      privacidadeSaving ||
                      (
                        supervisao
                          ?.supervisionado &&
                        !supervisao
                          .permitirMostrarEmail &&
                        !mostrarEmail
                      )
                    }
                    onCheckedChange={(v) => {
                      if (
                        privacidadeSaving
                      ) {
                        return;
                      }

                      if (
                        v === true &&
                        supervisao
                          ?.supervisionado &&
                        !supervisao
                          .permitirMostrarEmail
                      ) {
                        toast.error(
                          "Seu responsável precisa liberar a exibição do e-mail."
                        );

                        return;
                      }

                      setMostrarEmail(v);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-4">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={fecharPrivacidadeModal}
                  disabled={privacidadeSaving}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void salvarPrivacidadeModal()
                  }
                  disabled={privacidadeSaving}
                  className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {privacidadeSaving
                    ? "Salvando..."
                    : "Salvar"}
                </button>
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

              <div className="mt-4 rounded-xl border border-green-100 bg-white p-4">
                <p className="font-semibold text-green-900">Notificações no dispositivo</p>

                <p className="text-sm text-gray-600 mt-1">
                  Ative para receber avisos mesmo com o app/site fechado.
                </p>

                <div
                  className={`mt-3 rounded-lg border p-3 text-sm ${
                    pushDeviceStatus === "subscribed"
                      ? "bg-green-50 border-green-200"
                      : pushDeviceStatus === "denied" ||
                        pushDeviceStatus === "unsupported" ||
                        pushDeviceStatus === "granted_without_subscription"
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  {pushDeviceStatus === "checking" && (
                    <p className="text-gray-600">Verificando este dispositivo...</p>
                  )}

                  {pushDeviceStatus === "subscribed" && (
                    <p className="text-green-700 font-medium">
                      ✅ Este dispositivo já está ativado para receber notificações.
                    </p>
                  )}

                  {pushDeviceStatus === "default" && (
                    <p className="text-amber-700 font-medium">
                      ⚠️ Você ainda não escolheu se permite notificações neste dispositivo.
                    </p>
                  )}

                  {pushDeviceStatus === "denied" && (
                    <div className="text-red-600">
                      <p className="font-medium">
                        {isNativePushApp()
                          ? "❌ Notificações bloqueadas no Android."
                          : "❌ Notificações bloqueadas neste navegador."}
                      </p>
                      <p className="mt-1 text-xs">
                        {isNativePushApp()
                          ? "Para ativar, abra as configurações do app FootEra no Android e libere notificações."
                          : "Para ativar, clique no cadeado ao lado da URL do site e libere notificações. Depois recarregue a página."}
                      </p>
                    </div>
                  )}

                  {pushDeviceStatus === "unsupported" && (
                    <p className="text-red-600 font-medium">
                      ❌ Este navegador/dispositivo não suporta notificações push.
                    </p>
                  )}

                  {pushDeviceStatus === "granted_without_subscription" && (
                    <p className="text-red-600 font-medium">
                      ⚠️ Notificações do sistema não estão ativas neste dispositivo.
                    </p>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    {isNativePushApp() ? "Permissão do Android:" : "Permissão do navegador:"}{" "}
                    <span className="font-semibold">
                      {pushPermission || "verificando"}
                    </span>
                    {" · "}
                   Status no dispositivo:{" "}
                    <span className="font-semibold">
                      {pushHasSubscription ? "ativo" : "inativo"}
                    </span>
                  </p>
                </div>

                {pushMsg && (
                  <p
                    className={`text-sm mt-2 ${
                      pushDeviceStatus === "subscribed"
                        ? "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    {pushMsg}
                  </p>
                )}

                {pushErr && <p className="text-sm text-red-600 mt-2">{pushErr}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      pushLoading ||
                      pushDeviceStatus === "denied" ||
                      (!isNativePushApp() && pushDeviceStatus === "unsupported")
                    }
                    onClick={async () => {
                    try {
                      setPushLoading(true);
                      setPushMsg(null);
                      setPushErr(null);

                      if (isNativePushApp()) {
                        await ativarPushAndroidNativo();
                        await atualizarStatusPush();

                        setPushMsg("Notificações nativas ativadas neste app Android ✅");
                        setPushErr(null);
                        return;
                      }

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
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                  >
                    {pushLoading ? "Ativando..." : "Ativar no celular"}
                  </button>

                  <button
                    type="button"
                    disabled={pushLoading || (!isNativePushApp() && pushDeviceStatus === "unsupported")}
                    onClick={async () => {
                    try {
                      setPushLoading(true);
                      setPushMsg(null);
                      setPushErr(null);

                      if (isNativePushApp()) {
                        await desativarPushAndroidNativo();

                        setPushDeviceStatus("granted_without_subscription");
                        setPushPermission("granted");
                        setPushHasSubscription(false);
                        setPushMsg(
                          "Notificações desativadas neste app. A permissão do Android continua liberada, mas este dispositivo foi removido do backend."
                        );
                        setPushErr(null);
                        return;
                      }

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
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Desativar neste dispositivo
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

      {showResponsaveisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Meus responsáveis
              </h3>

              <button
                type="button"
                onClick={() =>
                  setShowResponsaveisModal(
                    false
                  )
                }
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {idadeAtleta !==
              null &&
              idadeAtleta <
                12 && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="font-semibold text-blue-900">
                  🛡️ Conta supervisionada
                </p>

                <p className="mt-1 text-xs leading-relaxed text-blue-800">
                  Como você ainda tem menos de 12 anos, os responsáveis ativos não podem ser removidos por esta conta.
                </p>
              </div>
            )}

            {idadeAtleta !==
              null &&
              idadeAtleta >=
                12 && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="font-semibold text-green-900">
                  Conta com autonomia
                </p>

                <p className="mt-1 text-xs leading-relaxed text-green-800">
                  Você já pode remover qualquer vínculo de responsável, inclusive o responsável principal.
                </p>
              </div>
            )}

            <div className="mt-4 space-y-3">
              {responsaveisLoading ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  Carregando...
                </div>
              ) : meusResponsaveis.length ===
                0 ? (
                <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  Nenhum responsável vinculado.
                </div>
              ) : (
                meusResponsaveis.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className="rounded-xl border border-gray-200 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            item
                              .responsavel
                              .foto ||
                            "/assets/usuarios/default-user.png"
                          }
                          alt={
                            item
                              .responsavel
                              .nome
                          }
                          className="h-11 w-11 rounded-full border object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-gray-900">
                            {
                              item
                                .responsavel
                                .nome
                            }
                          </p>

                          {item
                            .responsavel
                            .nomeDeUsuario && (
                            <p className="text-xs text-gray-500">
                              @
                              {
                                item
                                  .responsavel
                                  .nomeDeUsuario
                              }
                            </p>
                          )}

                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.principal && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                                Principal
                              </span>
                            )}

                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {
                                item.status
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      {item.status ===
                        "ATIVO" &&
                        podeDesvincularResponsaveis && (
                        <button
                          type="button"
                          disabled={
                            desvinculandoResponsavelId ===
                            item.id
                          }
                          onClick={() =>
                            desvincularResponsavel(
                              item
                            )
                          }
                          className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                        >
                          {desvinculandoResponsavelId ===
                          item.id
                            ? "Removendo..."
                            : "Remover responsável"}
                        </button>
                      )}
                    </div>
                  )
                )
              )}
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
                Ao entrar com Google usando o mesmo e-mail da sua conta FootEra,
                o acesso é vinculado automaticamente.
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
                {googleLinked ? (
                  <button
                    type="button"
                    onClick={desvincularGoogle}
                    disabled={googleLoading}
                    className="w-full rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                  >
                    {googleLoading
                      ? "Processando..."
                      : "Desvincular conta Google"}
                  </button>
                ) : (
                  <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Nenhuma conta Google vinculada.
                    Para vincular, saia da conta e use
                    {" "}
                    <strong>Continuar com Google</strong>
                    {" "}
                    na tela de login com o mesmo e-mail da sua conta FootEra.
                  </div>
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
        <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-xl shadow-lg p-5">
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
    {!somenteGestaoConta && <BottomNav />}
    </div>
  );
}