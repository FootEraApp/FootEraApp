// client/src/pages/cadastroGoogleComplementar.tsx
import { useEffect, useMemo, useState, type ComponentPropsWithoutRef, ReactNode } from "react";
import { useLocation } from "wouter";
import { API } from "../config.js";
import logo from "/assets/usuarios/footera-logo.png";
import { Eye, EyeOff } from "lucide-react";
import {
  applyAuthSession,
  consumirRetornoAuth,
} from "../utils/authSession.js";
import { Capacitor } from "@capacitor/core";
import { inicializarPushAndroidNativo } from "../services/nativePushNotifications.js";

type SvgProps = ComponentPropsWithoutRef<"svg">;

function ChevronDown(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function ChevronUp(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

type TipoPerfil =
  | "Atleta"
  | "Professor"
  | "Olheiro"
  | "Learning"
  | "Escolinha"
  | "Escola"
  | "Clube"
  | "Federacao"
  | "Marca";
type Etapa = 1 | 2 | 3;

const mapTipo = {
  Atleta: "ATLETA",
  Professor: "PROFESSOR",
  Escolinha: "ESCOLINHA",
  Escola: "ESCOLA",
  Clube: "CLUBE",
  Olheiro: "OLHEIRO",
  Federacao: "FEDERACAO",
  Marca: "MARCA",
  Learning: "LEARNING",
} as const;

const PRECISA_NASCIMENTO = (t: TipoPerfil) =>
  t === "Atleta" || t === "Olheiro" || t === "Professor";

type CamposProfessor = {
  areaFormacao: string;
  cref?: string;
  statusCref?: StatusCrefUI | undefined;
  treinaEscolinha: "sim" | "nao" | "";
};

type CamposClube = {
  nomeClube: string;
  cnpjClube: string;
  telefone1Clube: string;
  telefone2Clube: string;
  emailClube: string;
  siteOficialClube: string;
  sedeClube: string;
  logradouroClube: string;
  numeroClube: string;
  complementoClube: string;
  bairroClube: string;
  cidadeClube: string;
  estadoClube: string;
  paisClube: string;
  cepClube: string;
  estadio: string;
};

type CamposEscolinha = {
  nomeEscolinha: string;
  cnpjEscolinha: string;
  telefone1Escolinha: string;
  telefone2Escolinha: string;
  emailEscolinha: string;
  siteOficialEscolinha: string;
  sedeEscolinha: string;
  logradouroEscolinha: string;
  numeroEscolinha: string;
  complementoEscolinha: string;
  bairroEscolinha: string;
  cidadeEscolinha: string;
  estadoEscolinha: string;
  paisEscolinha: string;
  cepEscolinha: string;
};

type CamposOlheiro = {
  areaAtuacao: string;
  anosExperiencia: number | "";
  headline: string;
  siteOuLinkedin: string;
  telefonePublico: string;
  emailPublico: string;
  descricao: string;
};

type CamposVinculo = {
  desejaVinculo: boolean;
  tipoAlvo: "Atleta" | "Professor" | "Escolinha" | "Clube" | "";
  alvoBusca: string;
  destinatarioId: string;
};

type ResultadoBusca = {
  id: string;
  usuarioId: string;
  tipo: "Atleta" | "Professor" | "Escolinha" | "Clube";
  nome: string;
  username: string;
  fotoUrl: string | null;
};

type Responsavel = {
  nome: string;
  email: string;
  telefone?: string;
};

const CATEGORIAS_ATLETA = ["Sub3", "Sub5", "Sub7", "Sub9", "Sub11", "Sub13", "Sub15", "Sub16", "Livre"] as const;
type CategoriaAtleta = typeof CATEGORIAS_ATLETA[number];

const STATUS_CREF = ["Pendente", "Ativo", "Desativo"] as const;
type StatusCrefUI = typeof STATUS_CREF[number];

type CamposAtleta = {
  categoria: CategoriaAtleta | "";
};

type GoogleProfile = {
  email: string;
  name: string;
  picture?: string | null;
};

const PLACEHOLDER_AVATAR = logo;

async function inicializarPushDepoisDoAuth() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await inicializarPushAndroidNativo();
  } catch (e) {
    console.warn(
      "[push native] não inicializou após cadastro Google complementar:",
      e
    );
  }
}

function getTiposVinculoDisponiveis(tipo: TipoPerfil) {
  if (tipo === "Atleta") return ["Escolinha", "Professor", "Clube"];
  if (tipo === "Professor") return ["Atleta", "Escolinha", "Clube", "Professor"];
  if (tipo === "Clube") return ["Atleta", "Professor", "Escolinha"];
  if (tipo === "Escolinha") return ["Atleta", "Professor", "Clube"];
  return [];
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const USER_RE = /^(?=.{3,20}$)[a-z0-9._]+$/i;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PHONE_RE = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
const CEP_RE = /^\d{5}-?\d{3}$/;
const URL_RE = /^(https?:\/\/)?([^\s.]+\.\S{2,})(\/\S*)?$/i;

function somenteDigitos(v: string) {
  return v.replace(/\D+/g, "");
}

function maskCEP(v: string) {
  const d = somenteDigitos(v).slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + "-" + d.slice(5);
}

function validarCNPJ(v: string) {
  const cnpj = somenteDigitos(v);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pos: number) => {
    let soma = 0, p = pos;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * p--;
      if (p < 2) p = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(cnpj.slice(0, 12), 5);
  const d2 = calc(cnpj.slice(0, 12) + d1, 6);
  return cnpj.endsWith(`${d1}${d2}`);
}

const DATA_MINIMA_NASCIMENTO = "1900-01-01";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataNascimentoValida(iso: string) {
  if (!iso) return false;
  if (iso < DATA_MINIMA_NASCIMENTO) return false;
  if (iso > hojeISO()) return false;
  return true;
}

function calcIdade(iso: string) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const hoje = new Date();
  let idade =
    hoje.getFullYear() -
    y -
    (hoje.getMonth() + 1 < m ||
    (hoje.getMonth() + 1 === m && hoje.getDate() < d)
      ? 1
      : 0);
  return Math.max(0, idade);
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

const Input = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
  }: {
    label: string;
    value: string | number;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        className="w-full border rounded px-3 py-2"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
);

