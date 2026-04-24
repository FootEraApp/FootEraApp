// client/src/pages/cadastro
import { useEffect, useMemo, useState, useCallback, type ComponentPropsWithoutRef } from "react";
import { useLocation } from "wouter";
import logo from "/assets/usuarios/footera-logo.png";
import { API, APP } from "../config.js";
import { Eye, EyeOff } from "lucide-react";
import axios from "axios";
import GoogleButton from "../components/auth/GoogleButton";
import MaintenanceScreen from "../components/MaintenanceScreen";


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

type TipoPerfil = "Atleta" | "Professor" | "Escolinha" | "Clube" | "Olheiro";
type Etapa = 1 | 2 | 3;
const mapTipo = {
  Atleta: "ATLETA",
  Professor: "PROFESSOR",
  Escolinha: "ESCOLINHA",
  Clube: "CLUBE",
  Olheiro: "OLHEIRO",
} as const;

const PRECISA_NASCIMENTO = (t: TipoPerfil) =>
  t === "Atleta" || t === "Olheiro" || t === "Professor";

type CamposProfessor = {
  treinaEscolinha: "sim" | "nao" | "";
  areaFormacao: string;
  cref?: string;
  statusCref?: StatusCrefUI | undefined;
};
type CamposClube = { cnpjClube: string; cidadeClube: string };
type CamposEscolinha = { cnpjEscolinha: string; cidadeEscolinha: string };
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
  tipoAlvo: "Professor" | "Escolinha" | "Clube" | "";
  alvoBusca: string;
  destinatarioId: string;       // Usuario.id -> usado em SolicitacaoTreino
  destinatarioEntidadeId: string; // Professor.id / Clube.id / Escolinha.id
};
type ResultadoBusca = {
  id: string; // id da entidade
  usuarioId: string; // id da tabela Usuario
  tipo: "Professor" | "Escolinha" | "Clube";
  nome: string;
  username: string;
  fotoUrl: string | null;
};
type Responsavel = { nome: string; email: string; telefone?: string };

const CATEGORIAS_ATLETA = ["Sub3","Sub5","Sub7","Sub9","Sub11","Sub13","Sub15","Sub16","Livre"] as const;
type CategoriaAtleta = typeof CATEGORIAS_ATLETA[number];

const STATUS_CREF = ["Pendente", "Ativo", "Desativo"] as const;
type StatusCrefUI = typeof STATUS_CREF[number];

