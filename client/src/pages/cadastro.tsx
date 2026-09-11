//client/src/pages/cadastro
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import axios from "axios";

import logo from "/assets/usuarios/footera-logo.png";
import { API } from "../config.js";
import GoogleButton from "../components/auth/GoogleButton";
import MaintenanceScreen from "../components/MaintenanceScreen";
import { applyAuthSession, consumirRetornoAuth } from "../utils/authSession.js";

type SvgProps = ComponentPropsWithoutRef<"svg">;

type TipoPerfil =
  | "Atleta"
  | "Professor"
  | "Olheiro"
  | "Learning"
  | "Escolinha"
  | "Clube"
  | "Federacao"
  | "Marca";

type Responsavel = {
  nome: string;
  email: string;
  telefone?: string;
};

const mapTipo = {
  Atleta: "ATLETA",
  Professor: "PROFESSOR",
  Escolinha: "ESCOLINHA",
  Clube: "CLUBE",
  Olheiro: "OLHEIRO",
  Federacao: "FEDERACAO",
  Marca: "MARCA",
  Learning: "LEARNING",
} as const;

const PERFIS_PESSOA: TipoPerfil[] = [
  "Atleta",
  "Professor",
  "Olheiro",
  "Learning",
];

const PERFIS_ORGANIZACAO: TipoPerfil[] = [
  "Escolinha",
  "Clube",
  "Federacao",
  "Marca",
];

const PRECISA_NASCIMENTO = (tipo: TipoPerfil) => PERFIS_PESSOA.includes(tipo);

function isOrganizacao(tipo: TipoPerfil) {
  return ["Escolinha", "Clube", "Federacao", "Marca"].includes(tipo);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const USER_RE = /^(?=.{3,20}$)[a-z0-9._]+$/i;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PHONE_RE = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
const DATA_MINIMA_NASCIMENTO = "1900-01-01";
const IDADE_MINIMA_PROFISSIONAL_SCOUT = 17;

function exigeMaisDe16Anos(tipo: TipoPerfil) {
  return tipo === "Professor" || tipo === "Olheiro";
}

const perfilVisual: Record<
  TipoPerfil,
  { titulo: string; subtitulo: string; emoji: string }
> = {
  Atleta: {
    titulo: "Atleta",
    subtitulo: "Para jogadores",
    emoji: "⚽",
  },
  Professor: {
    titulo: "Profissional",
    subtitulo: "Professor ou treinador",
    emoji: "🎯",
  },
  Olheiro: {
    titulo: "Scout",
    subtitulo: "Avaliação de talentos",
    emoji: "🔭",
  },
  Learning: {
    titulo: "Learning",
    subtitulo: "Cursos, lives e metodologias",
    emoji: "🎓",
  },
  Escolinha: {
    titulo: "Escolinha",
    subtitulo: "Formação de atletas",
    emoji: "🏟️",
  },
  Clube: {
    titulo: "Clube",
    subtitulo: "Clube profissional",
    emoji: "🛡️",
  },
  Federacao: {
    titulo: "Federação",
    subtitulo: "Canal oficial e eventos",
    emoji: "🏅",
  },
  Marca: {
    titulo: "Marca",
    subtitulo: "Parceira ou patrocinadora",
    emoji: "👕",
  },
};

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

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataNascimentoValida(iso: string) {
  return Boolean(iso && iso >= DATA_MINIMA_NASCIMENTO && iso <= hojeISO());
}

function calcIdade(iso: string) {
  if (!iso) return null;

  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;

  const aindaNaoFezAniversario =
    hoje.getMonth() + 1 < mes ||
    (hoje.getMonth() + 1 === mes && hoje.getDate() < dia);

  if (aindaNaoFezAniversario) idade--;
  return Math.max(0, idade);
}

function dataMaximaNascimentoPorTipo(tipo: TipoPerfil) {
  if (!exigeMaisDe16Anos(tipo)) {
    return hojeISO();
  }

  const hoje = new Date();

  const limite = new Date(
    hoje.getFullYear() - IDADE_MINIMA_PROFISSIONAL_SCOUT,
    hoje.getMonth(),
    hoje.getDate(),
  );

  const ano = limite.getFullYear();

  const mes = String(limite.getMonth() + 1).padStart(2, "0");

  const dia = String(limite.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataNascimentoValidaParaTipo(tipo: TipoPerfil, iso: string) {
  if (!dataNascimentoValida(iso)) {
    return false;
  }

  if (!exigeMaisDe16Anos(tipo)) {
    return true;
  }

  const idadeCalculada = calcIdade(iso);

  return (
    idadeCalculada !== null && idadeCalculada >= IDADE_MINIMA_PROFISSIONAL_SCOUT
  );
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 350) {
  let timer: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function CheckBadge() {
  return (
    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-800 text-[11px] text-white">
      ✓
    </span>
  );
}

function TipoContaCard({
  ativo,
  emoji,
  titulo,
  subtitulo,
  onClick,
}: {
  ativo: boolean;
  emoji: string;
  titulo: string;
  subtitulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex flex-1 items-center gap-3 rounded-xl border p-4 text-left transition",
        ativo
          ? "border-green-800 bg-green-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-green-300",
      ].join(" ")}
    >
      {ativo && <CheckBadge />}

      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-2xl">
        {emoji}
      </span>

      <span>
        <strong className="block text-sm text-green-950">{titulo}</strong>
        <span className="block text-xs text-gray-500">{subtitulo}</span>
      </span>
    </button>
  );
}

function PerfilCard({
  tipo,
  ativo,
  onClick,
}: {
  tipo: TipoPerfil;
  ativo: boolean;
  onClick: () => void;
}) {
  const item = perfilVisual[tipo];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-xl border p-3 text-center transition",
        ativo
          ? "border-green-800 bg-green-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-green-300",
      ].join(" ")}
    >
      {ativo && <CheckBadge />}
      <div className="mb-2 text-3xl">{item.emoji}</div>
      <strong className="block text-xs text-green-950">{item.titulo}</strong>
      <span className="mt-1 block text-[10px] text-gray-500">
        {item.subtitulo}
      </span>
    </button>
  );
}