function AccordionInfo({
  aberto,
  setAberto,
  children,
}: {
  aberto: boolean;
  setAberto: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-5 py-4 font-semibold text-left"
      >
        Informações adicionais (opcional)
        {aberto ? <ChevronUp /> : <ChevronDown />}
      </button>

      {aberto && (
        <div className="border-t p-5 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

const isOrganizacao = (tipo: TipoPerfil) =>
  ["Escolinha", "Escola", "Clube", "Federacao", "Marca"].includes(tipo);

const isLearning = (tipo: TipoPerfil) => tipo === "Learning";

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

const perfilVisual: Record<TipoPerfil, { titulo: string; subtitulo: string; emoji: string }> = {
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
    subtitulo: "Avaliação de talentos, olheiros",
    emoji: "🔭",
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
  Learning: {
    titulo: "Learning",
    subtitulo: "Ver cursos, lives e webinars",
    emoji: "🎓",
  },
  Federacao: {
    titulo: "Federação",
    subtitulo: "Canal oficial e eventos",
    emoji: "🏅",
  },
  Marca: {
    titulo: "Marca",
    subtitulo: "Parceira e patrocinadora",
    emoji: "👕",
  },
  Escola: {
    titulo: "Escola",
    subtitulo: "Instituição de ensino",
    emoji: "🏫",
  },
};

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
      <span className="mt-1 block text-[10px] text-gray-500">{item.subtitulo}</span>
    </button>
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
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  error?: boolean;
  right?: ReactNode;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-green-950 mb-1">
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
            "w-full rounded-lg border bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition",
            "placeholder:text-gray-400 focus:border-green-800 focus:ring-2 focus:ring-green-100",
            readOnly ? "bg-gray-100 text-gray-600" : "",
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

export default function CadastroGoogleComplementar() {
  const [, navigate] = useLocation();

  const preData = useMemo(() => getGooglePreCadastroData(), []);
  const preCadastroToken = preData?.preCadastroToken || "";
  const googleProfile: GoogleProfile | null = preData?.googleProfile || null;
  const googlePictureUrl =
    typeof googleProfile?.picture === "string" && googleProfile.picture.trim()
      ? googleProfile.picture.trim()
      : PLACEHOLDER_AVATAR;

  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>("Atleta");
  const [nome, setNome] = useState(googleProfile?.name || "");
  const [email] = useState(googleProfile?.email || "");
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitaTermos, setAceitaTermos] = useState(false);

  const [cep, setCep] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [pais, setPais] = useState("Brasil");

  type CepStatus = "idle" | "loading" | "ok" | "not_found" | "invalid";
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [finalizandoCadastro, setFinalizandoCadastro] = useState(false);
  const [infoAberto, setInfoAberto] = useState(false);
  const [infoAdicionalProfessorAberto, setInfoAdicionalProfessorAberto] = useState(false);
  const [infoAdicionalAtletaAberto, setInfoAdicionalAtletaAberto] = useState(false);
  const [infoAdicionalClubeAberto, setInfoAdicionalClubeAberto] = useState(false);
  const [infoAdicionalEscolinhaAberto, setInfoAdicionalEscolinhaAberto] = useState(false);
  const [infoAdicionalOlheiroAberto, setInfoAdicionalOlheiroAberto] = useState(false);

  const [atleta, setAtleta] = useState<CamposAtleta>({ categoria: "" });
  const [professor, setProfessor] = useState<CamposProfessor>({
    areaFormacao: "",
    statusCref: undefined,
    cref: "",
    treinaEscolinha: "",
  });

  const [clube, setClube] = useState<CamposClube>({
    nomeClube: "",
    cnpjClube: "",
    cidadeClube: "",
    telefone1Clube: "",
    telefone2Clube: "",
    emailClube: "",
    siteOficialClube: "",
    sedeClube: "",
    logradouroClube: "",
    numeroClube: "",
    complementoClube: "",
    bairroClube: "",
    estadoClube: "",
    paisClube: "",
    cepClube: "",
    estadio: "",
  });

  const [escolinha, setEscolinha] = useState<CamposEscolinha>({
    nomeEscolinha: "",
    cnpjEscolinha: "",
    cidadeEscolinha: "",
    telefone1Escolinha: "",
    telefone2Escolinha: "",
    emailEscolinha: "",
    siteOficialEscolinha: "",
    sedeEscolinha: "",
    logradouroEscolinha: "",
    numeroEscolinha: "",
    complementoEscolinha: "",
    bairroEscolinha: "",
    estadoEscolinha: "",
    paisEscolinha: "",
    cepEscolinha: "",
  });

  const [olheiro, setOlheiro] = useState<CamposOlheiro>({
    areaAtuacao: "",
    anosExperiencia: "",
    headline: "",
    siteOuLinkedin: "",
    telefonePublico: "",
    emailPublico: googleProfile?.email || "",
    descricao: "",
  });

  const [vinculo, setVinculo] = useState<CamposVinculo>({
    desejaVinculo: false,
    tipoAlvo: "",
    alvoBusca: "",
    destinatarioId: "",
  });

  const [emailDisp, setEmailDisp] = useState<null | boolean>(true);
  const [userDisp, setUserDisp] = useState<null | boolean>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [dataNascimento, setDataNascimento] = useState<string>("");
  const [responsavel, setResponsavel] = useState<Responsavel>({
    nome: "",
    email: "",
    telefone: "",
  });

  const idade = useMemo(() => calcIdade(dataNascimento), [dataNascimento]);
  const usernameValido = USER_RE.test(nomeDeUsuario.trim());
  const senhaForte = PASS_RE.test(senha);
  const confirmarOk = confirmarSenha === senha && confirmarSenha.length > 0;
  const precisaResponsavel = tipoPerfil === "Atleta" && idade !== null && idade < 12;

  useEffect(() => {
    if (!preCadastroToken || !googleProfile?.email) {
      navigate("/login");
    }
  }, [preCadastroToken, googleProfile, navigate]);

  const verificarUsername = useMemo(
    () =>
      debounce(async (u: string) => {
        if (!u || !USER_RE.test(u)) return setUserDisp(null);
        try {
          const r = await fetch(
            `${API.BASE_URL}/api/cadastro/check/username?username=${encodeURIComponent(
              u
            )}`
          );
          const j = await r.json();
          setUserDisp(Boolean(j?.disponivel));
        } catch {
          setUserDisp(null);
        }
      }, 350),
    []
  );

  useEffect(() => {
    verificarUsername(nomeDeUsuario.trim().toLowerCase());
  }, [nomeDeUsuario, verificarUsername]);

  const buscarCEP = useMemo(
    () =>
      debounce(async (valor: string) => {
        const num = somenteDigitos(valor);
        if (!num) {
          setCepStatus("idle");
          setBairro("");
          setCidade("");
          setEstado("");
          setPais("Brasil");
          return;
        }
        if (num.length !== 8) {
          setCepStatus("invalid");
          return;
        }
        setCepStatus("loading");
        try {
          const r = await fetch(`https://viacep.com.br/ws/${num}/json/`);
          const j = await r.json();
          if (!r.ok || j?.erro) {
            setCepStatus("not_found");
            return;
          }
          setCidade(j?.localidade || "");
          setEstado((j?.uf || "").toUpperCase());
          setBairro(j?.bairro || "");
          setPais("Brasil");
          setCepStatus("ok");
        } catch {
          setCepStatus("not_found");
        }
      }, 400),
    []
  );

  useEffect(() => {
    buscarCEP(cep);
  }, [cep, buscarCEP]);

  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca[]>([]);

  const buscarAlvo = useMemo(
    () =>
      debounce(async (q: string, tipoAlvo: string) => {
        setResultadosBusca([]);
        if (!q) return;

        try {
          const url = `${API.BASE_URL}/api/cadastro/buscar?query=${encodeURIComponent(
            q
          )}&tipo=${encodeURIComponent(tipoAlvo || "Todos")}`;

          const r = await fetch(url);
          if (r.ok) {
            const j = await r.json();
            const arr: ResultadoBusca[] = (Array.isArray(j) ? j : []).filter(
              (x) => x?.id && x?.usuarioId && x?.nome
            );
            setResultadosBusca(arr);
          }
        } catch {
          setResultadosBusca([]);
        }
      }, 400),
    []
  );

  useEffect(() => {
    if (
      etapa === 3 &&
      getTiposVinculoDisponiveis(tipoPerfil).length > 0 &&
      vinculo.desejaVinculo &&
      vinculo.tipoAlvo &&
      vinculo.alvoBusca.length >= 2
    ) {
      buscarAlvo(vinculo.alvoBusca, vinculo.tipoAlvo);
    } else {
      setResultadosBusca([]);
    }
  }, [
    etapa,
    tipoPerfil,
    vinculo.desejaVinculo,
    vinculo.tipoAlvo,
    vinculo.alvoBusca,
    buscarAlvo,
  ]);

  const selectedAlvo: ResultadoBusca | null = useMemo(
    () => resultadosBusca.find((r) => r.usuarioId === vinculo.destinatarioId) || null,
    [resultadosBusca, vinculo.destinatarioId]
  );

  function podeIrParaEtapa2() {
    if (!aceitaTermos) {
      setErro("Você deve aceitar os termos.");
      return false;
    }
    if (!usernameValido) {
      setErro("Nome de usuário inválido (3–20, letras/números/._).");
      return false;
    }
    if (!senhaForte) {
      setErro("Senha fraca: mínimo 8 caracteres com letra e número.");
      return false;
    }
    if (!confirmarOk) {
      setErro("As senhas não coincidem.");
      return false;
    }
    if (userDisp === false) {
      setErro("Nome de usuário indisponível.");
      return false;
    }
    setErro("");
    return true;
  }

  function podeIrParaEtapa3() {
    if (PRECISA_NASCIMENTO(tipoPerfil)) {
      if (!dataNascimento) {
        setErro("Informe a data de nascimento.");
        return false;
      }

      if (!dataNascimentoValida(dataNascimento)) {
        return setErro("A data de nascimento deve estar entre 01/01/1900 e hoje."), false;
      }
    }

    if (tipoPerfil === "Atleta") {
      if (idade === null) {
        setErro("Informe a data de nascimento do atleta.");
        return false;
      }
      if (!atleta.categoria) {
        setErro("Selecione a categoria do atleta.");
        return false;
      }
    }

    if (tipoPerfil === "Clube") {
      if (!clube.nomeClube.trim()) {
        setErro("Informe o nome do clube.");
        return false;
      }
      if (clube.cnpjClube && !validarCNPJ(clube.cnpjClube)) {
        setErro("CNPJ do clube inválido.");
        return false;
      }
    }

    if (tipoPerfil === "Escolinha") {
      if (!escolinha.nomeEscolinha.trim()) {
        setErro("Informe o nome da escolinha.");
        return false;
      }
      if (escolinha.cnpjEscolinha && !validarCNPJ(escolinha.cnpjEscolinha)) {
        setErro("CNPJ da escolinha inválido.");
        return false;
      }
    }

    if (tipoPerfil === "Federacao" || tipoPerfil === "Marca") {
      if (!clube.nomeClube.trim()) {
        setErro(
          tipoPerfil === "Federacao"
            ? "Informe o nome da federação."
            : "Informe o nome da marca."
        );
        return false;
      }

      if (clube.cnpjClube && !validarCNPJ(clube.cnpjClube)) {
        setErro("CNPJ inválido.");
        return false;
      }
    }

    if (tipoPerfil === "Olheiro") {
      if (
        olheiro.anosExperiencia !== "" &&
        Number.isNaN(Number(olheiro.anosExperiencia))
      ) {
        setErro("Anos de experiência inválido.");
        return false;
      }
      if (olheiro.telefonePublico && !PHONE_RE.test(olheiro.telefonePublico)) {
        setErro("Telefone inválido.");
        return false;
      }
      if (olheiro.emailPublico && !EMAIL_RE.test(olheiro.emailPublico)) {
        setErro("E-mail público inválido.");
        return false;
      }
    }

    if (precisaResponsavel) {
      if (!responsavel.nome.trim()) {
        setErro("Informe o nome do responsável.");
        return false;
      }
      if (!EMAIL_RE.test(responsavel.email)) {
        setErro("Informe um e-mail válido do responsável.");
        return false;
      }
      if (responsavel.telefone && !PHONE_RE.test(responsavel.telefone)) {
        setErro("Telefone do responsável inválido.");
        return false;
      }
    }

    setErro("");
    return true;
  }

  async function handleFinalizar() {
    if (finalizandoCadastro) return;

    setErro("");
    setSucesso("");
    setFinalizandoCadastro(true);

    try {
      const payload: any = {
        preCadastroToken,
        tipo: mapTipo[tipoPerfil],
        nome: nome.trim(),
        nomeDeUsuario: nomeDeUsuario.trim(),
        senha,
        cidade: cidade.trim() || undefined,
        estado: estado.trim() || undefined,
        bairro: bairro.trim() || undefined,
        pais: pais.trim() || undefined,
        cep: cep.trim() || undefined,
        ...(PRECISA_NASCIMENTO(tipoPerfil) ? { dataNascimento } : {}),
      };

      if (tipoPerfil === "Atleta") {
        payload.idade = idade ?? 0;
        payload.categorias = atleta.categoria ? [atleta.categoria] : [];
      }

      if (tipoPerfil === "Professor") {
        payload.treinaEscolinha = professor.treinaEscolinha || "nao";

        const areaFormacaoLimpa = (professor.areaFormacao || "").trim();
        if (areaFormacaoLimpa) {
          payload.areaFormacao = areaFormacaoLimpa;
        }

        if ((professor.cref || "").trim()) {
          payload.cref = (professor.cref || "").trim();
          payload.statusCref = professor.statusCref || "Pendente";
        }
      }

      if (tipoPerfil === "Clube") {
        Object.assign(payload, {
          nomeClube: clube.nomeClube.trim(),
          cnpjClube: clube.cnpjClube || undefined,
          telefone1Clube: clube.telefone1Clube || undefined,
          telefone2Clube: clube.telefone2Clube || undefined,
          emailClube: clube.emailClube || undefined,
          siteOficialClube: clube.siteOficialClube || undefined,
          sedeClube: clube.sedeClube || undefined,
          logradouroClube: clube.logradouroClube || undefined,
          numeroClube: clube.numeroClube || undefined,
          complementoClube: clube.complementoClube || undefined,
          bairroClube: clube.bairroClube || undefined,
          cidadeClube: clube.cidadeClube || cidade || undefined,
          estadoClube: clube.estadoClube || estado || undefined,
          paisClube: clube.paisClube || pais || undefined,
          cepClube: clube.cepClube || undefined,
          estadio: clube.estadio || undefined,
        });
      }

      if (tipoPerfil === "Escolinha") {
        Object.assign(payload, {
          nomeEscolinha: escolinha.nomeEscolinha.trim(),
          cnpjEscolinha: escolinha.cnpjEscolinha || undefined,
          telefone1Escolinha: escolinha.telefone1Escolinha || undefined,
          telefone2Escolinha: escolinha.telefone2Escolinha || undefined,
          emailEscolinha: escolinha.emailEscolinha || undefined,
          siteOficialEscolinha: escolinha.siteOficialEscolinha || undefined,
          sedeEscolinha: escolinha.sedeEscolinha || undefined,
          logradouroEscolinha: escolinha.logradouroEscolinha || undefined,
          numeroEscolinha: escolinha.numeroEscolinha || undefined,
          complementoEscolinha: escolinha.complementoEscolinha || undefined,
          bairroEscolinha: escolinha.bairroEscolinha || undefined,
          cidadeEscolinha: escolinha.cidadeEscolinha || cidade || undefined,
          estadoEscolinha: escolinha.estadoEscolinha || estado || undefined,
          paisEscolinha: escolinha.paisEscolinha || pais || undefined,
          cepEscolinha: escolinha.cepEscolinha || undefined,
        });
      }

      if (tipoPerfil === "Olheiro") {
        payload.areaAtuacao = olheiro.areaAtuacao || undefined;
        payload.anosExperiencia =
          olheiro.anosExperiencia === ""
            ? undefined
            : Number(olheiro.anosExperiencia);
        payload.telefonePublico = olheiro.telefonePublico || undefined;
        payload.emailPublico = olheiro.emailPublico || undefined;
        payload.descricao = olheiro.descricao || undefined;
        payload.headline = olheiro.headline || undefined;
        payload.siteOuLinkedin = olheiro.siteOuLinkedin || undefined;
      }

      if (tipoPerfil === "Federacao" || tipoPerfil === "Marca") {
        Object.assign(payload, {
          nomeOrganizacao: clube.nomeClube.trim() || undefined,

          nomeClube: clube.nomeClube.trim() || undefined,
          cnpjClube: clube.cnpjClube || undefined,
          telefone1Clube: clube.telefone1Clube || undefined,
          telefone2Clube: clube.telefone2Clube || undefined,
          emailClube: clube.emailClube || email || undefined,
          siteOficialClube: clube.siteOficialClube || undefined,
          sedeClube: clube.sedeClube || undefined,
          logradouroClube: clube.logradouroClube || undefined,
          numeroClube: clube.numeroClube || undefined,
          complementoClube: clube.complementoClube || undefined,
          bairroClube: clube.bairroClube || bairro || undefined,
          cidadeClube: clube.cidadeClube || cidade || undefined,
          estadoClube: clube.estadoClube || estado || undefined,
          paisClube: clube.paisClube || pais || undefined,
          cepClube: clube.cepClube || cep || undefined,
        });
      }

      if (precisaResponsavel) {
        payload.responsavel = {
          nome: responsavel.nome,
          email: responsavel.email,
          telefone: responsavel.telefone || undefined,
        };
      }

      if (
        getTiposVinculoDisponiveis(tipoPerfil).length > 0 &&
        vinculo.desejaVinculo &&
        vinculo.destinatarioId
      ) {
        payload.vinculo = {
          desejaVinculo: true,
          destinatarioId: vinculo.destinatarioId,
        };
      }

      const res = await fetch(`${API.BASE_URL}/api/auth/google/complete-registration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Erro ao finalizar cadastro com Google.");
      }

      const { isAdmin } = applyAuthSession(data, {
        lembrar: false,
      });

      await inicializarPushDepoisDoAuth();

      // Só apaga o pré-cadastro depois que a sessão foi realmente aplicada.
      // Assim, se a resposta vier incompleta e applyAuthSession falhar,
      // o usuário ainda consegue tentar finalizar novamente.
      sessionStorage.removeItem("google_pre_cadastro");

      if (tipoPerfil === "Learning") {
        setSucesso("Cadastro Learning com o Google realizado com sucesso! Verifique seu e-mail para confirmar a conta.");
      } else {
        setSucesso("Cadastro com Google realizado com sucesso! Redirecionando...");
      }

      setTimeout(() => {
        navigate(
          isAdmin
            ? "/admin"
            : consumirRetornoAuth(
                "/perfil"
              )
        );
      }, 1200);
    } catch (err: any) {
      setErro(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          (tipoPerfil === "Learning"
            ? "Ocorreu um erro ao realizar cadastro Learning."
            : "Falha ao finalizar cadastro com Google.")
      );
    } finally {
      setFinalizandoCadastro(false);
    }
  }

  const CamposEnderecoOpcional = () => (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium mb-1">CEP (opcional)</label>
        <input
          className={`w-full border rounded px-3 py-2 ${cep && !CEP_RE.test(cep) ? "border-red-400" : ""}`}
          placeholder="00000-000"
          inputMode="numeric"
          value={cep}
          onChange={(e) => setCep(maskCEP(e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cidade (opcional)</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">UF (opcional)</label>
        <input
          className="w-full border rounded px-3 py-2 uppercase"
          maxLength={2}
          value={estado}
          onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Bairro (opcional)</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">País (opcional)</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={pais}
          onChange={(e) => setPais(e.target.value)}
        />
      </div>
    </div>
  );

  const Step = ({ n, label }: { n: Etapa; label: string }) => {
    const active = etapa === n;
    const done = etapa > n;

    return (
      <div className="flex items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            done
              ? "bg-green-700 text-white"
              : active
              ? "bg-green-900 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          {n}
        </div>
        <span
          className={`ml-2 text-sm ${
            active || done ? "text-green-900 font-medium" : "text-gray-500"
          }`}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="w-full lg:w-1/2 bg-green-800 text-white flex flex-col items-center p-5 lg:p-10">
        <div className="w-full max-w-[680px]">
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:gap-2">
            <img src={logo} className="w-10 h-10 lg:w-14 lg:h-14" alt="FootEra" />
            <h1 className="flex-1 lg:flex-none text-center text-xl lg:text-3xl font-bold">
              Complete seu cadastro na FootEra
            </h1>
            <button
              type="button"
              className="lg:hidden p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
              aria-expanded={infoAberto}
              aria-controls="cadastro-info"
              onClick={() => setInfoAberto((v) => !v)}
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
            <p className="text-center max-w-md text-base lg:text-lg mt-4">
              Você já entrou com Google. Agora só falta completar os dados da sua conta FootEra.
            </p>

            <div className="mt-6 p-5 lg:p-6 rounded-xl text-sm lg:text-base text-left w-full bg-white/10 backdrop-blur-[1px]">
              <h2 className="font-semibold mb-2">O que você vai concluir agora:</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Escolher seu tipo de perfil</li>
                <li>Definir seu nome de usuário</li>
                <li>Definir uma senha para login normal também</li>
                <li>Completar os dados do seu perfil</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-cream flex justify-center items-center p-6 lg:p-10 w-full lg:w-1/2">
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

        <div className="relative z-10 bg-white rounded-2xl shadow-md w-full max-w-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <Step n={1} label="Conta" />
            <div className={`flex-1 mx-2 h-0.5 ${etapa >= 2 ? "bg-green-800" : "bg-gray-200"}`} />
            <Step n={2} label="Tipo" />
            <div className={`flex-1 mx-2 h-0.5 ${etapa >= 3 ? "bg-green-800" : "bg-gray-200"}`} />
            <Step n={3} label="Finalizar" />
          </div>

          {etapa === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-1 text-green-950">
                Conta Google conectada
              </h2>

              <p className="text-sm text-green-600 mb-4">
                Agora complete os dados da sua conta FootEra.
              </p>

              <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-3">
                <img
                  src={googlePictureUrl}
                  alt="Foto da conta Google"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  className="h-14 w-14 rounded-full border object-cover bg-white"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    const img = e.currentTarget;

                    console.warn("[Google Complementar] Falha ao carregar foto Google:", {
                      src: img.src,
                      googlePicture: googleProfile?.picture,
                    });

                    if (img.src !== PLACEHOLDER_AVATAR) {
                      img.src = PLACEHOLDER_AVATAR;
                    }
                  }}
                />

                <div className="min-w-0">
                  <p className="font-semibold text-green-950 truncate">
                    {googleProfile?.name || "Conta Google"}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {googleProfile?.email}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    Login iniciado com Google
                  </p>
                </div>
              </div>
              <div className="mb-5">
                <h3 className="font-bold text-green-950 mb-1">
                  Como você quer entrar na FootEra?
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Escolha a opção que melhor te descreve.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TipoContaCard
                    ativo={!isOrganizacao(tipoPerfil)}
                    emoji="👤"
                    titulo="Pessoa"
                    subtitulo="Para indivíduos"
                    onClick={() => setTipoPerfil("Atleta")}
                  />

                  <TipoContaCard
                    ativo={isOrganizacao(tipoPerfil)}
                    emoji="🏢"
                    titulo="Organização"
                    subtitulo="Para equipes, clubes ou instituições"
                    onClick={() => setTipoPerfil("Escolinha")}
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-green-950 mb-1">
                  {isOrganizacao(tipoPerfil)
                    ? "Que tipo de organização você representa?"
                    : "Qual é o seu perfil principal?"}
                </h3>

                <p className="text-xs text-gray-500 mb-3">
                  Selecione a categoria que melhor se aplica.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(isOrganizacao(tipoPerfil) ? PERFIS_ORGANIZACAO : PERFIS_PESSOA).map((tipo) => (
                    <PerfilCard
                      key={tipo}
                      tipo={tipo}
                      ativo={tipoPerfil === tipo}
                      onClick={() => setTipoPerfil(tipo)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <h3 className="font-bold text-green-950">Dados da conta</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Complete os dados que faltam para finalizar sua conta.
                </p>

                <div className="space-y-3">
                  <MinimalInput
                    label="Nome completo*"
                    icon="👤"
                    value={nome}
                    placeholder="Seu nome completo"
                    onChange={(v) => setNome(v)}
                  />

                  <MinimalInput
                    label="E-mail Google*"
                    icon="✉️"
                    value={email}
                    readOnly
                    placeholder="email conectado ao Google"
                  />

                  <MinimalInput
                    label="Nome de usuário*"
                    icon="👤"
                    value={nomeDeUsuario}
                    placeholder="Ex.: joaosilva10"
                    error={!!nomeDeUsuario && !usernameValido}
                    onChange={(v) => setNomeDeUsuario(v)}
                  />

                  {nomeDeUsuario && (
                    <p className={`text-xs -mt-2 ${
                      usernameValido
                        ? userDisp === false
                          ? "text-red-600"
                          : "text-green-700"
                        : "text-red-600"
                    }`}>
                      {!usernameValido
                        ? "Use 3–20 caracteres (letras, números, . e _)."
                        : userDisp === null
                        ? "Verificando..."
                        : userDisp
                        ? "Disponível"
                        : "Indisponível"}
                    </p>
                  )}

                  <MinimalInput
                    label="Senha*"
                    icon="🔒"
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    placeholder="Mínimo de 8 caracteres"
                    error={!!senha && !senhaForte}
                    onChange={(v) => setSenha(v)}
                    right={
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />

                  {senha && (
                    <p className={`text-xs -mt-2 ${senhaForte ? "text-green-700" : "text-red-600"}`}>
                      Mín. 8 caracteres com letra e número.
                    </p>
                  )}

                  <MinimalInput
                    label="Confirmar senha*"
                    icon="🔒"
                    type={mostrarConfirmar ? "text" : "password"}
                    value={confirmarSenha}
                    placeholder="Repita sua senha"
                    error={!!confirmarSenha && !confirmarOk}
                    onChange={(v) => setConfirmarSenha(v)}
                    right={
                      <button
                        type="button"
                        onClick={() => setMostrarConfirmar((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />

                  {confirmarSenha && (
                    <p className={`text-xs -mt-2 ${confirmarOk ? "text-green-700" : "text-red-600"}`}>
                      {confirmarOk ? "OK" : "Senhas não coincidem."}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 mb-3">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={aceitaTermos}
                    onChange={(e) => setAceitaTermos(e.target.checked)}
                  />
                  Li e aceito os&nbsp;
                  <a
                    href="/termos?tab=termos"
                    className="underline text-blue-700"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Termos de Uso
                  </a>
                  &nbsp;e&nbsp;
                  <a
                    href="/termos?tab=privacidade"
                    className="underline text-blue-700"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Política de Privacidade
                  </a>
                </label>
              </div>

              {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}

              <div className="flex justify-end">
                <button
                  disabled={finalizandoCadastro}
                  onClick={() => {
                    if (!podeIrParaEtapa2()) return;

                    if (tipoPerfil === "Learning") {
                      handleFinalizar();
                      return;
                    }

                    setEtapa(2);
                  }}
                  className="bg-green-900 hover:bg-green-800 disabled:opacity-60 text-white px-4 py-2 rounded"
                >
                  {finalizandoCadastro
                    ? "Concluindo cadastro..."
                    : tipoPerfil === "Learning"
                    ? "Concluir cadastro Learning"
                    : "Próximo"}
                </button>
              </div>
            </div>
          )}

          {etapa === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Dados do Tipo: {tipoPerfil}</h2>
              <p className="text-sm text-green-600 mb-4">Complete as informações específicas</p>

              {PRECISA_NASCIMENTO(tipoPerfil) && (
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Data de nascimento*</label>
                  <input
                    type="date"
                    min={DATA_MINIMA_NASCIMENTO}
                    max={hojeISO()}
                    value={dataNascimento}
                    onChange={(e) => {
                      setDataNascimento(e.target.value);

                      if (erro === "A data de nascimento deve estar entre 01/01/1900 e hoje.") {
                        setErro("");
                      }
                    }}
                    onBlur={() => {
                      if (!dataNascimento) return;

                      if (!dataNascimentoValida(dataNascimento)) {
                        setErro("A data de nascimento deve estar entre 01/01/1900 e hoje.");
                      }
                    }}
                    className={`w-full border rounded px-3 py-2 ${
                      dataNascimento && !dataNascimentoValida(dataNascimento) ? "border-red-400" : ""
                    }`}
                  />
                  {dataNascimento && !dataNascimentoValida(dataNascimento) ? (
                    <p className="mt-1 text-xs text-red-600">
                      A data de nascimento deve estar entre 01/01/1900 e hoje.
                    </p>
                  ) : idade !== null ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Idade estimada: {idade} anos
                    </p>
                  ) : null}
                </div>
              )}

              {tipoPerfil === "Atleta" && (
                <>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Idade</label>
                      <input className="w-full border rounded px-3 py-2 bg-gray-100" value={idade ?? ""} readOnly />
                    </div>

                    {precisaResponsavel && (
                      <div className="border rounded-md p-3 mt-3 sm:col-span-2">
                        <p className="text-sm font-medium mb-2">Dados do responsável (obrigatório)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Nome do responsável</label>
                            <input
                              className={`w-full border rounded px-3 py-2 ${
                                responsavel.nome.trim() === "" && erro ? "border-red-400" : ""
                              }`}
                              value={responsavel.nome}
                              onChange={(e) =>
                                setResponsavel((p) => ({ ...p, nome: e.target.value }))
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">E-mail do responsável</label>
                            <input
                              type="email"
                              className={`w-full border rounded px-3 py-2 ${
                                responsavel.email && !EMAIL_RE.test(responsavel.email)
                                  ? "border-red-400"
                                  : ""
                              }`}
                              value={responsavel.email}
                              onChange={(e) =>
                                setResponsavel((p) => ({ ...p, email: e.target.value }))
                              }
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">
                              Telefone/Celular do responsável (opcional)
                            </label>
                            <input
                              className={`w-full border rounded px-3 py-2 ${
                                responsavel.telefone && !PHONE_RE.test(responsavel.telefone)
                                  ? "border-red-400"
                                  : ""
                              }`}
                              placeholder="(00) 00000-0000"
                              value={responsavel.telefone || ""}
                              onChange={(e) =>
                                setResponsavel((p) => ({ ...p, telefone: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-1">Categoria*</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={atleta.categoria}
                        onChange={(e) =>
                          setAtleta((p) => ({
                            ...p,
                            categoria: e.target.value as CategoriaAtleta,
                          }))
                        }
                      >
                        <option value="">Selecione</option>
                        {CATEGORIAS_ATLETA.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <AccordionInfo
                    aberto={infoAdicionalAtletaAberto}
                    setAberto={setInfoAdicionalAtletaAberto}
                  >
                    <CamposEnderecoOpcional />
                  </AccordionInfo>
                </>
              )}

              {tipoPerfil === "Professor" && (
                <>
                  <AccordionInfo
                    aberto={infoAdicionalProfessorAberto}
                    setAberto={setInfoAdicionalProfessorAberto}
                  >
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Você dá aula em alguma escolinha cadastrada?
                      </label>
                      <div className="flex gap-4">
                        <label><input type="radio" className="mr-2" checked={professor.treinaEscolinha === "sim"} onChange={() => setProfessor((p) => ({ ...p, treinaEscolinha: "sim" }))} />Sim</label>
                        <label><input type="radio" className="mr-2" checked={professor.treinaEscolinha === "nao"} onChange={() => setProfessor((p) => ({ ...p, treinaEscolinha: "nao" }))} />Não, independente</label>
                      </div>
                    </div>

                    <Input label="Área de Formação" value={professor.areaFormacao} onChange={(v) => setProfessor((p) => ({ ...p, areaFormacao: v }))} />
                    <Input label="CREF" value={professor.cref || ""} onChange={(v) => setProfessor((p) => ({ ...p, cref: v, statusCref: v.trim() ? p.statusCref ?? "Pendente" : undefined }))} />

                    <div>
                      <label className="block text-sm font-medium mb-1">Status do CREF</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={professor.statusCref ?? "Pendente"}
                        disabled={!String(professor.cref || "").trim()}
                        onChange={(e) => setProfessor((p) => ({ ...p, statusCref: e.target.value as StatusCrefUI }))}
                      >
                        {STATUS_CREF.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">CEP (opcional)</label>
                        <input
                          className={`w-full border rounded px-3 py-2 ${
                            cep && !CEP_RE.test(cep) ? "border-red-400" : ""
                          }`}
                          placeholder="00000-000"
                          inputMode="numeric"
                          value={cep}
                          onChange={(e) => setCep(maskCEP(e.target.value))}
                        />
                        {cep && (
                          <p
                            className={`text-xs mt-1 ${
                              cepStatus === "loading"
                                ? "text-gray-500"
                                : cepStatus === "ok"
                                ? "text-green-700"
                                : "text-red-600"
                            }`}
                          >
                            {cepStatus === "loading"
                              ? "Buscando endereço…"
                              : cepStatus === "ok"
                              ? "Endereço localizado pelo CEP."
                              : cepStatus === "invalid"
                              ? "CEP inválido."
                              : "CEP não encontrado."}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Cidade (opcional)</label>
                        <input
                          className="w-full border rounded px-3 py-2"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">UF (opcional)</label>
                        <input
                          className="w-full border rounded px-3 py-2 uppercase"
                          maxLength={2}
                          value={estado}
                          onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Bairro (opcional)</label>
                        <input
                          className="w-full border rounded px-3 py-2"
                          value={bairro}
                          onChange={(e) => setBairro(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">País (opcional)</label>
                        <input
                          className="w-full border rounded px-3 py-2"
                          value={pais}
                          onChange={(e) => setPais(e.target.value)}
                        />
                      </div>
                    </div>
                  </AccordionInfo>
                </>
              )}

              {tipoPerfil === "Clube" && (
                <>
                  <Input
                    label="Nome do Clube*"
                    value={clube.nomeClube}
                    onChange={(v) => setClube((p) => ({ ...p, nomeClube: v }))}
                  />

                  <AccordionInfo
                    aberto={infoAdicionalClubeAberto}
                    setAberto={setInfoAdicionalClubeAberto}
                  >
                    <Input label="CNPJ" value={clube.cnpjClube} placeholder="00.000.000/0000-00" onChange={(v) => setClube((p) => ({ ...p, cnpjClube: v }))} />
                    <Input label="Telefone 1" value={clube.telefone1Clube} onChange={(v) => setClube((p) => ({ ...p, telefone1Clube: v }))} />
                    <Input label="Telefone 2" value={clube.telefone2Clube} onChange={(v) => setClube((p) => ({ ...p, telefone2Clube: v }))} />
                    <Input label="E-mail" value={clube.emailClube} onChange={(v) => setClube((p) => ({ ...p, emailClube: v }))} />
                    <Input label="Site oficial" value={clube.siteOficialClube} placeholder="https://..." onChange={(v) => setClube((p) => ({ ...p, siteOficialClube: v }))} />
                    <Input label="Sede" value={clube.sedeClube} onChange={(v) => setClube((p) => ({ ...p, sedeClube: v }))} />
                    <Input label="Logradouro" value={clube.logradouroClube} onChange={(v) => setClube((p) => ({ ...p, logradouroClube: v }))} />
                    <Input label="Número" value={clube.numeroClube} onChange={(v) => setClube((p) => ({ ...p, numeroClube: v }))} />
                    <Input label="Complemento" value={clube.complementoClube} onChange={(v) => setClube((p) => ({ ...p, complementoClube: v }))} />
                    <Input label="Bairro" value={clube.bairroClube} onChange={(v) => setClube((p) => ({ ...p, bairroClube: v }))} />
                    <Input label="Cidade" value={clube.cidadeClube} onChange={(v) => setClube((p) => ({ ...p, cidadeClube: v }))} />
                    <Input label="UF" value={clube.estadoClube} onChange={(v) => setClube((p) => ({ ...p, estadoClube: v.toUpperCase().slice(0, 2) }))} />
                    <Input label="País" value={clube.paisClube} onChange={(v) => setClube((p) => ({ ...p, paisClube: v }))} />
                    <Input label="CEP" value={clube.cepClube} placeholder="00000-000" onChange={(v) => setClube((p) => ({ ...p, cepClube: maskCEP(v) }))} />
                    <Input label="Estádio" value={clube.estadio} onChange={(v) => setClube((p) => ({ ...p, estadio: v }))} />
                  </AccordionInfo>
                </>
              )}

              {(tipoPerfil === "Federacao" || tipoPerfil === "Marca") && (
                <>
                  <Input
                    label={tipoPerfil === "Federacao" ? "Nome da Federação*" : "Nome da Marca*"}
                    value={clube.nomeClube}
                    onChange={(v) =>
                      setClube((prev) => ({
                        ...prev,
                        nomeClube: v,
                      }))
                    }
                  />

                  <AccordionInfo
                    aberto={infoAdicionalClubeAberto}
                    setAberto={setInfoAdicionalClubeAberto}
                  >
                    <Input
                      label="CNPJ"
                      value={clube.cnpjClube}
                      placeholder="00.000.000/0000-00"
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          cnpjClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Telefone 1"
                      value={clube.telefone1Clube}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          telefone1Clube: v,
                        }))
                      }
                    />

                    <Input
                      label="Telefone 2"
                      value={clube.telefone2Clube}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          telefone2Clube: v,
                        }))
                      }
                    />

                    <Input
                      label="E-mail"
                      value={clube.emailClube}
                      placeholder={email || "contato@exemplo.com"}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          emailClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Site oficial"
                      value={clube.siteOficialClube}
                      placeholder="https://..."
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          siteOficialClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Sede"
                      value={clube.sedeClube}
                      placeholder="Ex.: São Paulo, SP"
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          sedeClube: v,
                        }))
                      }
                    />

                    <Input
                      label="CEP"
                      value={clube.cepClube}
                      placeholder="00000-000"
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          cepClube: maskCEP(v),
                        }))
                      }
                    />

                    <Input
                      label="Logradouro"
                      value={clube.logradouroClube}
                      placeholder="Rua, avenida..."
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          logradouroClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Número"
                      value={clube.numeroClube}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          numeroClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Complemento"
                      value={clube.complementoClube}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          complementoClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Bairro"
                      value={clube.bairroClube}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          bairroClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Cidade"
                      value={clube.cidadeClube}
                      placeholder={cidade || "Ex.: São Paulo"}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          cidadeClube: v,
                        }))
                      }
                    />

                    <Input
                      label="Estado"
                      value={clube.estadoClube}
                      placeholder={estado || "Ex.: SP"}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          estadoClube: v,
                        }))
                      }
                    />

                    <Input
                      label="País"
                      value={clube.paisClube}
                      placeholder={pais || "Brasil"}
                      onChange={(v) =>
                        setClube((prev) => ({
                          ...prev,
                          paisClube: v,
                        }))
                      }
                    />
                  </AccordionInfo>
                </>
              )}

              {tipoPerfil === "Escolinha" && (
                <>
                  <Input
                    label="Nome da Escolinha*"
                    value={escolinha.nomeEscolinha}
                    onChange={(v) => setEscolinha((p) => ({ ...p, nomeEscolinha: v }))}
                  />

                  <AccordionInfo
                    aberto={infoAdicionalEscolinhaAberto}
                    setAberto={setInfoAdicionalEscolinhaAberto}
                  >
                    <Input label="CNPJ" value={escolinha.cnpjEscolinha} placeholder="00.000.000/0000-00" onChange={(v) => setEscolinha((p) => ({ ...p, cnpjEscolinha: v }))} />
                    <Input label="Telefone 1" value={escolinha.telefone1Escolinha} onChange={(v) => setEscolinha((p) => ({ ...p, telefone1Escolinha: v }))} />
                    <Input label="Telefone 2" value={escolinha.telefone2Escolinha} onChange={(v) => setEscolinha((p) => ({ ...p, telefone2Escolinha: v }))} />
                    <Input label="E-mail" value={escolinha.emailEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, emailEscolinha: v }))} />
                    <Input label="Site oficial" value={escolinha.siteOficialEscolinha} placeholder="https://..." onChange={(v) => setEscolinha((p) => ({ ...p, siteOficialEscolinha: v }))} />
                    <Input label="Sede" value={escolinha.sedeEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, sedeEscolinha: v }))} />
                    <Input label="Logradouro" value={escolinha.logradouroEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, logradouroEscolinha: v }))} />
                    <Input label="Número" value={escolinha.numeroEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, numeroEscolinha: v }))} />
                    <Input label="Complemento" value={escolinha.complementoEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, complementoEscolinha: v }))} />
                    <Input label="Bairro" value={escolinha.bairroEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, bairroEscolinha: v }))} />
                    <Input label="Cidade" value={escolinha.cidadeEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, cidadeEscolinha: v }))} />
                    <Input label="UF" value={escolinha.estadoEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, estadoEscolinha: v.toUpperCase().slice(0, 2) }))} />
                    <Input label="País" value={escolinha.paisEscolinha} onChange={(v) => setEscolinha((p) => ({ ...p, paisEscolinha: v }))} />
                    <Input label="CEP" value={escolinha.cepEscolinha} placeholder="00000-000" onChange={(v) => setEscolinha((p) => ({ ...p, cepEscolinha: maskCEP(v) }))} />
                  </AccordionInfo>
                </>
              )}

              {tipoPerfil === "Olheiro" && (
                <>
                  <AccordionInfo
                    aberto={infoAdicionalOlheiroAberto}
                    setAberto={setInfoAdicionalOlheiroAberto}
                  >
                    <Input label="Área de Atuação" value={olheiro.areaAtuacao} placeholder="Ex: Base, Profissional, Captação SP" onChange={(v) => setOlheiro((p) => ({ ...p, areaAtuacao: v }))} />
                    <Input
                      label="Anos de Experiência"
                      value={olheiro.anosExperiencia}
                      type="number"
                      onChange={(v) =>
                        setOlheiro((prev) => ({
                          ...prev,
                          anosExperiencia: v === "" ? "" : Number(v),
                        }))
                      }
                    />
                    <Input label="Headline" value={olheiro.headline} placeholder="Ex: Scout focado em categorias de base" onChange={(v) => setOlheiro((p) => ({ ...p, headline: v }))} />
                    <Input label="Site ou LinkedIn" value={olheiro.siteOuLinkedin} placeholder="https://..." onChange={(v) => setOlheiro((p) => ({ ...p, siteOuLinkedin: v }))} />
                    <Input label="Telefone público" value={olheiro.telefonePublico} placeholder="(00) 00000-0000" onChange={(v) => setOlheiro((p) => ({ ...p, telefonePublico: v }))} />
                    <Input label="E-mail público" value={olheiro.emailPublico} placeholder="seuemail@exemplo.com" onChange={(v) => setOlheiro((p) => ({ ...p, emailPublico: v }))} />

                    <div>
                      <label className="block text-sm font-medium mb-1">Descrição</label>
                      <textarea
                        className="w-full border rounded px-3 py-2"
                        rows={3}
                        value={olheiro.descricao}
                        placeholder="Fale um pouco sobre seu trabalho como olheiro..."
                        onChange={(e) => setOlheiro((p) => ({ ...p, descricao: e.target.value }))}
                      />
                    </div>
                    <CamposEnderecoOpcional />
                    
                  </AccordionInfo>
                </>
              )}

              {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setEtapa(1)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    if (podeIrParaEtapa3()) setEtapa(3);
                  }}
                  className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Complementar</h2>
              <p className="text-sm text-green-600 mb-4">Revise e finalize seu cadastro</p>

              {getTiposVinculoDisponiveis(tipoPerfil).length > 0 && (
                <div className="border rounded-md p-3 mb-4">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={vinculo.desejaVinculo}
                      onChange={(e) =>
                        setVinculo((p) => ({ ...p, desejaVinculo: e.target.checked }))
                      }
                    />
                    Desejo solicitar vínculo com algum tipo de usuario agora
                  </label>

                  {vinculo.desejaVinculo && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Tipo do destinatário</label>
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={vinculo.tipoAlvo}
                          onChange={(e) =>
                            setVinculo((p) => ({
                              ...p,
                              tipoAlvo: e.target.value as any,
                              destinatarioId: "",
                            }))
                          }
                        >
                          <option value="">Selecione</option>
                          <option value="Escolinha">Escolinha</option>
                          <option value="Professor">Professor</option>
                          <option value="Clube">Clube</option>
                        </select>
                      </div>

                      {!!vinculo.tipoAlvo && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1">Buscar por nome/username</label>
                            <input
                              className="w-full border rounded px-3 py-2"
                              placeholder={`Ex: ${vinculo.tipoAlvo} "Estrelas" ou "@usuario"`}
                              value={vinculo.alvoBusca}
                              onChange={(e) =>
                                setVinculo((p) => ({ ...p, alvoBusca: e.target.value }))
                              }
                            />
                          </div>

                          {resultadosBusca.length > 0 && (
                            <div className="max-h-48 overflow-auto border rounded mt-2 p-2 space-y-2">
                              {resultadosBusca.map((u) => {
                                const selected = vinculo.destinatarioId === u.id;
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 rounded-md border transition hover:bg-gray-50 ${
                                      selected
                                        ? "bg-green-50 border-green-600 ring-1 ring-green-600"
                                        : "border-gray-200"
                                    }`}
                                    onClick={() =>
                                      setVinculo((p) => ({
                                        ...p,
                                        destinatarioId: u.usuarioId,
                                        alvoBusca: u.nome,
                                      }))
                                    }
                                  >
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={u.fotoUrl || PLACEHOLDER_AVATAR}
                                        alt={u.nome}
                                        className="w-8 h-8 rounded-full object-cover border"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                          e.currentTarget.src = PLACEHOLDER_AVATAR;
                                        }}
                                      />
                                      <div>
                                        <div className="text-sm font-medium">{u.nome}</div>
                                        <div className="text-xs text-gray-500">
                                          @{u.username} • {u.tipo}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {selectedAlvo && (
                            <div className="mt-3 p-3 border rounded bg-gray-50 flex items-center gap-3">
                              <img
                                src={selectedAlvo.fotoUrl || PLACEHOLDER_AVATAR}
                                alt={selectedAlvo.nome}
                                className="w-12 h-12 rounded-full object-cover border"
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                  e.currentTarget.src = PLACEHOLDER_AVATAR;
                                }}
                              />
                              <div className="text-sm">
                                <div className="font-medium">{selectedAlvo.nome}</div>
                                <div className="text-gray-500">
                                  @{selectedAlvo.username} • {selectedAlvo.tipo}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="ml-auto text-xs px-3 py-1 border rounded hover:bg-white"
                                onClick={() =>
                                  setVinculo((p) => ({ ...p, destinatarioId: "" }))
                                }
                              >
                                Trocar
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gray-50 border rounded p-3 text-sm">
                <div><span className="font-medium">Tipo:</span> {tipoPerfil}</div>
                <div><span className="font-medium">Nome:</span> {nome}</div>
                <div><span className="font-medium">Email:</span> {email}</div>
                <div><span className="font-medium">Username:</span> @{nomeDeUsuario}</div>

                <div className="mt-2">
                  <span className="font-medium">Localização:</span>{" "}
                  {`${bairro ? bairro + ", " : ""}${cidade || "-"}`}{" "}
                  {estado ? `- ${estado}` : ""} {pais ? `• ${pais}` : ""}
                </div>

                {precisaResponsavel && (
                  <div className="mt-2">
                    <div><span className="font-medium">Responsável:</span> {responsavel.nome || "-"}</div>
                    <div><span className="font-medium">Email Resp.:</span> {responsavel.email || "-"}</div>
                    <div><span className="font-medium">Telefone Resp.:</span> {responsavel.telefone || "-"}</div>
                  </div>
                )}

                {tipoPerfil === "Atleta" && (
                  <div className="mt-2">
                    <div><span className="font-medium">Idade:</span> {idade ?? "-"}</div>
                    <div><span className="font-medium">Categoria:</span> {atleta.categoria || "-"}</div>
                  </div>
                  
                )}

                {tipoPerfil === "Professor" && (
                  <div className="mt-2">
                    <div><span className="font-medium">Área de formação:</span> {professor.areaFormacao || "-"}</div>
                    <div><span className="font-medium">CREF:</span> {professor.cref || "-"}</div>
                    <div><span className="font-medium">Status CREF:</span> {professor.statusCref || "-"}</div>
                  </div>
                )}

                {tipoPerfil === "Clube" && (
                  <div className="mt-2">
                    <div><span className="font-medium">Nome do Clube:</span> {clube.nomeClube || "-"}</div>
                    <div><span className="font-medium">CNPJ:</span> {clube.cnpjClube || "-"}</div>
                  </div>
                )}

                {tipoPerfil === "Escolinha" && (
                  <div className="mt-2">
                    <div><span className="font-medium">Nome da Escolinha:</span> {escolinha.nomeEscolinha || "-"}</div>
                    <div><span className="font-medium">CNPJ:</span> {escolinha.cnpjEscolinha || "-"}</div>
                  </div>
                )}

                {tipoPerfil === "Olheiro" && (
                  <div className="mt-2 space-y-1">
                    <div><span className="font-medium">Área de atuação:</span> {olheiro.areaAtuacao || "-"}</div>
                    <div><span className="font-medium">Experiência:</span> {olheiro.anosExperiencia === "" ? "-" : `${olheiro.anosExperiencia} ano(s)`}</div>
                    <div><span className="font-medium">Telefone público:</span> {olheiro.telefonePublico || "-"}</div>
                    <div><span className="font-medium">Email público:</span> {olheiro.emailPublico || "-"}</div>
                    <div><span className="font-medium">Descrição:</span> {olheiro.descricao || "-"}</div>
                  </div>
                )}
              </div>

              {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
              {sucesso && <p className="text-sm text-green-700 mt-3">{sucesso}</p>}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => !finalizandoCadastro && setEtapa(2)}
                  disabled={finalizandoCadastro}
                  className={`border px-4 py-2 rounded ${
                    finalizandoCadastro
                      ? "border-gray-200 text-gray-400 cursor-not-allowed"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Voltar
                </button>

                <button
                  onClick={handleFinalizar}
                  disabled={finalizandoCadastro}
                  className={`px-4 py-2 rounded text-white ${
                    finalizandoCadastro
                      ? "bg-green-700 opacity-70 cursor-not-allowed"
                      : "bg-green-900 hover:bg-green-800"
                  }`}
                >
                  {finalizandoCadastro ? "Finalizando..." : "Finalizar cadastro"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}