type CamposAtleta = {
  idade: number | "";
  categoria: CategoriaAtleta | "";
  treinaEscolinha: "sim" | "nao" | "";
 };

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function getAvatarSrc(fotoUrl?: string | null) {
  const src = String(fotoUrl || "").trim();
  return src || AVATAR_FALLBACK;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any;
  return (...args: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const USER_RE = /^(?=.{3,20}$)[a-z0-9._]+$/i;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PHONE_RE = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/;
const URL_RE = /^(https?:\/\/)?([^\s.]+\.\S{2,})(\/\S*)?$/i;
const CEP_RE = /^\d{5}-?\d{3}$/;

function somenteDigitos(v: string) { return v.replace(/\D+/g, ""); }
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
      soma += Number(base[i]) * p--; if (p < 2) p = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(cnpj.slice(0, 12), 5);
  const d2 = calc(cnpj.slice(0, 12) + d1, 6);
  return cnpj.endsWith(`${d1}${d2}`);
}

export default function Cadastro() {
  const [_, navigate] = useLocation();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] = useState(false);

  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>("Atleta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
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
  const [infoAdicionalOlheiroAberto, setInfoAdicionalOlheiroAberto] = useState(false);
  const [infoAdicionalEtapa1Aberto, setInfoAdicionalEtapa1Aberto] = useState(false);
  const [atleta, setAtleta] = useState<CamposAtleta>({ idade: "", categoria: "", treinaEscolinha: "" });
  const [professor, setProfessor] = useState<CamposProfessor>({ treinaEscolinha: "", areaFormacao: "", statusCref: undefined, cref: "" });
  const [clube, setClube] = useState<CamposClube>({ cnpjClube: "", cidadeClube: "" });
  const [escolinha, setEscolinha] = useState<CamposEscolinha>({ cnpjEscolinha: "", cidadeEscolinha: "" });
  const [olheiro, setOlheiro] = useState<CamposOlheiro>({
    areaAtuacao: "",
    anosExperiencia: "",
    headline: "",
    siteOuLinkedin: "",
    telefonePublico: "",
    emailPublico: "",
    descricao: "",
  });

  const [vinculo, setVinculo] = useState<CamposVinculo>({
    desejaVinculo: false,
    tipoAlvo: "",
    alvoBusca: "",
    destinatarioId: "",
    destinatarioEntidadeId: "",
  });const [emailDisp, setEmailDisp] = useState<null | boolean>(null);
  const [userDisp, setUserDisp] = useState<null | boolean>(null);

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const [dataNascimento, setDataNascimento] = useState<string>("");
  const [responsavel, setResponsavel] = useState<Responsavel>({ nome: "", email: "", telefone: "" });

  const emailValido = EMAIL_RE.test(email.trim());
  const usernameValido = USER_RE.test(nomeDeUsuario.trim());
  const senhaForte = PASS_RE.test(senha);
  const confirmarOk = confirmarSenha === senha && confirmarSenha.length > 0;

  function calcIdade(iso: string) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const hoje = new Date();
    let idade = hoje.getFullYear() - y - (hoje.getMonth() + 1 < m || ((hoje.getMonth() + 1 === m) && hoje.getDate() < d) ? 1 : 0);
    return Math.max(0, idade);
  }
  const idade = useMemo(() => calcIdade(dataNascimento), [dataNascimento]);

  const verificarEmail = useMemo(() => debounce(async (e: string) => {
    if (!e || !EMAIL_RE.test(e)) return setEmailDisp(null);
    try {
      const r = await fetch(`${API.BASE_URL}/api/cadastro/check/email?email=${encodeURIComponent(e)}`);
      const j = await r.json();
      setEmailDisp(Boolean(j?.disponivel));
    } catch { setEmailDisp(null); }
  }, 350), []);

  const verificarUsername = useMemo(() => debounce(async (u: string) => {
    if (!u || !USER_RE.test(u)) return setUserDisp(null);
    try {
      const r = await fetch(`${API.BASE_URL}/api/cadastro/check/username?username=${encodeURIComponent(u)}`);
      const j = await r.json();
      setUserDisp(Boolean(j?.disponivel));
    } catch { setUserDisp(null); }
  }, 350), []);

  useEffect(() => { verificarEmail(email.trim().toLowerCase()); }, [email, verificarEmail]);
  useEffect(() => { verificarUsername(nomeDeUsuario.trim().toLowerCase()); }, [nomeDeUsuario, verificarUsername]);

  const buscarCEP = useMemo(() => debounce(async (valor: string) => {
    const num = somenteDigitos(valor);
    if (!num) {
      setCepStatus("idle");
      setBairro(""); setCidade(""); setEstado(""); setPais("Brasil");
      return;
    }
    if (num.length !== 8) { setCepStatus("invalid"); return; }
    setCepStatus("loading");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${num}/json/`);
      const j = await r.json();
      if (!r.ok || j?.erro) { setCepStatus("not_found"); return; }
      setCidade(j?.localidade || "");
      setEstado((j?.uf || "").toUpperCase());
      setBairro(j?.bairro || "");
      setPais("Brasil");
      setCepStatus("ok");
    } catch {
      setCepStatus("not_found");
    }
  }, 400), []);
  useEffect(() => { buscarCEP(cep); }, [cep, buscarCEP]);

  const podeIrParaEtapa2 = () => {
    if (!aceitaTermos) return setErro("Você deve aceitar os termos."), false;
    if (!emailValido) return setErro("E-mail inválido."), false;
    if (!usernameValido) return setErro("Nome de usuário inválido (3–20, letras/números/._)."), false;
    if (!senhaForte) return setErro("Senha fraca: mínimo 8 caracteres com letra e número."), false;
    if (!confirmarOk) return setErro("As senhas não coincidem."), false;
    if (emailDisp === false) return setErro("E-mail já cadastrado."), false;
    if (userDisp === false) return setErro("Nome de usuário indisponível."), false;
    if (cep && (!CEP_RE.test(cep) || !cidade || !estado)) {
      return setErro("CEP inválido: informe um CEP válido para preencher Cidade e UF (ou ajuste manualmente).");
    }
    // ✅ CEP/Localização deixa de ser obrigatório.
    // (se o usuário preencher, você pode validar depois, mas não bloqueia mais)
    setErro("");
    return true;
  };

  const podeIrParaEtapa3 = () => {
    if (PRECISA_NASCIMENTO(tipoPerfil)) {
      if (!dataNascimento) return setErro("Informe a data de nascimento."), false;
      const nasc = new Date(dataNascimento);
      if (nasc > new Date()) return setErro("Data de nascimento no futuro."), false;
    }

    if (tipoPerfil === "Atleta") {
      if (idade === null) return setErro("Informe a data de nascimento do atleta."), false;
      if (!atleta.categoria) return setErro("Selecione a categoria do atleta."), false;
      if (atleta.categoria && !CATEGORIAS_ATLETA.includes(atleta.categoria)) {
        return setErro("Categoria inválida."), false;
      }
    }
    if (tipoPerfil === "Professor") {
      if (professor.cref && !professor.cref.trim()) {
        return setErro("CREF inválido."), false;
      }
    }
    if (tipoPerfil === "Clube") {
      if (clube.cnpjClube && !validarCNPJ(clube.cnpjClube)) return setErro("CNPJ do clube inválido."), false;
    }
    if (tipoPerfil === "Escolinha") {
      if (escolinha.cnpjEscolinha && !validarCNPJ(escolinha.cnpjEscolinha)) return setErro("CNPJ da escolinha inválido."), false;
    }
    if (tipoPerfil === "Olheiro") {
      if (olheiro.anosExperiencia !== "" && Number.isNaN(Number(olheiro.anosExperiencia))) {
        return setErro("Anos de experiência inválido."), false;
      }
      if (olheiro.siteOuLinkedin && !URL_RE.test(olheiro.siteOuLinkedin)) {
        return setErro("URL inválida (site/LinkedIn)."), false;
      }
      if (olheiro.telefonePublico && !PHONE_RE.test(olheiro.telefonePublico)) {
        return setErro("Telefone inválido."), false;
      }
      if (olheiro.emailPublico && !EMAIL_RE.test(olheiro.emailPublico)) {
        return setErro("E-mail público inválido."), false;
      }
    }

    if (idade !== null && idade < 18) {
      if (!responsavel.nome.trim()) return setErro("Informe o nome do responsável."), false;
      if (!EMAIL_RE.test(responsavel.email)) return setErro("Informe um e-mail válido do responsável."), false;
      if (responsavel.telefone && !PHONE_RE.test(responsavel.telefone)) return setErro("Telefone do responsável inválido."), false;
    }

    setErro("");
    return true;
  };

  const handleFinalizar = async () => {
    if (finalizandoCadastro) return;

    setErro("");
    setSucesso("");
    setFinalizandoCadastro(true);

    try {
      const payload: any = {
        tipo: mapTipo[tipoPerfil],
        email: email.trim(),
        nomeDeUsuario: nomeDeUsuario.trim(),
        senha,
        ...(nome.trim() ? { nome: nome.trim() } : {}),
        ...(cidade.trim() ? { cidade: cidade.trim() } : {}),
        ...(estado.trim() ? { estado: estado.trim() } : {}),
        ...(bairro.trim() ? { bairro: bairro.trim() } : {}),
        ...(pais.trim() ? { pais: pais.trim() } : {}),
        ...(PRECISA_NASCIMENTO(tipoPerfil) ? { dataNascimento } : {}),
      };

      if (tipoPerfil === "Atleta") {
        payload.idade = idade ?? 0;
        payload.categorias = atleta.categoria ? [atleta.categoria] : [];
        payload.treinaEscolinha = atleta.treinaEscolinha || "nao";
      }

      if (tipoPerfil === "Professor") {
        payload.treinaEscolinha = professor.treinaEscolinha || "nao";

        const areaFormacaoLimpa = (professor.areaFormacao || "").trim();
        if (areaFormacaoLimpa) {
          payload.areaFormacao = areaFormacaoLimpa;
        }

        const crefLimpo = (professor.cref || "").trim();
        if (crefLimpo) {
          payload.cref = crefLimpo;
          payload.statusCref = professor.statusCref || "Pendente";
        }
      }

      if (tipoPerfil === "Clube") {
        payload.cnpjClube = clube.cnpjClube || undefined;
      }

      if (tipoPerfil === "Escolinha") {
        payload.cnpjEscolinha = escolinha.cnpjEscolinha || undefined;
      }

      if (tipoPerfil === "Olheiro") {
        payload.areaAtuacao = olheiro.areaAtuacao || undefined;
        payload.anosExperiencia =
          olheiro.anosExperiencia === "" ? undefined : Number(olheiro.anosExperiencia);
        payload.headline = olheiro.headline || undefined;
        payload.siteOuLinkedin = olheiro.siteOuLinkedin || undefined;
        payload.telefonePublico = olheiro.telefonePublico || undefined;
        payload.emailPublico = olheiro.emailPublico || undefined;
        payload.descricao = olheiro.descricao || undefined;

        if (vinculo.desejaVinculo && vinculo.destinatarioEntidadeId) {
          if (vinculo.tipoAlvo === "Clube") {
            payload.colaboracaoClubeId = vinculo.destinatarioEntidadeId;
          }
          if (vinculo.tipoAlvo === "Professor") {
            payload.colaboracaoProfessorId = vinculo.destinatarioEntidadeId;
          }
          if (vinculo.tipoAlvo === "Escolinha") {
            payload.colaboracaoEscolinhaId = vinculo.destinatarioEntidadeId;
          }
        }
      }
      if (idade !== null && idade < 18) {
        payload.responsavel = {
          nome: responsavel.nome,
          email: responsavel.email,
          telefone: responsavel.telefone || undefined,
        };
      }

      const res = await fetch(`${API.BASE_URL}/api/cadastro/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let mensagem = "Erro ao cadastrar.";
        try {
          const j = await res.json();
          mensagem = j?.error || j?.message || mensagem;
        } catch {
          const t = await res.text().catch(() => "");
          mensagem = t || mensagem;
        }
        throw new Error(mensagem);
      }

      const data = await res.json();
      const token = data?.token || data?.accessToken || data?.jwt;

      setSucesso("Cadastro salvo com sucesso! Redirecionando para a página de login…");
      window.scrollTo({ top: 0, behavior: "smooth" });

      try {
        await fetch(`${API.BASE_URL}/api/legal/consentimentos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            doc: idade !== null && idade < 18 ? "Termos e Privacidade (menor)" : "Termos e Privacidade",
            versao: { termos: "2025-10-06", privacidade: "2025-10-06" },
            hashes: { termosHash: "<opcional>", privHash: "<opcional>" },
            metodo: "click-wrap",
          }),
        });
      } catch (e) {
        console.warn("Falha ao registrar consentimento:", e);
      }

      if (
        (tipoPerfil === "Atleta" || tipoPerfil === "Olheiro") &&
        vinculo.desejaVinculo &&
        vinculo.destinatarioId
      ) {
        try {
          const respVinculo = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ destinatarioId: vinculo.destinatarioId }),
          });

          if (!respVinculo.ok) {
            const txt = await respVinculo.text().catch(() => "");
            throw new Error(txt || "Falha ao criar solicitação de vínculo.");
          }
        } catch (e) {
          console.warn("Falha ao criar solicitação de vínculo:", e);
        }
      }

      setTimeout(() => navigate("/login"), 1800);
    } catch (err: any) {
      setErro(err?.message || "Falha no cadastro.");
    } finally {
      setFinalizandoCadastro(false);
    }
  };

  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca[]>([]);
  const buscarAlvo = useMemo(() => debounce(async (q: string, tipoAlvo: string) => {
    setResultadosBusca([]); if (!q) return;
    try {
      const url = `${API.BASE_URL}/api/cadastro/buscar?query=${encodeURIComponent(q)}&tipo=${encodeURIComponent(tipoAlvo || "Todos")}`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const arr: ResultadoBusca[] = (Array.isArray(j) ? j : []).filter(
          x => x?.id && x?.usuarioId && x?.nome
        );
        setResultadosBusca(arr);
      }
    } catch { setResultadosBusca([]); }
  }, 400), []);

  useEffect(() => {
    const podeBuscar =
      etapa === 3 &&
      (tipoPerfil === "Atleta" || tipoPerfil === "Olheiro") &&
      vinculo.desejaVinculo &&
      vinculo.tipoAlvo &&
      vinculo.alvoBusca.length >= 2;

    if (podeBuscar) {
      buscarAlvo(vinculo.alvoBusca, vinculo.tipoAlvo);
    } else {
      setResultadosBusca([]);
    }
  }, [etapa, tipoPerfil, vinculo.desejaVinculo, vinculo.tipoAlvo, vinculo.alvoBusca]);

  useEffect(() => {
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

  const selectedAlvo: ResultadoBusca | null = useMemo(
    () => resultadosBusca.find(r => r.id === vinculo.destinatarioId) || null,
    [resultadosBusca, vinculo.destinatarioId]
  );

  const Step = ({ n, label }: { n: Etapa; label: string }) => {
    const active = etapa === n; const done = etapa > n;
    return (
      <div className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? "bg-green-700 text-white" : active ? "bg-green-900 text-white" : "bg-gray-200 text-gray-700"}`}>{n}</div>
        <span className={`ml-2 text-sm ${active || done ? "text-green-900 font-medium" : "text-gray-500"}`}>{label}</span>
      </div>
    );
  };

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      setErro("");
      setSucesso("");

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

      sessionStorage.setItem("token", token);
      sessionStorage.setItem("usuarioId", usuarioId);

      if (usuarioNome) sessionStorage.setItem("nomeUsuario", usuarioNome);

      const rawTipo = String(usuario.tipo ?? data.tipo ?? "").toLowerCase();

      const mapTipoStore: Record<string, string> = {
        admin: "admin",
        atleta: "atleta",
        professor: "professor",
        clube: "clube",
        escolinha: "escolinha",
        escola: "escola",
        olheiro: "olheiro",
      };

      sessionStorage.setItem("tipoUsuario", mapTipoStore[rawTipo] ?? "atleta");
      sessionStorage.setItem("usuarioTipoRaw", rawTipo);

      if (data?.tipoUsuarioId) {
        sessionStorage.setItem("tipoUsuarioId", String(data.tipoUsuarioId));
      }

      sessionStorage.setItem(
        "plano",
        String(usuario.plano ?? data.plano ?? "FREE")
      );

      navigate(rawTipo === "admin" ? "/admin" : "/feed");
    } catch (err: any) {
      console.error("Erro no cadastro/login com Google:", err.response?.data || err.message);
      setErro(
        err?.response?.data?.message ||
          "Não foi possível continuar com Google agora."
      );
    }
  }, [navigate]);

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
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="md:w-1/2 bg-[#14532d] text-white flex flex-col items-center p-5 md:p-10">
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
                className="
                  shrink-0 object-contain transform-gpu
                  w-14 h-14 sm:w-16 sm:h-16 md:w-[110px] md:h-[110px] lg:w-[130px] lg:h-[130px]
                  origin-left md:origin-center mr-1
                "
              />
            </button>
            <h1 className="flex-1 lg:flex-none text-center text-xl lg:text-3xl font-bold">Bem-vindo à FootEra</h1>
            <button type="button" className="lg:hidden p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full" aria-expanded={infoAberto} aria-controls="cadastro-info" onClick={() => setInfoAberto(v => !v)} title={infoAberto ? "Recolher" : "Expandir"}>
              {infoAberto ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>

          <div id="cadastro-info" className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${infoAberto ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 lg:max-h-[520px] lg:opacity-100"}`}>
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

      <div className="relative bg-cream flex justify-center lg:justify-center items-start p-6 lg:p-10 w-full lg:w-1/2">
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

        <div className="relative z-10 bg-white rounded-2xl shadow-md w-full max-w-xl p-6 mx-auto lg:mt-6">
          <div className="flex items-center justify-between mb-6">
            <Step n={1} label="Dados de Usuário" />
            <div className={`flex-1 mx-2 h-0.5 ${etapa >= 2 ? "bg-green-800" : "bg-gray-200"}`} />
            <Step n={2} label="Dados do Tipo" />
            <div className={`flex-1 mx-2 h-0.5 ${etapa >= 3 ? "bg-green-800" : "bg-gray-200"}`} />
            <Step n={3} label="Complementar" />
          </div>
          {etapa === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Criar conta</h2>
              <p className="text-sm text-green-600 mb-4">Preencha os campos abaixo</p>

              <label className="block mb-2 font-medium">Tipo de Perfil</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(["Atleta", "Escolinha", "Clube", "Professor", "Olheiro"] as TipoPerfil[]).map((t) => (
                  <label className="flex items-center text-sm" key={t}>
                    <input
                      type="radio"
                      name="tipo"
                      className="mr-2"
                      value={t}
                      checked={tipoPerfil === t}
                      onChange={(e) => setTipoPerfil(e.target.value as TipoPerfil)}
                    />
                    {t === "Escolinha"
                      ? "Escolinha de Futebol"
                      : t === "Clube"
                      ? "Clube Profissional"
                      : t === "Professor"
                      ? "Profissional do Futebol"
                      : t === "Olheiro"
                      ? "Olheiro (Scout)"
                      : t}
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Nome de usuário*</label>
                <input
                  className={`w-full border rounded px-3 py-2 ${nomeDeUsuario && !usernameValido ? "border-red-400" : ""}`}
                  value={nomeDeUsuario}
                  onChange={(e) => setNomeDeUsuario(e.target.value)}
                />
                {nomeDeUsuario && (
                  <p className={`text-xs mt-1 ${usernameValido ? (userDisp === false ? "text-red-600" : "text-green-700") : "text-red-600"}`}>
                    {!usernameValido
                      ? "Use 3–20 caracteres (letras, números, . e _)."
                      : userDisp === null
                      ? "Verificando..."
                      : userDisp
                      ? "Disponível"
                      : "Indisponível"}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Email*</label>
                <input
                  type="email"
                  className={`w-full border rounded px-3 py-2 ${email && !emailValido ? "border-red-400" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {email && (
                  <p className={`text-xs mt-1 ${emailValido ? (emailDisp === false ? "text-red-600" : "text-green-700") : "text-red-600"}`}>
                    {!emailValido
                      ? "Formato de e-mail inválido."
                      : emailDisp === null
                      ? "Verificando..."
                      : emailDisp
                      ? "Disponível"
                      : "Já cadastrado"}
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Senha*</label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? "text" : "password"}
                      autoComplete="new-password"
                      className={`w-full border rounded px-3 py-2 pr-10 ${senha && !senhaForte ? "border-red-400" : ""}`}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setMostrarSenha((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    >
                      {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {senha && (
                    <p className={`text-xs mt-1 ${senhaForte ? "text-green-700" : "text-red-600"}`}>
                      Mín. 8 caracteres com letra e número.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar Senha*</label>
                  <div className="relative">
                    <input
                      type={mostrarConfirmar ? "text" : "password"}
                      autoComplete="new-password"
                      className={`w-full border rounded px-3 py-2 pr-10 ${confirmarSenha && !confirmarOk ? "border-red-400" : ""}`}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={mostrarConfirmar ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setMostrarConfirmar((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                    >
                      {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmarSenha && (
                    <p className={`text-xs mt-1 ${confirmarOk ? "text-green-700" : "text-red-600"}`}>
                      {confirmarOk ? "OK" : "Senhas não coincidem."}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 border border-gray-200 rounded-[22px] overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setInfoAdicionalEtapa1Aberto((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-5 text-left hover:bg-gray-50 transition"
                >
                  <span className="text-sm sm:text-base font-medium text-gray-900">
                    Informações adicionais (opcional)
                  </span>
                  {infoAdicionalEtapa1Aberto ? <ChevronUp /> : <ChevronDown />}
                </button>

                {infoAdicionalEtapa1Aberto && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1">Nome Completo (opcional)</label>
                      <input
                        className="w-full border rounded px-3 py-2"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                      />
                    </div>

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
                  </div>
                )}
              </div>

              <div className="mt-4 mb-3">
                <label className="flex items-start text-sm">
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
                      className="underline text-blue-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Termos de Uso
                    </a>{" "}
                    e{" "}
                    <a
                      href="/termos?tab=privacidade"
                      className="underline text-blue-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Política de Privacidade
                    </a>
                  </span>
                </label>
              </div>
              {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}

              <div className="flex justify-end">
                <button onClick={() => { if (podeIrParaEtapa2()) setEtapa(2); }} className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded">Próximo</button>
              </div>

              <div className="mt-4">
                <div className="w-full max-w-[460px] mx-auto">
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-xs text-gray-500">ou</span>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>

                  <GoogleButton
                    text="signup_with"
                    onCredential={handleGoogleCredential}
                  />
                </div>
              </div>

              <p className="text-center text-sm mt-4">
                Já tem uma conta? <a href="/login" className="text-green-700 underline">Faça login</a>
              </p>
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
                    className={`w-full border rounded px-3 py-2 ${erro && !dataNascimento ? "border-red-400" : ""}`}
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                  />
                  {idade !== null && <p className="text-xs text-gray-500 mt-1">Idade estimada: {idade} anos</p>}
                </div>
              )}

              {tipoPerfil === "Atleta" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Você treina em alguma escolinha cadastrada na FootEra?</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center"><input type="radio" className="mr-2" name="escolinha_at" value="sim" checked={atleta.treinaEscolinha === "sim"} onChange={(e) => { const v = e.target.value as "sim" | "nao"; setAtleta(p => ({ ...p, treinaEscolinha: v })); if (v === "sim") setVinculo(p => ({ ...p, desejaVinculo: true })); }} />Sim</label>
                      <label className="flex items-center"><input type="radio" className="mr-2" name="escolinha_at" value="nao" checked={atleta.treinaEscolinha === "nao"} onChange={(e) => { const v = e.target.value as "sim" | "nao"; setAtleta(p => ({ ...p, treinaEscolinha: v })); if (v === "nao") setVinculo(p => ({
                        ...p,
                        desejaVinculo: false,
                        destinatarioId: "",
                        destinatarioEntidadeId: "",
                        alvoBusca: "",
                      })); }} />Não, sou independente</label>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Idade (calculada)</label>
                      <input className="w-full border rounded px-3 py-2 bg-gray-100" value={idade ?? ""} readOnly />
                    </div>

                    {idade !== null && idade < 18 && (
                      <div className="border rounded-md p-3 mt-3 sm:col-span-2">
                        <p className="text-sm font-medium mb-2">Dados do responsável (obrigatório)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Nome do responsável</label>
                            <input
                              className={`w-full border rounded px-3 py-2 ${responsavel.nome.trim() === "" && erro ? "border-red-400" : ""}`}
                              value={responsavel.nome}
                              onChange={e => setResponsavel(p => ({ ...p, nome: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">E-mail do responsável</label>
                            <input
                              type="email"
                              className={`w-full border rounded px-3 py-2 ${responsavel.email && !EMAIL_RE.test(responsavel.email) ? "border-red-400" : ""}`}
                              value={responsavel.email}
                              onChange={e => setResponsavel(p => ({ ...p, email: e.target.value }))}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Telefone/Celular do responsável (opcional)</label>
                            <input
                              className={`w-full border rounded px-3 py-2 ${responsavel.telefone && !PHONE_RE.test(responsavel.telefone) ? "border-red-400" : ""}`}
                              placeholder="(00) 00000-0000"
                              value={responsavel.telefone || ""}
                              onChange={e => setResponsavel(p => ({ ...p, telefone: e.target.value }))}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Menores de 18 anos precisam do responsável legal.</p>
                      </div>
                    )}

                    <div>
                       <label className="block text-sm font-medium mb-1">Categoria*</label>
                       <select
                         className="w-full border rounded px-3 py-2"
                         value={atleta.categoria}
                         onChange={(e) =>
                           setAtleta((p) => ({ ...p, categoria: e.target.value as CategoriaAtleta }))
                         }
                       >
                         <option value="">Selecione</option>
                         {CATEGORIAS_ATLETA.map((c) => (
                           <option key={c} value={c}>{c}</option>
                         ))}
                       </select>
                     </div>
                  </div>
                </>
              )}

              {tipoPerfil === "Professor" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">
                      Você dá aula em alguma escolinha cadastrada?
                    </label>

                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          className="mr-2"
                          name="escolinha_pf"
                          value="sim"
                          checked={professor.treinaEscolinha === "sim"}
                          onChange={(e) =>
                            setProfessor((p) => ({
                              ...p,
                              treinaEscolinha: e.target.value as "sim" | "nao",
                            }))
                          }
                        />
                        Sim
                      </label>

                      <label className="flex items-center">
                        <input
                          type="radio"
                          className="mr-2"
                          name="escolinha_pf"
                          value="nao"
                          checked={professor.treinaEscolinha === "nao"}
                          onChange={(e) =>
                            setProfessor((p) => ({
                              ...p,
                              treinaEscolinha: e.target.value as "sim" | "nao",
                            }))
                          }
                        />
                        Não, independente
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 border border-gray-200 rounded-[22px] overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setInfoAdicionalProfessorAberto((v) => !v)}
                      className="w-full flex items-center justify-between px-5 py-5 text-left hover:bg-gray-50 transition"
                    >
                      <span className="text-sm sm:text-base font-medium text-gray-900">
                        Informações adicionais (opcional)
                      </span>
                      {infoAdicionalProfessorAberto ? <ChevronUp /> : <ChevronDown />}
                    </button>

                    {infoAdicionalProfessorAberto && (
                      <div className="px-4 pb-4 border-t border-gray-100">
                        <div className="mt-4">
                          <label className="block text-sm font-medium mb-1">
                            Área de Formação (opcional)
                          </label>
                          <input
                            className="w-full border rounded px-3 py-2"
                            value={professor.areaFormacao}
                            onChange={(e) =>
                              setProfessor((p) => ({
                                ...p,
                                areaFormacao: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              CREF (opcional)
                            </label>
                            <input
                              className="w-full border rounded px-3 py-2"
                              value={professor.cref || ""}
                              onChange={(e) =>
                                setProfessor((p) => ({
                                  ...p,
                                  cref: e.target.value,
                                  statusCref: e.target.value.trim()
                                    ? (p.statusCref || "Pendente")
                                    : undefined,
                                }))
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Status do CREF
                            </label>
                            <select
                              className="w-full border rounded px-3 py-2"
                              value={professor.statusCref || "Pendente"}
                              disabled={!professor.cref?.trim()}
                              onChange={(e) =>
                                setProfessor((p) => ({
                                  ...p,
                                  statusCref: e.target.value as StatusCrefUI,
                                }))
                              }
                            >
                              {STATUS_CREF.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>

                            {!professor.cref?.trim() && (
                              <p className="text-xs text-gray-500 mt-1">
                                Preencha o CREF para liberar o status.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {tipoPerfil === "Clube" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Parceria com a FootEra?</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center"><input type="radio" className="mr-2" name="parceria_clube" value="sim" /> Sim</label>
                      <label className="flex items-center"><input type="radio" className="mr-2" name="parceria_clube" value="nao" /> Não</label>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">CNPJ (opcional)</label>
                    <input className={`w-full border rounded px-3 py-2 ${clube.cnpjClube && !validarCNPJ(clube.cnpjClube) ? "border-red-400" : ""}`}
                      placeholder="00.000.000/0000-00" value={clube.cnpjClube} onChange={(e) => setClube(p => ({ ...p, cnpjClube: e.target.value }))} />
                  </div>
                </>
              )}

              {tipoPerfil === "Escolinha" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">É uma escolinha cadastrada?</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center"><input type="radio" className="mr-2" name="parceria_escolinha" value="sim" /> Sim</label>
                      <label className="flex items-center"><input type="radio" className="mr-2" name="parceria_escolinha" value="nao" /> Não</label>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">CNPJ (opcional)</label>
                    <input className={`w-full border rounded px-3 py-2 ${escolinha.cnpjEscolinha && !validarCNPJ(escolinha.cnpjEscolinha) ? "border-red-400" : ""}`}
                      placeholder="00.000.000/0000-00" value={escolinha.cnpjEscolinha} onChange={(e) => setEscolinha(p => ({ ...p, cnpjEscolinha: e.target.value }))} />
                  </div>
                </>
              )}

              {tipoPerfil === "Olheiro" && (
              <>
                <div className="mt-5 border border-gray-200 rounded-[22px] overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setInfoAdicionalOlheiroAberto((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-5 text-left hover:bg-gray-50 transition"
                  >
                    <span className="text-sm sm:text-base font-medium text-gray-900">
                      Informações adicionais (opcional)
                    </span>
                    {infoAdicionalOlheiroAberto ? <ChevronUp /> : <ChevronDown />}
                  </button>

                  {infoAdicionalOlheiroAberto && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">
                          Área de Atuação (opcional)
                        </label>
                        <input
                          className="w-full border rounded px-3 py-2"
                          placeholder="Ex: Base, Profissional, Captação SP"
                          value={olheiro.areaAtuacao}
                          onChange={(e) =>
                            setOlheiro((p) => ({ ...p, areaAtuacao: e.target.value }))
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">
                          Anos de Experiência (opcional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          className="w-full border rounded px-3 py-2"
                          value={olheiro.anosExperiencia}
                          onChange={(e) =>
                            setOlheiro((p) => ({
                              ...p,
                              anosExperiencia: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">
                          Headline (opcional)
                        </label>
                        <input
                          className="w-full border rounded px-3 py-2"
                          placeholder="Ex: Scout focado em categorias de base"
                          value={olheiro.headline}
                          onChange={(e) =>
                            setOlheiro((p) => ({ ...p, headline: e.target.value }))
                          }
                        />
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">
                          Site ou Linkedin (opcional)
                        </label>
                        <input
                          className="w-full border rounded px-3 py-2"
                          placeholder="https://..."
                          value={olheiro.siteOuLinkedin}
                          onChange={(e) =>
                            setOlheiro((p) => ({ ...p, siteOuLinkedin: e.target.value }))
                          }
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Telefone público (opcional)
                          </label>
                          <input
                            className="w-full border rounded px-3 py-2"
                            placeholder="(00) 00000-0000"
                            value={olheiro.telefonePublico}
                            onChange={(e) =>
                              setOlheiro((p) => ({ ...p, telefonePublico: e.target.value }))
                            }
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Email público (opcional)
                          </label>
                          <input
                            type="email"
                            className="w-full border rounded px-3 py-2"
                            placeholder="seuemail@exemplo.com"
                            value={olheiro.emailPublico}
                            onChange={(e) =>
                              setOlheiro((p) => ({ ...p, emailPublico: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium mb-1">
                          Descrição (opcional)
                        </label>
                        <textarea
                          className="w-full border rounded px-3 py-2"
                          rows={4}
                          placeholder="Fale um pouco sobre seu trabalho como olheiro..."
                          value={olheiro.descricao}
                          onChange={(e) =>
                            setOlheiro((p) => ({ ...p, descricao: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

              {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

              <div className="mt-6 flex justify-between">
                <button onClick={() => setEtapa(1)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50">Voltar</button>
                <button onClick={() => { if (podeIrParaEtapa3()) setEtapa(3); }} className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded">Próximo</button>
              </div>
            </div>
          )}

          {etapa === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Complementar</h2>
              <p className="text-sm text-green-600 mb-4">Revise e finalize o cadastro</p>

              {(tipoPerfil === "Atleta" || tipoPerfil === "Olheiro") && (
                <div className="border rounded-md p-3 mb-4">
                  <label className="flex items-center text-sm">
                    <input type="checkbox" className="mr-2" checked={vinculo.desejaVinculo} onChange={(e) => setVinculo(p => ({ ...p, desejaVinculo: e.target.checked }))} />
                    Desejo solicitar vínculo com uma Escolinha, Professor ou Clube agora
                  </label>

                  {vinculo.desejaVinculo && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Tipo do destinatário</label>
                        <select className="w-full border rounded px-3 py-2" value={vinculo.tipoAlvo} onChange={(e) => setVinculo(p => ({ ...p, tipoAlvo: e.target.value as any, destinatarioId: "" }))}>
                          <option value="">Selecione</option><option value="Escolinha">Escolinha</option><option value="Professor">Professor</option><option value="Clube">Clube</option>
                        </select>
                      </div>

                      {!!vinculo.tipoAlvo && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1">Buscar por nome/username</label>
                            <input className="w-full border rounded px-3 py-2" placeholder={`Ex: ${vinculo.tipoAlvo} "Estrelas" ou "@usuario"`} value={vinculo.alvoBusca} onChange={(e) => setVinculo(p => ({ ...p, alvoBusca: e.target.value }))} />
                            {vinculo.alvoBusca && resultadosBusca.length === 0 && <p className="text-xs text-gray-500 mt-1">Buscando...</p>}
                          </div>

                          {resultadosBusca.length > 0 && (
                            <div className="max-h-48 overflow-auto border rounded mt-2 p-2 space-y-2">
                              {resultadosBusca.map((u) => {
                                const selected = vinculo.destinatarioId === u.id;
                                return (
                                  <button key={u.id} type="button" aria-pressed={selected}
                                    className={`w-full text-left px-3 py-2 rounded-md border transition hover:bg-gray-50 ${selected ? "bg-green-50 border-green-600 ring-1 ring-green-600" : "border-gray-200"}`}
                                    onClick={() =>
                                      setVinculo((p) => ({
                                        ...p,
                                        destinatarioId: u.usuarioId,          // Usuario.id
                                        destinatarioEntidadeId: u.id,         // id da entidade
                                        alvoBusca: u.nome,
                                      }))
                                    }>
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={getAvatarSrc(u.fotoUrl)}
                                        alt={u.nome}
                                        className="w-8 h-8 rounded-full object-cover border"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                          e.currentTarget.src = AVATAR_FALLBACK;
                                        }}
                                      />
                                      <div>
                                        <div className="text-sm font-medium">{u.nome}</div>
                                        <div className="text-xs text-gray-500">@{u.username} • {u.tipo}</div>
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
                                src={getAvatarSrc(selectedAlvo.fotoUrl)}
                                alt={selectedAlvo.nome}
                                className="w-12 h-12 rounded-full object-cover border"
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                  e.currentTarget.src = AVATAR_FALLBACK;
                                }}
                              />
                              <div className="text-sm">
                                <div className="font-medium">{selectedAlvo.nome}</div>
                                <div className="text-gray-500">@{selectedAlvo.username} • {selectedAlvo.tipo}</div>
                              </div>
                              <button type="button" className="ml-auto text-xs px-3 py-1 border rounded hover:bg-white" onClick={() => setVinculo(p => ({ ...p, destinatarioId: "" }))}>Trocar</button>
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
                {PRECISA_NASCIMENTO(tipoPerfil) && (
                  <div><span className="font-medium">Nascimento:</span> {dataNascimento || "-"}</div>
                )}

                <div className="mt-2">
                  <span className="font-medium">Localização:</span> {`${bairro ? bairro + ", " : ""}${cidade || "-"}`} {estado ? `- ${estado}` : ""} {pais ? `• ${pais}` : ""}
                </div>

                {idade !== null && idade < 18 && (
                  <div className="mt-2">
                    <div><span className="font-medium">Responsável:</span> {responsavel.nome || "-"}</div>
                    <div><span className="font-medium">Email Resp.:</span> {responsavel.email || "-"}</div>
                    <div><span className="font-medium">Telefone Resp.:</span> {responsavel.telefone || "-"}</div>
                  </div>
                )}
                {tipoPerfil === "Atleta" && (
                  <div className="mt-2">
                    <div><span className="font-medium">Idade:</span> {idade ?? "-"}</div>
                    <div><span className="font-medium">Categoria*:</span> {atleta.categoria || "-"}</div>
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
                    <div><span className="font-medium">CNPJ:</span> {clube.cnpjClube || "-"}</div>
                  </div>
                )}
                {tipoPerfil === "Escolinha" && (
                  <div className="mt-2">
                    <div><span className="font-medium">CNPJ:</span> {escolinha.cnpjEscolinha || "-"}</div>
                  </div>
                )}
                {tipoPerfil === "Olheiro" && (
                  <div className="mt-2 space-y-1">
                    <div><span className="font-medium">Área de atuação:</span> {olheiro.areaAtuacao || "-"}</div>
                    <div><span className="font-medium">Experiência:</span> {olheiro.anosExperiencia === "" ? "-" : `${olheiro.anosExperiencia} ano(s)`}</div>
                    <div><span className="font-medium">Headline:</span> {olheiro.headline || "-"}</div>
                    <div><span className="font-medium">Site/Linkedin:</span> {olheiro.siteOuLinkedin || "-"}</div>
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

              <p className="text-center text-sm mt-4">
                Já tem uma conta? <a href="/login" className="text-green-700 underline">Faça login</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}