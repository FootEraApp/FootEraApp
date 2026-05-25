// client/src/pages/login
import { useState, useEffect, useCallback, type ComponentPropsWithoutRef } from "react";
import { useLocation } from "wouter";
import axios from "axios";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";
import MaintenanceScreen from "../components/MaintenanceScreen";
import GoogleButton from "../components/auth/GoogleButton";

type SvgProps = ComponentPropsWithoutRef<"svg">;

function EyeIcon(props: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon(props: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.7 21.7 0 0 1-3.2 4.49" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function ChevronDown(props: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ChevronUp(props: SvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}
const isE2E = typeof window !== "undefined" && (window as any).Cypress;


export default function PaginaLogin() {
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [lembrarDeMim, setLembrarDeMim] = useState(false);
  const [erro, setErro] = useState("");
  const [, navigate] = useLocation();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [emailDestino, setEmailDestino] = useState<string | null>(null);
  const [sendingResend, setSendingResend] = useState(false);
  const [infoAberto, setInfoAberto] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);
    const [deletedInfo, setDeletedInfo] = useState<{
    daysLeft: number;
    restoreAvailable: boolean;
    message: string;
  } | null>(null);

  const [showRecover, setShowRecover] = useState(false);
  const [recoverSenha, setRecoverSenha] = useState("");
  const [mostrarRecoverSenha, setMostrarRecoverSenha] = useState(false);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<{
    message: string;
    reason?: string | null;
  } | null>(null);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [supportSending, setSupportSending] = useState(false);

  async function handleResend() {
    try {
      setSendingResend(true);

      const value = String(nomeDeUsuario || "").trim();

      const payload =
        value.includes("@")
          ? { email: value.toLowerCase() }
          : { nomeDeUsuario: value.toLowerCase() };

      await axios.post(
        `${API.BASE_URL}/api/cadastro/resend-verification`,
        payload
      );

      alert("Reenviamos o e-mail de verificação. Verifique sua caixa de entrada e spam.");
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Não foi possível reenviar agora.");
    } finally {
      setSendingResend(false);
    }
  }

    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();

      setErro("");
      setDeletedInfo(null);
      setBlockedInfo(null);
      setNeedVerify(false);
      setEmailDestino(null);
      setShowRecover(false);
      setRecoverSenha("");
      setMostrarRecoverSenha(false);

      if (!nomeDeUsuario || !senha) {
        setErro("Por favor, preencha todos os campos.");
        return;
      }

      try {
        const url = `${API.BASE_URL}/api/auth/login`;
        console.log("LOGIN URL USADA:", url);
        console.log("[APP LOGIN DEBUG]", {
          API_BASE_URL: API.BASE_URL,
          url,
          nomeDeUsuario,
          ambiente: import.meta.env.MODE,
          viteApiUrl: import.meta.env.VITE_API_URL,
        });

        const resp = await axios.post(url, { nomeDeUsuario, senha });
        const data = resp.data ?? {};

        if (data?.ok === false && data?.needVerification) {
          setNeedVerify(true);
          setEmailDestino(data.emailDestino ?? null);
          setErro(data.message ?? "Verifique seu e-mail para concluir o cadastro.");
          return;
        }

        if (data?.notice === "ACCOUNT_REACTIVATED") {
          alert(data?.noticeMessage ?? "Sua conta foi reativada por um administrador.");
        }

        const usuario = data.usuario ?? {};
        const usuarioId: string = String(usuario.id ?? data.id ?? "");
        const usuarioNome: string = String(usuario.nomeDeUsuario ?? data.nomeDeUsuario ?? "");
        const token: string = String(data.token ?? "");

        if (!token || !usuarioId) {
          throw new Error("Resposta inválida do servidor (token/usuarioId ausente).");
        }

        const store = lembrarDeMim ? localStorage : sessionStorage;

        [
          "token",
          "usuarioId",
          "nomeUsuario",
          "tipoUsuario",
          "usuarioTipoRaw",
          "tipoUsuarioId",
          "plano",
        ].forEach((k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });

        store.setItem("token", token);
        store.setItem("usuarioId", usuarioId);

        if (usuarioNome) store.setItem("nomeUsuario", usuarioNome);

        const rawTipo = String(usuario.tipo ?? data.tipo ?? "").toLowerCase();
        const isAdmin =
          String(usuario.tipo ?? data.tipo ?? "").toLowerCase() === "admin";

        const mapTipo: Record<string, string> = {
          admin: "admin",
          atleta: "atleta",
          professor: "professor",
          clube: "clube",
          escolinha: "escolinha",
          escola: "escola",
          olheiro: "olheiro",
          learning: "learning",
          federacao: "federacao",
          marca: "marca",
        };

        const tipoPadrao = isAdmin ? "admin" : mapTipo[rawTipo] ?? "atleta";
        store.setItem("tipoUsuario", tipoPadrao);
        store.setItem("usuarioTipoRaw", rawTipo);

        const tipoUsuarioId =
          data.tipoUsuarioId ||
          data?.olheiro?.id ||
          data?.professor?.id ||
          data?.clube?.id ||
          data?.escolinha?.id ||
          data?.atleta?.id ||
          null;

        if (tipoUsuarioId) store.setItem("tipoUsuarioId", String(tipoUsuarioId));

        const plano = String(usuario.plano ?? data.plano ?? "FREE");
        store.setItem("plano", plano);

        if (isAdmin) {
          navigate("/admin");
        } else {
          navigate("/perfil");
        }
      } catch (err: any) {
        console.error("[APP LOGIN ERRO]", {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
          url: err.config?.url,
          baseURL: err.config?.baseURL,
        });

        const data = err.response?.data;

        if (data?.code === "ACCOUNT_BLOCKED") {
          setBlockedInfo({
            message:
              data?.message ||
              "Sua conta foi bloqueada pelo admin. Se quiser saber mais informações clique abaixo.",
            reason: data?.blockedReason ?? null,
          });
          setErro("");
          return;
        }

        if (data?.code === "ACCOUNT_DELETED") {
          setDeletedInfo({
            daysLeft: Number(data?.daysLeft ?? 0),
            restoreAvailable: !!data?.restoreAvailable,
            message:
              data?.message ??
              "Sua conta foi excluída. Caso queira recuperar, verifique o prazo.",
          });
          setErro("");
          return;
        }

        setNeedVerify(!!data?.needVerification);
        setEmailDestino(data?.emailDestino ?? null);
        setErro(data?.message || "Nome de usuário ou senha inválidos.");
      }
    };

    async function handleRecover() {
      try {
        setRecoverLoading(true);

        const r = await axios.post(`${API.BASE_URL}/api/auth/restaurar-conta`, {
          nomeDeUsuario,
          senha: recoverSenha,
        });

        if (!r.data?.ok) {
          throw new Error(r.data?.message ?? "Não foi possível restaurar.");
        }

        const loginResp = await axios.post(`${API.BASE_URL}/api/auth/login`, {
          nomeDeUsuario,
          senha: recoverSenha,
        });

        const data = loginResp.data ?? {};
        const token = String(data.token ?? "");
        const usuarioId = String(data.usuario?.id ?? data.id ?? "");

        if (!token || !usuarioId) {
          alert("Conta restaurada! Agora faça login.");
          setShowRecover(false);
          setRecoverSenha("");
          setMostrarRecoverSenha(false);
          return;
        }

        const store = lembrarDeMim ? localStorage : sessionStorage;

        ["token", "usuarioId", "nomeUsuario", "tipoUsuario", "usuarioTipoRaw", "tipoUsuarioId", "plano"].forEach((k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        });

        store.setItem("token", token);
        store.setItem("usuarioId", usuarioId);

        const usuarioNome = String(data.usuario?.nomeDeUsuario ?? data.nomeDeUsuario ?? "");
        if (usuarioNome) store.setItem("nomeUsuario", usuarioNome);

        const rawTipo = String(data.usuario?.tipo ?? data.tipo ?? "").toLowerCase();
        const isAdmin = rawTipo === "admin";

        const mapTipo: Record<string, string> = {
          admin: "admin",
          atleta: "atleta",
          professor: "professor",
          clube: "clube",
          escolinha: "escolinha",
          escola: "escola",
          olheiro: "olheiro",
          learning: "learning",
          federacao: "federacao",
          marca: "marca",
        };

        store.setItem("tipoUsuario", isAdmin ? "admin" : (mapTipo[rawTipo] ?? "atleta"));
        store.setItem("usuarioTipoRaw", rawTipo);

        const tipoUsuarioId =
          data.tipoUsuarioId ||
          data?.olheiro?.id ||
          data?.professor?.id ||
          data?.clube?.id ||
          data?.escolinha?.id ||
          data?.atleta?.id ||
          null;

        if (tipoUsuarioId) store.setItem("tipoUsuarioId", String(tipoUsuarioId));

        const plano = String(data.usuario?.plano ?? data.plano ?? "FREE");
        store.setItem("plano", plano);

        alert("Conta restaurada com sucesso!");
        setShowRecover(false);
        setRecoverSenha("");
        setDeletedInfo(null);

        navigate(isAdmin ? "/admin" : "/perfil");
      } catch (e: any) {
        alert(e?.response?.data?.message ?? e?.message ?? "Não foi possível recuperar.");
      } finally {
        setRecoverLoading(false);
      }
    }

  useEffect(() => {
    if (isE2E) return;

    const token =
      Storage.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    if (!token) return;

    const tipo = (
      localStorage.getItem("tipoUsuario") ||
      sessionStorage.getItem("tipoUsuario") ||
      ""
    ).toLowerCase();

    navigate(tipo === "admin" ? "/admin" : "/perfil");
  }, []);

  useEffect(() => {
    if (isE2E) return;

    (async () => {
      try {
        const r = await axios.get(`${API.BASE_URL}/api/status/maintenance`, {
          timeout: 8000,
        });
        setMaintenanceMode(!!r.data?.maintenanceMode);
      } catch {
        setMaintenanceMode(false);
      } finally {
        setMaintenanceChecked(true);
      }
    })();
  }, []);

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      setErro("");
      setDeletedInfo(null);
      setBlockedInfo(null);
      setNeedVerify(false);
      setEmailDestino(null);

      const resp = await axios.post(`${API.BASE_URL}/api/auth/google`, {
        credential,
      });

      const data = resp.data ?? {};

      if (data?.needsCompletion) {
        sessionStorage.setItem(
          "google_pre_cadastro",
          JSON.stringify({
            preCadastroToken: data.preCadastroToken,
            googleProfile: data.googleProfile,
          })
        );

        navigate("/cadastro/google/complementar");
        return;
      }

      const usuario = data.usuario ?? {};
      const usuarioId: string = String(usuario.id ?? data.id ?? "");
      const usuarioNome: string = String(
        usuario.nomeDeUsuario ?? data.nomeDeUsuario ?? ""
      );
      const token: string = String(data.token ?? "");

      if (!token || !usuarioId) {
        throw new Error("Resposta inválida do servidor (token/usuarioId ausente).");
      }

      const store = lembrarDeMim ? localStorage : sessionStorage;

      [
        "token",
        "usuarioId",
        "nomeUsuario",
        "tipoUsuario",
        "usuarioTipoRaw",
        "tipoUsuarioId",
        "plano",
      ].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });

      store.setItem("token", token);
      store.setItem("usuarioId", usuarioId);

      if (usuarioNome) store.setItem("nomeUsuario", usuarioNome);

      const rawTipo = String(usuario.tipo ?? data.tipo ?? "").toLowerCase();
      const isAdmin = rawTipo === "admin";

      const mapTipo: Record<string, string> = {
        admin: "admin",
        atleta: "atleta",
        professor: "professor",
        clube: "clube",
        escolinha: "escolinha",
        escola: "escola",
        olheiro: "olheiro",
        learning: "learning",
        federacao: "federacao",
        marca: "marca",
      };

      const tipoPadrao = isAdmin ? "admin" : mapTipo[rawTipo] ?? "atleta";
      store.setItem("tipoUsuario", tipoPadrao);
      store.setItem("usuarioTipoRaw", rawTipo);

      const tipoUsuarioId =
        data.tipoUsuarioId ||
        data?.olheiro?.id ||
        data?.professor?.id ||
        data?.clube?.id ||
        data?.escolinha?.id ||
        data?.atleta?.id ||
        null;

      if (tipoUsuarioId) store.setItem("tipoUsuarioId", String(tipoUsuarioId));

      const plano = String(usuario.plano ?? data.plano ?? "FREE");
      store.setItem("plano", plano);

      navigate(isAdmin ? "/admin" : "/perfil");
    } catch (err: any) {
      console.error("Erro no login com Google:", err.response?.data || err.message);
      setErro(
        err?.response?.data?.message ||
          "Não foi possível entrar com Google agora."
      );
    }
  }, [lembrarDeMim, navigate]);

  if (!maintenanceChecked) {
    return <div className="p-6">Carregando…</div>;
  }

  if (maintenanceMode) {
    return (
      <MaintenanceScreen
        //title="Vai se aquecendo!"
        subtitle="Enquanto isso, estamos em manutenção por aqui. Já já voltamos! ⚽🔥"
        hint="Se estiver demorando, tente recarregar."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="md:w-1/2 bg-[#14532d] text-white flex flex-col items-center p-5 md:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-3 md:flex-col md:gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="cursor-pointer"
            aria-label="Voltar para Home"
          >
            <img
              src="/assets/usuarios/footera-logo.png"
              alt="Logo FootEra"
              className="
                shrink-0 object-contain transform-gpu
                w-14 h-14 sm:w-16 sm:h-16 md:w-[110px] md:h-[110px] lg:w-[130px] lg:h-[130px]
                origin-left md:origin-center mr-1
              "
            />
          </button>

            <h1 className="flex-1 md:flex-none text-center text-xl md:text-3xl font-bold">
              Bem-vindo à FootEra
            </h1>

            <button
              type="button"
              className="md:hidden p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
              aria-expanded={infoAberto}
              aria-controls="info-footera"
              onClick={() => setInfoAberto((v) => !v)}
              title={infoAberto ? "Recolher" : "Expandir"}
            >
              {infoAberto ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div
            id="info-footera"
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out
              ${
                infoAberto
                  ? "max-h-[720px] opacity-100"
                  : "max-h-0 opacity-0 md:max-h-[720px] md:opacity-100"
              }`}
          >
            <p className="text-center text-base md:text-2xl font-semibold mt-4">
              Treine. Aprenda. Se conecte. Evolua.
            </p>

            <p className="text-center text-sm md:text-lg mt-4 text-white/95">
              O ecossistema digital do futebol, feito para quem vive o jogo.
            </p>

            <div className="mt-6 p-5 md:p-6 rounded-2xl text-sm md:text-base text-left w-full bg-white/10 border border-white/10 shadow-lg">
              <h2 className="font-semibold text-xl md:text-2xl mb-4">
                O Que você encontra FootEra
              </h2>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-xl">🏋️</span>
                  <span>
                    <span className="font-semibold">Treinos e rotina</span> — exercícios, histórico e progresso.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="text-xl">🎓</span>
                  <span>
                    <span className="font-semibold">Learning</span> — metodologias, trilhas e cursos.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="text-xl">👥</span>
                  <span>
                    <span className="font-semibold">Rede social</span> — feed, conquistas e comunidade.
                  </span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="text-xl">🏆</span>
                  <span>
                    <span className="font-semibold">Métricas & badges</span> — visualização e reputação no esporte.
                  </span>
                </li>
              </ul>

              <div className="mt-5 flex items-center gap-3 text-white/90">
                <div className="h-px flex-1 bg-white/30" />
                <span className="italic font-semibold whitespace-nowrap">
                  Para quem vive futebol.
                </span>
                <div className="h-px flex-1 bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative md:w-1/2 bg-cream flex justify-center items-center p-6 md:p-10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0">
          <div
            aria-hidden
            className="w-[420px] h-[420px] opacity-[0.06] md:opacity-[0.08] rounded-full overflow-hidden"
            style={{
              backgroundImage: "url('/assets/usuarios/footera-logo.png')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center 20%",
              backgroundSize: "85% auto",
              filter: "grayscale(100%)",
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-md bg-[#f8f8f8] shadow-xl rounded-[28px] p-7 md:p-8 mx-auto">
          <h2 className="text-xl font-semibold mb-2 text-center">Entrar</h2>
          <p className="text-sm text-center text-gray-600 mb-6">
            Entre com seu usuário (ou e-mail) e senha
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Usuário ou e-mail
              </label>
              <input
                name="nomeDeUsuario"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Seu usuário ou e-mail"
                value={nomeDeUsuario}
                onChange={(e) => setNomeDeUsuario(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Senha</label>
              <div className="relative">
                <input
                  name="senha"
                  type={mostrarSenha ? "text" : "password"}
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                  onClick={() => setMostrarSenha((v) => !v)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="lembrarDeMim"
                checked={lembrarDeMim}
                onChange={(e) => setLembrarDeMim(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="lembrarDeMim" className="text-sm">
                Lembrar de mim
              </label>
            </div>

            {erro && <p className="text-sm text-red-500 mb-3">{erro}</p>}

            {deletedInfo && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <div className="font-medium">Sua conta foi excluída</div>
                <div className="mt-1">{deletedInfo.message}</div>

                {deletedInfo.restoreAvailable ? (
                  <>
                    {!showRecover ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRecover(true)}
                          className="w-full rounded-lg bg-red-600 hover:bg-red-700 text-white py-2 font-medium"
                        >
                          Recuperar conta
                        </button>

                        <div className="text-xs text-red-800/80">
                          Você tem {deletedInfo.daysLeft} dia(s) restantes para recuperar.
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-red-200 bg-white p-3 text-left">
                        <div className="text-sm font-semibold mb-1">Confirmar recuperação</div>
                        <div className="text-xs text-gray-600 mb-3">
                          Digite sua senha para restaurar a conta.
                        </div>

                        <label className="block text-sm font-medium mb-1">Senha</label>
                          <div className="relative">
                            <input
                              type={mostrarRecoverSenha ? "text" : "password"}
                              className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
                              placeholder="Digite sua senha"
                              value={recoverSenha}
                              onChange={(e) => setRecoverSenha(e.target.value)}
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                              onClick={() => setMostrarRecoverSenha((v) => !v)}
                              onMouseDown={(e) => e.preventDefault()}
                              aria-label={mostrarRecoverSenha ? "Ocultar senha" : "Mostrar senha"}
                              title={mostrarRecoverSenha ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {mostrarRecoverSenha ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                          </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecover(false);
                              setRecoverSenha("");
                              setMostrarRecoverSenha(false);
                            }}
                            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm"
                            disabled={recoverLoading}
                          >
                            Cancelar
                          </button>

                          <button
                            type="button"
                            onClick={handleRecover}
                            disabled={recoverLoading || !recoverSenha || !nomeDeUsuario}
                            className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white py-2 text-sm font-medium disabled:opacity-60"
                          >
                            {recoverLoading ? "Recuperando..." : "Recuperar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-xs text-red-800/80">
                    O prazo de recuperação expirou. Entre em contato com o suporte.
                  </div>
                )}
              </div>
            )}

            {blockedInfo && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Sua conta foi bloqueada</div>
                <div className="mt-1">{blockedInfo.message}</div>

                {blockedInfo.reason ? (
                  <div className="mt-2 text-xs text-amber-800/80">
                    Motivo: {blockedInfo.reason}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSupportOpen(true)}
                    className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white py-2 font-medium"
                  >
                    Quero saber mais / Falar com suporte
                  </button>
                </div>
              </div>
            )}

            {needVerify && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="mb-2">
                  Verifique seu e-mail para concluir o cadastro
                  {emailDestino ? <> ({emailDestino})</> : null}.
                </div>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={sendingResend || !nomeDeUsuario}
                  className={`px-3 py-1.5 rounded-md ${
                    sendingResend
                      ? "bg-amber-300"
                      : "bg-amber-500 hover:bg-amber-600"
                  } text-white`}
                >
                  {sendingResend ? "Reenviando..." : "Reenviar e-mail"}
                </button>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-900 hover:bg-green-800 text-white font-medium py-2 rounded transition active:scale-[0.98]"
            >
              Entrar
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-500">ou</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            <div className="w-full">
              <GoogleButton
                text="continue_with"
                onCredential={handleGoogleCredential}
              />
            </div>

            <a
              href="/esqueci-senha"
              className="text-green-700 underline text-right text-sm mt-4 block"
            >
              Esqueci minha senha
            </a>
          </form>

          <div className="text-center text-sm text-gray-600 mt-4">
            <span>Não tem uma conta? </span>
            <a href="/cadastro" className="text-green-700 underline">
              Cadastre-se
            </a>

            {showRecover && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-left">
                <div className="text-sm font-semibold mb-1">Recuperar conta</div>
                <div className="text-xs text-gray-600 mb-3">
                  Confirme sua senha para restaurar sua conta.
                </div>

                <label className="block text-sm font-medium mb-1">Senha</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Digite sua senha"
                  value={recoverSenha}
                  onChange={(e) => setRecoverSenha(e.target.value)}
                />

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecover(false);
                      setRecoverSenha("");
                      setMostrarRecoverSenha(false);
                    }}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-sm"
                    disabled={recoverLoading}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleRecover}
                    disabled={recoverLoading || !recoverSenha || !nomeDeUsuario}
                    className="flex-1 rounded-lg bg-green-900 hover:bg-green-800 text-white py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {recoverLoading ? "Recuperando..." : "Recuperar"}
                  </button>
                </div>
              </div>
            )}

            {supportOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setSupportOpen(false)}
                />
                <div className="relative bg-white w-full max-w-lg rounded-xl shadow-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Falar com suporte</div>
                    <button onClick={() => setSupportOpen(false)} className="text-gray-600">
                      ✕
                    </button>
                  </div>

                  <div className="text-xs text-gray-600 mb-2">
                    Explique o que aconteceu. Vamos enviar isso para o admin/suporte.
                  </div>

                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={4}
                    value={supportMsg}
                    onChange={(e) => setSupportMsg(e.target.value)}
                    placeholder="Digite sua mensagem…"
                  />

                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      className="px-4 py-2 rounded bg-gray-200"
                      onClick={() => setSupportOpen(false)}
                      disabled={supportSending}
                    >
                      Cancelar
                    </button>

                    <button
                      className="px-4 py-2 rounded bg-green-900 text-white disabled:opacity-60"
                      disabled={supportSending || !supportMsg.trim()}
                      onClick={async () => {
                        try {
                          setSupportSending(true);
                          await axios.post(`${API.BASE_URL}/api/feedback/blocked`, {
                            nomeDeUsuario,
                            mensagem: supportMsg,
                          });
                          alert("Mensagem enviada! Aguarde o retorno do suporte.");
                          setSupportOpen(false);
                          setSupportMsg("");
                        } catch (e: any) {
                          alert(e?.response?.data?.message ?? "Não foi possível enviar agora.");
                        } finally {
                          setSupportSending(false);
                        }
                      }}
                    >
                      {supportSending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}