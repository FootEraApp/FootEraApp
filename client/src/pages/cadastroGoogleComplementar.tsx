import {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { useLocation } from "wouter";
import axios from "axios";
import logo from "/assets/usuarios/footera-logo.png";
import { API } from "../config.js";
import MaintenanceScreen from "../components/MaintenanceScreen";
import {
  applyAuthSession,
  consumirRetornoAuth,
} from "../utils/authSession.js";

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

type GoogleProfile = {
  email: string;
  name: string;
  picture?: string | null;
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

const PRECISA_NASCIMENTO = (tipo: TipoPerfil) =>
  PERFIS_PESSOA.includes(tipo);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_RE = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
const DATA_MINIMA_NASCIMENTO = "1900-01-01";
const PLACEHOLDER_AVATAR = logo;
const IDADE_MINIMA_PROFISSIONAL_SCOUT = 17;

function exigeMaisDe16Anos(
  tipo: TipoPerfil
) {
  return (
    tipo === "Professor" ||
    tipo === "Olheiro"
  );
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
  return Boolean(
    iso &&
      iso >= DATA_MINIMA_NASCIMENTO &&
      iso <= hojeISO()
  );
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

function dataMaximaNascimentoPorTipo(
  tipo: TipoPerfil
) {
  if (!exigeMaisDe16Anos(tipo)) {
    return hojeISO();
  }

  const hoje = new Date();

  const limite =
    new Date(
      hoje.getFullYear() -
        IDADE_MINIMA_PROFISSIONAL_SCOUT,
      hoje.getMonth(),
      hoje.getDate()
    );

  const ano =
    limite.getFullYear();

  const mes =
    String(
      limite.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      limite.getDate()
    ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataNascimentoValidaParaTipo(
  tipo: TipoPerfil,
  iso: string
) {
  if (!dataNascimentoValida(iso)) {
    return false;
  }

  if (!exigeMaisDe16Anos(tipo)) {
    return true;
  }

  const idadeCalculada =
    calcIdade(iso);

  return (
    idadeCalculada !== null &&
    idadeCalculada >= 17
  );
}

function getGooglePreCadastroData() {
  try {
    const raw = sessionStorage.getItem("google_pre_cadastro");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

export default function CadastroGoogleComplementar() {
  const [, navigate] = useLocation();

  const preData = useMemo(() => getGooglePreCadastroData(), []);
  const preCadastroToken = preData?.preCadastroToken || "";
  const googleProfile: GoogleProfile | null = preData?.googleProfile || null;

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);

  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>("Atleta");
  const [nome, setNome] = useState(googleProfile?.name || "");
  const [dataNascimento, setDataNascimento] = useState("");
  const [responsavel, setResponsavel] = useState<Responsavel>({
    nome: "",
    email: "",
    telefone: "",
  });
  const [aceitaTermos, setAceitaTermos] = useState(false);

  const [finalizandoCadastro, setFinalizandoCadastro] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [infoAberto, setInfoAberto] = useState(false);

  const isOrg = isOrganizacao(tipoPerfil);
  const idade = useMemo(() => calcIdade(dataNascimento), [dataNascimento]);
  const precisaResponsavel =
    tipoPerfil === "Atleta" && idade !== null && idade < 12;

  const googlePictureUrl =
    typeof googleProfile?.picture === "string" && googleProfile.picture.trim()
      ? googleProfile.picture.trim()
      : PLACEHOLDER_AVATAR;

  useEffect(() => {
    if (!preCadastroToken || !googleProfile?.email) {
      navigate("/login");
    }
  }, [preCadastroToken, googleProfile, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const response = await axios.get(
          `${API.BASE_URL}/api/status/maintenance`,
          { timeout: 8000 }
        );
        setMaintenanceMode(Boolean(response.data?.maintenanceMode));
      } catch {
        setMaintenanceMode(false);
      } finally {
        setMaintenanceChecked(true);
      }
    })();
  }, []);

  function podeFinalizarCadastro() {
    if (!preCadastroToken || !googleProfile?.email) {
      setErro("O pré-cadastro do Google expirou. Entre com Google novamente.");
      return false;
    }

    if (!nome.trim()) {
      setErro(
        isOrg
          ? "Informe o nome da organização."
          : "Informe o nome que será exibido na FootEra."
      );
      return false;
    }

    if (PRECISA_NASCIMENTO(tipoPerfil)) {
      if (!dataNascimento) {
        setErro("Informe a data de nascimento.");
        return false;
      }

      if (
        !dataNascimentoValidaParaTipo(
          tipoPerfil,
          dataNascimento
        )
      ) {
        if (
          exigeMaisDe16Anos(
            tipoPerfil
          )
        ) {
          setErro(
            tipoPerfil === "Professor"
              ? "Para criar um perfil Profissional, é necessário ter mais de 16 anos."
              : "Para criar um perfil Scout, é necessário ter mais de 16 anos."
          );
        } else {
          setErro(
            "A data de nascimento deve estar entre 01/01/1900 e hoje."
          );
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
        setErro("Informe um telefone válido do responsável ou deixe em branco.");
        return false;
      }
    }

    if (!aceitaTermos) {
      setErro("Você deve aceitar os Termos de Uso e a Política de Privacidade.");
      return false;
    }

    setErro("");
    return true;
  }

  async function registrarConsentimento(
    token: string | undefined,
    menorComResponsavel: boolean
  ) {
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
      console.warn("Falha ao registrar consentimento do cadastro Google:", error);
    }
  }

  async function handleFinalizar() {
    if (finalizandoCadastro || !podeFinalizarCadastro()) return;

    setFinalizandoCadastro(true);
    setErro("");
    setSucesso("");

    try {
      const payload: Record<string, unknown> = {
        preCadastroToken,
        tipo: mapTipo[tipoPerfil],
        nome: nome.trim(),
        ...(PRECISA_NASCIMENTO(tipoPerfil)
          ? { dataNascimento }
          : {}),
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

      const response = await fetch(
        `${API.BASE_URL}/api/auth/google/complete-registration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Não foi possível finalizar o cadastro com Google."
        );
      }

      const token = data?.token || data?.accessToken || data?.jwt;
      await registrarConsentimento(token, precisaResponsavel);

      const { isAdmin } = applyAuthSession(data, { lembrar: false });
      sessionStorage.removeItem("google_pre_cadastro");

      setSucesso("Cadastro com Google concluído com sucesso!");

      setTimeout(() => {
        navigate(
          isAdmin
            ? "/admin"
            : consumirRetornoAuth("/perfil")
        );
      }, 700);
    } catch (error: any) {
      setErro(
        error?.message ||
          "Não foi possível finalizar o cadastro com Google."
      );
    } finally {
      setFinalizandoCadastro(false);
    }
  }

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
              Complete sua conta FootEra
            </h1>

            <button
              type="button"
              className="lg:hidden shrink-0 p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
              aria-expanded={infoAberto}
              aria-controls="google-cadastro-info"
              onClick={() => setInfoAberto((valor) => !valor)}
              title={infoAberto ? "Recolher" : "Expandir"}
            >
              {infoAberto ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div
            id="google-cadastro-info"
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
              infoAberto
                ? "max-h-[520px] opacity-100"
                : "max-h-0 opacity-0 lg:max-h-[520px] lg:opacity-100"
            }`}
          >
            <p className="text-center text-base md:text-2xl font-semibold mt-4">
              Sua conta Google já foi reconhecida.
            </p>

            <p className="text-center text-sm md:text-lg mt-4 text-white/95">
              Agora precisamos apenas das informações essenciais para criar seu perfil.
            </p>

            <div className="mt-6 p-5 md:p-6 rounded-2xl text-sm md:text-base text-left w-full bg-white/10 border border-white/10 shadow-lg">
              <h2 className="font-semibold text-xl md:text-2xl mb-4">
                O restante fica para depois
              </h2>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Foto e e-mail vêm da sua conta Google.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Escolha agora apenas o tipo de perfil.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>✓</span>
                  <span>Localização, vínculos, CREF, CNPJ, descrição e outros dados podem ser preenchidos depois em Editar Perfil.</span>
                </li>
              </ul>
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
              Finalizar cadastro com Google
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Sem etapas extras: confirme seus dados essenciais e crie a conta.
            </p>
          </div>

          <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <img
              src={googlePictureUrl}
              alt="Foto da conta Google"
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full border bg-white object-cover"
              onError={(e) => {
                const imagem = e.currentTarget;
                imagem.onerror = null;
                imagem.src = PLACEHOLDER_AVATAR;
              }}
            />

            <div className="min-w-0">
              <p className="truncate font-semibold text-green-950">
                {googleProfile?.name || "Conta Google"}
              </p>
              <p className="truncate text-sm text-gray-500">
                {googleProfile?.email}
              </p>
              <p className="mt-1 text-xs text-green-700">
                Conta Google conectada
              </p>
            </div>
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
              titulo="Dados principais"
              descricao="Seu e-mail já vem do Google. Você só precisa confirmar o nome exibido."
            />

            <label className="mb-1 block text-sm font-semibold text-green-950">
              {isOrg ? "Nome da organização*" : "Nome*"}
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-800 focus:ring-2 focus:ring-green-100"
              placeholder={
                isOrg
                  ? "Nome oficial ou nome público"
                  : "Como você quer ser chamado?"
              }
            />

            <label className="mb-1 mt-4 block text-sm font-semibold text-green-950">
              E-mail Google
            </label>
            <input
              value={googleProfile?.email || ""}
              readOnly
              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm text-gray-600"
            />
          </section>

          {PRECISA_NASCIMENTO(tipoPerfil) && (
            <section className="border-b border-gray-100 py-6">
              <SectionTitle
                numero={3}
                titulo="Dados essenciais"
                descricao="A data de nascimento é usada para as regras da conta e, no atleta, para calcular idade e categoria automaticamente."
              />

              <label className="mb-1 block text-sm font-semibold text-green-950">
                Data de nascimento*
              </label>
              <input
                type="date"
                min={DATA_MINIMA_NASCIMENTO}
                max={
                  dataMaximaNascimentoPorTipo(
                    tipoPerfil
                  )
                }
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-green-800 focus:ring-2 focus:ring-green-100 ${
                  dataNascimento && !dataNascimentoValidaParaTipo(
                    tipoPerfil,
                    dataNascimento
                  )
                    ? "border-red-400"
                    : "border-gray-300"
                }`}
              />

              {exigeMaisDe16Anos(
                tipoPerfil
              ) && (
                <p className="mt-1 text-xs text-gray-500">
                  É necessário ter mais de
                  16 anos para criar um perfil{" "}
                  {tipoPerfil === "Professor"
                    ? "Profissional"
                    : "Scout"}.
                </p>
              )}

              {idade !== null && dataNascimentoValida(dataNascimento) && (
                <p className="mt-1 text-xs text-gray-500">
                  Idade calculada: {idade} anos.
                </p>
              )}

              {tipoPerfil === "Atleta" && (
                <div className="mt-3 rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-green-900">
                  A categoria será calculada automaticamente. A posição poderá ser definida depois em Editar Perfil ou ao entrar nos Treinos.
                </div>
              )}

              {precisaResponsavel && (
                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="font-semibold text-green-950">
                    Responsável legal
                  </h4>
                  <p className="mb-4 mt-1 text-xs text-gray-500">
                    Obrigatório para atletas menores de 12 anos.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Nome do responsável*
                      </label>
                      <input
                        value={responsavel.nome}
                        onChange={(e) =>
                          setResponsavel((atual) => ({
                            ...atual,
                            nome: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        E-mail do responsável*
                      </label>
                      <input
                        type="email"
                        value={responsavel.email}
                        onChange={(e) =>
                          setResponsavel((atual) => ({
                            ...atual,
                            email: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        Telefone do responsável — opcional
                      </label>
                      <input
                        value={responsavel.telefone || ""}
                        placeholder="(00) 00000-0000"
                        onChange={(e) =>
                          setResponsavel((atual) => ({
                            ...atual,
                            telefone: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="pt-6">
            <SectionTitle
              numero={PRECISA_NASCIMENTO(tipoPerfil) ? 4 : 3}
              titulo="Termos e criação da conta"
              descricao="O restante do perfil poderá ser preenchido depois."
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
              {finalizandoCadastro
                ? "Criando conta..."
                : "Criar conta com Google"}
            </button>

            <button
              type="button"
              disabled={finalizandoCadastro}
              onClick={() => {
                sessionStorage.removeItem("google_pre_cadastro");
                navigate("/login");
              }}
              className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function isOrganizacao(tipo: TipoPerfil) {
  return ["Escolinha", "Clube", "Federacao", "Marca"].includes(
    tipo
  );
}