function SectionTitle({
  numero,
  titulo,
  descricao,
}: {
  numero: number;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white">
        {numero}
      </div>
      <div>
        <h3 className="font-bold text-green-950">{titulo}</h3>
        <p className="text-xs text-gray-500">{descricao}</p>
      </div>
    </div>
  );
}

function MinimalInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  error = false,
  right,
  autoComplete,
}: {
  label: string;
  icon: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  error?: boolean;
  right?: ReactNode;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-green-950">
        {label}
      </label>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          {icon}
        </span>

        <input
          type={type}
          readOnly={readOnly}
          autoComplete={autoComplete}
          className={[
            "w-full rounded-lg border py-2.5 pl-10 pr-10 text-sm outline-none transition",
            "placeholder:text-gray-400 focus:border-green-800 focus:ring-2 focus:ring-green-100",
            readOnly ? "bg-gray-100 text-gray-600" : "bg-white",
            error ? "border-red-400" : "border-gray-300",
          ].join(" ")}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />

        {right}
      </div>
    </div>
  );
}

export default function Cadastro() {
  const [, navigate] = useLocation();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);

  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>("Atleta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [responsavel, setResponsavel] = useState<Responsavel>({
    nome: "",
    email: "",
    telefone: "",
  });
  const [aceitaTermos, setAceitaTermos] = useState(false);

  const [emailDisp, setEmailDisp] = useState<null | boolean>(null);
  const [userDisp, setUserDisp] = useState<null | boolean>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [finalizandoCadastro, setFinalizandoCadastro] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [infoAberto, setInfoAberto] = useState(false);

  const isOrg = isOrganizacao(tipoPerfil);
  const idade = useMemo(() => calcIdade(dataNascimento), [dataNascimento]);
  const precisaResponsavel =
    tipoPerfil === "Atleta" && idade !== null && idade < 12;

  const emailValido = EMAIL_RE.test(email.trim());
  const usernameLimpo = nomeDeUsuario.trim().toLowerCase();
  const usernameValido = !usernameLimpo || USER_RE.test(usernameLimpo);
  const senhaForte = PASS_RE.test(senha);
  const confirmarOk = confirmarSenha === senha && confirmarSenha.length > 0;

  const verificarEmail = useMemo(
    () =>
      debounce(async (valor: string) => {
        const emailNormalizado = valor.trim().toLowerCase();
        if (!EMAIL_RE.test(emailNormalizado)) {
          setEmailDisp(null);
          return;
        }

        try {
          const response = await fetch(
            `${API.BASE_URL}/api/cadastro/check/email?email=${encodeURIComponent(
              emailNormalizado,
            )}`,
          );
          const data = await response.json();
          setEmailDisp(Boolean(data?.disponivel));
        } catch {
          setEmailDisp(null);
        }
      }),
    [],
  );

  const verificarUsername = useMemo(
    () =>
      debounce(async (valor: string) => {
        const username = valor.trim().toLowerCase();

        if (!username) {
          setUserDisp(null);
          return;
        }

        if (!USER_RE.test(username)) {
          setUserDisp(null);
          return;
        }

        try {
          const response = await fetch(
            `${API.BASE_URL}/api/cadastro/check/username?username=${encodeURIComponent(
              username,
            )}`,
          );
          const data = await response.json();
          setUserDisp(Boolean(data?.disponivel));
        } catch {
          setUserDisp(null);
        }
      }),
    [],
  );

  useEffect(() => {
    verificarEmail(email);
  }, [email, verificarEmail]);

  useEffect(() => {
    verificarUsername(nomeDeUsuario);
  }, [nomeDeUsuario, verificarUsername]);

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(
          `${API.BASE_URL}/api/status/maintenance`,
          { timeout: 8000 },
        );
        setMaintenanceMode(Boolean(response.data?.maintenanceMode));
      } catch {
        setMaintenanceMode(false);
      } finally {
        setMaintenanceChecked(true);
      }
    })();
  }, []);

  const podeFinalizarCadastro = () => {
    const nomeLimpo = nome.trim();

    if (!aceitaTermos) {
      setErro(
        "Você deve aceitar os Termos de Uso e a Política de Privacidade.",
      );
      return false;
    }

    if (isOrg && !nomeLimpo) {
      setErro("Informe o nome da organização.");
      return false;
    }

    if (!isOrg && !nomeLimpo && !usernameLimpo) {
      setErro("Informe seu nome ou escolha um nome de usuário.");
      return false;
    }

    if (!emailValido) {
      setErro("Informe um e-mail válido.");
      return false;
    }

    if (emailDisp === false) {
      setErro("E-mail já cadastrado.");
      return false;
    }

    if (!usernameValido) {
      setErro(
        "Nome de usuário inválido. Use 3–20 caracteres com letras, números, ponto ou underline.",
      );
      return false;
    }

    if (usernameLimpo && userDisp === false) {
      setErro("Nome de usuário indisponível.");
      return false;
    }

    if (!senhaForte) {
      setErro(
        "A senha deve ter pelo menos 8 caracteres, uma letra e um número.",
      );
      return false;
    }

    if (!confirmarOk) {
      setErro("As senhas não coincidem.");
      return false;
    }

    if (PRECISA_NASCIMENTO(tipoPerfil)) {
      if (!dataNascimento) {
        setErro("Informe a data de nascimento.");
        return false;
      }

      if (!dataNascimentoValidaParaTipo(tipoPerfil, dataNascimento)) {
        if (exigeMaisDe16Anos(tipoPerfil)) {
          setErro(
            tipoPerfil === "Professor"
              ? "Para criar um perfil Profissional, é necessário ter mais de 16 anos."
              : "Para criar um perfil Scout, é necessário ter mais de 16 anos.",
          );
        } else {
          setErro("A data de nascimento deve estar entre 01/01/1900 e hoje.");
        }

        return false;
      }
    }

    if (precisaResponsavel) {
      if (!responsavel.nome.trim()) {
        setErro("Informe o nome do responsável.");
        return false;
      }

      if (!EMAIL_RE.test(responsavel.email.trim())) {
        setErro("Informe um e-mail válido do responsável.");
        return false;
      }

      if (
        responsavel.telefone?.trim() &&
        !PHONE_RE.test(responsavel.telefone.trim())
      ) {
        setErro(
          "Informe um telefone válido do responsável ou deixe em branco.",
        );
        return false;
      }
    }

    setErro("");
    return true;
  };

  const registrarConsentimento = async (
    token: string | undefined,
    menorComResponsavel: boolean,
  ) => {
    try {
      await fetch(`${API.BASE_URL}/api/legal/consentimentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          doc: menorComResponsavel
            ? "Termos e Privacidade (menor)"
            : "Termos e Privacidade",
          versao: {
            termos: "2025-10-06",
            privacidade: "2025-10-06",
          },
          hashes: {
            termosHash: "<opcional>",
            privHash: "<opcional>",
          },
          metodo: "click-wrap",
        }),
      });
    } catch (error) {
      console.warn("Falha ao registrar consentimento:", error);
    }
  };

  const handleFinalizar = async () => {
    if (finalizandoCadastro || !podeFinalizarCadastro()) return;

    setFinalizandoCadastro(true);
    setErro("");
    setSucesso("");

    try {
      const payload: Record<string, unknown> = {
        tipo: mapTipo[tipoPerfil],
        email: email.trim().toLowerCase(),
        senha,
        ...(nome.trim() ? { nome: nome.trim() } : {}),
        ...(usernameLimpo ? { nomeDeUsuario: usernameLimpo } : {}),
        ...(PRECISA_NASCIMENTO(tipoPerfil) ? { dataNascimento } : {}),
        ...(precisaResponsavel
          ? {
              responsavel: {
                nome: responsavel.nome.trim(),
                email: responsavel.email.trim().toLowerCase(),
                telefone: responsavel.telefone?.trim() || undefined,
              },
            }
          : {}),
      };

      const response = await fetch(`${API.BASE_URL}/api/cadastro/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Não foi possível criar sua conta.",
        );
      }

      const token = data?.token || data?.accessToken || data?.jwt;
      await registrarConsentimento(token, precisaResponsavel);

      setSucesso(
        "Conta criada com sucesso! Verifique seu e-mail para confirmar a conta.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });

      setTimeout(() => navigate("/login"), 1800);
    } catch (error: any) {
      setErro(error?.message || "Erro ao realizar cadastro.");
    } finally {
      setFinalizandoCadastro(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      try {
        setErro("");
        setSucesso("");

        const response = await axios.post(`${API.BASE_URL}/api/auth/google`, {
          credential,
        });

        const data = response.data ?? {};

        if (data?.needsCompletion) {
          sessionStorage.setItem(
            "google_pre_cadastro",
            JSON.stringify({
              preCadastroToken: data.preCadastroToken,
              googleProfile: data.googleProfile,
            }),
          );

          navigate("/cadastro/google/complementar");
          return;
        }

        const { isAdmin } = applyAuthSession(data, { lembrar: false });

        navigate(isAdmin ? "/admin" : consumirRetornoAuth("/perfil"));
      } catch (error: any) {
        console.error(
          "Erro no cadastro/login com Google:",
          error?.response?.data || error?.message,
        );

        setErro(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            "Não foi possível continuar com Google agora.",
        );
      }
    },
    [navigate],
  );

  if (!maintenanceChecked) {
    return <div className="p-6">Carregando…</div>;
  }

  if (maintenanceMode) {
    return (
      <MaintenanceScreen
        subtitle="Enquanto isso, estamos ajustando o cadastro por aqui. Já já voltamos! ⚽🔥"
        hint="Confira as novidades enquanto finalizamos os ajustes."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream lg:flex-row">
      <div className="w-full bg-[#14532d] text-white flex flex-col items-center px-5 py-6 sm:px-8 lg:w-1/2 lg:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer"
              aria-label="Voltar para Home"
            >
              <img
                src="/assets/usuarios/footera-logo.png"
                alt="Logo FootEra"
                className="shrink-0 object-contain transform-gpu w-14 h-14 sm:w-16 sm:h-16 lg:w-[130px] lg:h-[130px] origin-left lg:origin-center mr-1"
              />
            </button>

            <h1 className="flex-1 lg:flex-none text-center text-xl lg:text-3xl font-bold leading-tight">
              Bem-vindo à FootEra
            </h1>

            <button
              type="button"
              className="lg:hidden shrink-0 p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
              aria-expanded={infoAberto}
              aria-controls="cadastro-info"
              onClick={() => setInfoAberto((valor) => !valor)}
              title={infoAberto ? "Recolher" : "Expandir"}
            >
              {infoAberto ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div
            id="cadastro-info"
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
              infoAberto
                ? "max-h-[520px] opacity-100"
                : "max-h-0 opacity-0 lg:max-h-[520px] lg:opacity-100"
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
                O que você encontra na FootEra
              </h2>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-xl">🏋️</span>
                  <span>
                    <span className="font-semibold">Treinos e rotina</span> —
                    exercícios, histórico e progresso.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">🎓</span>
                  <span>
                    <span className="font-semibold">Learning</span> —
                    metodologias, trilhas e cursos.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">👥</span>
                  <span>
                    <span className="font-semibold">Rede social</span> — feed,
                    conquistas e comunidade.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">🏆</span>
                  <span>
                    <span className="font-semibold">Métricas & badges</span> —
                    evolução e reputação no esporte.
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

      <div className="relative w-full bg-cream flex justify-center items-start px-4 py-7 sm:px-6 lg:w-1/2 lg:p-10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0">
          <div
            aria-hidden
            className="w-[420px] h-[420px] opacity-[0.06] lg:opacity-[0.08] rounded-full overflow-hidden"
            style={{
              backgroundImage: `url(${logo})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center 20%",
              backgroundSize: "85% auto",
              filter: "grayscale(100%)",
            }}
          />
        </div>

        <div className="relative z-10 bg-white rounded-2xl shadow-md w-full max-w-xl min-w-0 p-4 sm:p-6 mx-auto lg:mt-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-green-950">
              Criar conta
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Só pedimos o necessário agora. O restante do perfil pode ser
              preenchido depois em Editar Perfil.
            </p>
          </div>

          <section className="border-b border-gray-100 pb-6">
            <SectionTitle
              numero={1}
              titulo="Escolha seu perfil"
              descricao="Defina como você vai começar na FootEra."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TipoContaCard
                ativo={!isOrg}
                emoji="👤"
                titulo="Pessoa"
                subtitulo="Para indivíduos"
                onClick={() => setTipoPerfil("Atleta")}
              />

              <TipoContaCard
                ativo={isOrg}
                emoji="🏢"
                titulo="Organização"
                subtitulo="Para clubes e instituições"
                onClick={() => setTipoPerfil("Escolinha")}
              />
            </div>

            <div className="mt-5">
              <p className="mb-3 text-sm font-semibold text-green-950">
                {isOrg
                  ? "Que tipo de organização você representa?"
                  : "Qual é o seu perfil principal?"}
              </p>

              <div
                role="note"
                className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3"
              >
                <p className="text-sm font-medium text-green-950">
                  Escolha como você quer começar na FootEra.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-green-800">
                  Depois, você poderá adicionar outros perfis a esta mesma conta
                  em Editar perfil. Não será necessário criar outra conta.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(isOrg ? PERFIS_ORGANIZACAO : PERFIS_PESSOA).map((tipo) => (
                  <PerfilCard
                    key={tipo}
                    tipo={tipo}
                    ativo={tipoPerfil === tipo}
                    onClick={() => setTipoPerfil(tipo)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-gray-100 py-6">
            <SectionTitle
              numero={2}
              titulo="Dados da conta"
              descricao="Dados usados para identificação e acesso."
            />

            <div className="space-y-4">
              <MinimalInput
                label={isOrg ? "Nome da organização*" : "Nome"}
                icon={isOrg ? "🏢" : "👤"}
                value={nome}
                placeholder={
                  isOrg
                    ? "Nome oficial ou nome público"
                    : "Como você quer ser chamado?"
                }
                onChange={setNome}
              />

              {!isOrg && (
                <p className="-mt-2 text-xs text-gray-500">
                  Você pode informar seu nome ou usar apenas um nome de usuário.
                </p>
              )}

              <MinimalInput
                label="Nome de usuário (@) — opcional"
                icon="@"
                value={nomeDeUsuario}
                placeholder="Ex.: joaosilva10"
                error={
                  Boolean(nomeDeUsuario) && !USER_RE.test(nomeDeUsuario.trim())
                }
                onChange={setNomeDeUsuario}
              />

              {nomeDeUsuario && (
                <p
                  className={`-mt-2 text-xs ${
                    !USER_RE.test(nomeDeUsuario.trim()) || userDisp === false
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {!USER_RE.test(nomeDeUsuario.trim())
                    ? "Use 3–20 caracteres: letras, números, ponto e underline."
                    : userDisp === null
                      ? "Verificando disponibilidade..."
                      : userDisp
                        ? "Nome de usuário disponível."
                        : "Nome de usuário indisponível."}
                </p>
              )}

              <MinimalInput
                label="E-mail*"
                icon="✉️"
                type="email"
                value={email}
                placeholder="exemplo@email.com"
                error={Boolean(email) && !emailValido}
                onChange={setEmail}
                autoComplete="email"
              />

              {email && (
                <p
                  className={`-mt-2 text-xs ${
                    !emailValido || emailDisp === false
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {!emailValido
                    ? "Formato de e-mail inválido."
                    : emailDisp === null
                      ? "Verificando disponibilidade..."
                      : emailDisp
                        ? "E-mail disponível."
                        : "Este e-mail já está cadastrado."}
                </p>
              )}

              <MinimalInput
                label="Senha*"
                icon="🔒"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                placeholder="Mínimo de 8 caracteres"
                error={Boolean(senha) && !senhaForte}
                onChange={setSenha}
                autoComplete="new-password"
                right={
                  <button
                    type="button"
                    aria-label={
                      mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setMostrarSenha((valor) => !valor)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              {senha && (
                <p
                  className={`-mt-2 text-xs ${senhaForte ? "text-green-700" : "text-red-600"}`}
                >
                  Mínimo de 8 caracteres, com pelo menos uma letra e um número.
                </p>
              )}

              <MinimalInput
                label="Confirmar senha*"
                icon="🔒"
                type={mostrarConfirmar ? "text" : "password"}
                value={confirmarSenha}
                placeholder="Repita sua senha"
                error={Boolean(confirmarSenha) && !confirmarOk}
                onChange={setConfirmarSenha}
                autoComplete="new-password"
                right={
                  <button
                    type="button"
                    aria-label={
                      mostrarConfirmar ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setMostrarConfirmar((valor) => !valor)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {mostrarConfirmar ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                }
              />

              {confirmarSenha && (
                <p
                  className={`-mt-2 text-xs ${confirmarOk ? "text-green-700" : "text-red-600"}`}
                >
                  {confirmarOk
                    ? "Senhas conferem."
                    : "As senhas não coincidem."}
                </p>
              )}
            </div>
          </section>

          {PRECISA_NASCIMENTO(tipoPerfil) && (
            <section className="border-b border-gray-100 py-6">
              <SectionTitle
                numero={3}
                titulo="Dados essenciais"
                descricao="Usamos a data de nascimento para regras da conta e, no atleta, para calcular idade e categoria automaticamente."
              />

              <div>
                <label className="mb-1 block text-sm font-semibold text-green-950">
                  Data de nascimento*
                </label>
                <input
                  type="date"
                  min={DATA_MINIMA_NASCIMENTO}
                  max={dataMaximaNascimentoPorTipo(tipoPerfil)}
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-green-800 focus:ring-2 focus:ring-green-100 ${
                    dataNascimento &&
                    !dataNascimentoValidaParaTipo(tipoPerfil, dataNascimento)
                      ? "border-red-400"
                      : "border-gray-300"
                  }`}
                />

                {exigeMaisDe16Anos(tipoPerfil) && (
                  <p className="mt-1 text-xs text-gray-500">
                    É necessário ter mais de 16 anos para criar um perfil{" "}
                    {tipoPerfil === "Professor" ? "Profissional" : "Scout"}.
                  </p>
                )}

                {idade !== null && dataNascimentoValida(dataNascimento) && (
                  <p className="mt-1 text-xs text-gray-500">
                    Idade calculada: {idade} anos.
                  </p>
                )}

                {tipoPerfil === "Atleta" && (
                  <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-900">
                    A categoria do atleta será calculada automaticamente pela
                    data de nascimento. A posição poderá ser definida depois em
                    Editar Perfil ou ao entrar nos Treinos.
                  </div>
                )}
              </div>

              {precisaResponsavel && (
                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="font-semibold text-green-950">
                    Responsável legal
                  </h4>
                  <p className="mb-4 mt-1 text-xs text-gray-500">
                    Obrigatório para atletas menores de 12 anos.
                  </p>

                  <div className="space-y-3">
                    <MinimalInput
                      label="Nome do responsável*"
                      icon="👤"
                      value={responsavel.nome}
                      onChange={(valor) =>
                        setResponsavel((atual) => ({ ...atual, nome: valor }))
                      }
                    />

                    <MinimalInput
                      label="E-mail do responsável*"
                      icon="✉️"
                      type="email"
                      value={responsavel.email}
                      onChange={(valor) =>
                        setResponsavel((atual) => ({ ...atual, email: valor }))
                      }
                    />

                    <MinimalInput
                      label="Telefone do responsável — opcional"
                      icon="📱"
                      value={responsavel.telefone || ""}
                      placeholder="(00) 00000-0000"
                      onChange={(valor) =>
                        setResponsavel((atual) => ({
                          ...atual,
                          telefone: valor,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="pt-6">
            <SectionTitle
              numero={PRECISA_NASCIMENTO(tipoPerfil) ? 4 : 3}
              titulo="Termos e criação da conta"
              descricao="Depois você poderá completar foto, localização, vínculos e demais informações no seu perfil."
            />

            <label className="flex items-start text-sm text-gray-700">
              <input
                type="checkbox"
                className="mr-2 mt-1"
                checked={aceitaTermos}
                onChange={(e) => setAceitaTermos(e.target.checked)}
              />
              <span>
                Li e aceito os{" "}
                <a
                  href="/termos?tab=termos"
                  className="text-blue-700 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a
                  href="/termos?tab=privacidade"
                  className="text-blue-700 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de Privacidade
                </a>
                .
              </span>
            </label>

            {erro && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {sucesso}
              </div>
            )}

            <button
              type="button"
              disabled={finalizandoCadastro}
              onClick={() => void handleFinalizar()}
              className="mt-5 w-full rounded-lg bg-green-900 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {finalizandoCadastro ? "Criando conta..." : "Criar conta"}
            </button>

            <div className="my-5 flex min-w-0 items-center gap-3">
              <div className="h-px min-w-0 flex-1 bg-gray-200" />
              <span className="shrink-0 text-xs text-gray-500">ou</span>
              <div className="h-px min-w-0 flex-1 bg-gray-200" />
            </div>

            <div className="w-full min-w-0 overflow-hidden">
              <GoogleButton
                text="signup_with"
                onCredential={handleGoogleCredential}
              />
            </div>

            <p className="mt-5 text-center text-sm text-gray-600">
              Já tem uma conta?{" "}
              <a href="/login" className="text-green-700 underline">
                Faça login
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
