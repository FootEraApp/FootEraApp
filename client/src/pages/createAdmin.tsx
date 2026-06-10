import { useMemo, useState, type ComponentPropsWithoutRef} from "react";
import logo from "/assets/usuarios/footera-logo.png";
import { API } from "../config.js";
import { Eye, EyeOff } from "lucide-react";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const USER_RE = /^(?=.{3,20}$)[a-z0-9._]+$/i;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const CEP_RE = /^\d{5}-?\d{3}$/;

function somenteDigitos(v: string) { return v.replace(/\D+/g, ""); }
function maskCEP(v: string) {
  const d = somenteDigitos(v).slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + "-" + d.slice(5);
}
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any; return (...a: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function authHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

export default function CreateAdmin() {
  const [cep, setCep] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [bairro, setBairro] = useState("");
  const [pais, setPais] = useState("Brasil");
  type CepStatus = "idle" | "loading" | "ok" | "not_found" | "invalid";
  const [cepStatus, setCepStatus] = useState<CepStatus>("idle");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [nascimento, setNascimento] = useState("");

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [infoAberto, setInfoAberto] = useState(false);

  const emailValido = EMAIL_RE.test(email.trim());
  const userValido = USER_RE.test(username.trim());
  const senhaForte = PASS_RE.test(senha);
  const confirmarOk = confirmar === senha && confirmar.length > 0;

  const buscarCEP = useMemo(
    () => debounce(async (valor: string) => {
      const num = somenteDigitos(valor);
      if (!num) { setCepStatus("idle"); setCidade(""); setEstado(""); setBairro(""); setPais("Brasil"); return; }
      if (num.length !== 8) { setCepStatus("invalid"); return; }
      setCepStatus("loading");
      try {
        const r = await fetch(`https://viacep.com.br/ws/${num}/json/`);
        const j = await r.json();
        if (!r.ok || j?.erro) { setCepStatus("not_found"); return; }
        setCidade(j?.localidade || ""); setEstado((j?.uf || "").toUpperCase());
        setBairro(j?.bairro || ""); setPais("Brasil"); setCepStatus("ok");
      } catch { setCepStatus("not_found"); }
    }, 400),
    []
  );
  useMemo(() => buscarCEP(cep), [cep, buscarCEP]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setOk("");

    if (!emailValido) return setErro("E-mail inválido.");
    if (!userValido) return setErro("Nome de usuário inválido (3–20, letras/números/._).");
    if (!senhaForte) return setErro("Senha fraca: mínimo 8 caracteres com letra e número.");
    if (!confirmarOk) return setErro("As senhas não coincidem.");
    if (cep && (!CEP_RE.test(cep) || !cidade || !estado)) {
      return setErro("CEP inválido: informe um CEP válido para preencher Cidade e UF (ou ajuste manualmente).");
    }

    const payload: any = {
      email: email.trim(),
      senha,
      nomeDeUsuario: username.trim(),
      // ✅ se seu backend exige "nome", manda fallback com username
      nome: (nome || "").trim() || username.trim(),
      // ✅ só manda dataNascimento se tiver preenchida
      ...(nascimento ? { dataNascimento: nascimento } : {}),
      // ✅ só manda endereço se o usuário tiver preenchido algo
      ...((cep || cidade || estado || bairro || pais) ? {
        endereco: {
          ...(cep ? { cep } : {}),
          ...(cidade ? { cidade } : {}),
          ...(estado ? { estado } : {}),
          ...(bairro ? { bairro } : {}),
          ...(pais ? { pais } : {}),
        }
      } : {})
    };

    try {
      const resp = await fetch(`${API.BASE_URL}/api/admin/admins`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || "Erro ao criar admin.");
      }

      setOk("Administrador criado com sucesso!");
      setTimeout(() => (window.location.href = "/admin?tab=usuarios"), 900);
    } catch (e: any) {
      setErro(e?.message || "Falha ao criar administrador.");
    }
  }

  return (
      <div className="flex flex-col lg:flex-row min-h-screen">
        <div className="w-full bg-[#14532d] text-white flex flex-col items-center px-5 py-6 sm:px-8 lg:w-1/2 lg:p-10">
          <div className="w-full max-w-[680px]">
            <div className="flex items-center justify-between gap-3 lg:flex-col lg:gap-2">
              <a href="/" className="cursor-pointer" aria-label="Voltar para Home">
                <img
                  src={logo}
                  alt="Logo FootEra"
                  className="
                    shrink-0 object-contain transform-gpu
                    w-14 h-14 sm:w-16 sm:h-16 lg:w-[130px] lg:h-[130px]
                    origin-left lg:origin-center mr-1
                  "
                />
              </a>

              <h1 className="flex-1 lg:flex-none text-center text-xl lg:text-3xl font-bold leading-tight">
                Bem-vindo à FootEra
              </h1>

              <button
                type="button"
                className="lg:hidden shrink-0 p-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 rounded-full"
                aria-expanded={infoAberto}
                aria-controls="admin-create-info"
                onClick={() => setInfoAberto((v) => !v)}
                title={infoAberto ? "Recolher" : "Expandir"}
              >
                {infoAberto ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>

            <div
              id="admin-create-info"
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                infoAberto
                  ? "max-h-[720px] opacity-100"
                  : "max-h-0 opacity-0 lg:max-h-[720px] lg:opacity-100"
              }`}
            >
              <p className="text-center text-base lg:text-2xl font-semibold mt-4">
                Treine. Aprenda. Se conecte. Evolua.
              </p>

              <p className="text-center text-sm lg:text-lg mt-4 text-white/95">
                O ecossistema digital do futebol, feito para quem vive o jogo.
              </p>

              <div className="mt-6 p-5 lg:p-6 rounded-2xl text-sm lg:text-base text-left w-full bg-white/10 border border-white/10 shadow-lg">
                <h2 className="font-semibold text-xl lg:text-2xl mb-4">
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
   
         <div className="relative bg-cream flex justify-center items-start p-6 lg:p-10 w-full lg:w-1/2">
           <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-0">
             <div aria-hidden className="w-[420px] h-[420px] opacity-[0.06] lg:opacity-[0.08] rounded-full overflow-hidden"
               style={{ backgroundImage: `url(${logo})`, backgroundRepeat: "no-repeat", backgroundPosition: "center 20%", backgroundSize: "85% auto", filter: "grayscale(100%)" }} />
           </div>

        <div className="relative z-10 bg-white rounded-2xl shadow-md w-full max-w-xl min-w-0 overflow-hidden p-4 sm:p-6 mx-auto lg:mt-6">
          <h2 className="text-xl font-semibold mb-1">Criar conta admin</h2>
          <p className="text-sm text-green-600 mb-4">Preencha os campos abaixo</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome Completo (opcional)</label>
              <input className="w-full border rounded px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nome de usuário*</label>
              <input className={`w-full border rounded px-3 py-2 ${username && !userValido ? "border-red-400" : ""}`} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email*</label>
              <input type="email" className={`w-full border rounded px-3 py-2 ${email && !emailValido ? "border-red-400" : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <button type="button" onClick={() => setMostrarSenha(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
                    {mostrarSenha ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                {senha && <p className={`text-xs mt-1 ${senhaForte ? "text-green-700" : "text-red-600"}`}>Mín. 8 caracteres com letra e número.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Confirmar Senha*</label>
                <div className="relative">
                  <input
                    type={mostrarConfirmar ? "text" : "password"}
                    autoComplete="new-password"
                    className={`w-full border rounded px-3 py-2 pr-10 ${confirmar && !confirmarOk ? "border-red-400" : ""}`}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                  />
                  <button type="button" onClick={() => setMostrarConfirmar(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
                    {mostrarConfirmar ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                {confirmar && <p className={`text-xs mt-1 ${confirmarOk ? "text-green-700" : "text-red-600"}`}>{confirmarOk ? "OK" : "Senhas não coincidem."}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <p className={`text-xs mt-1 ${
                    cepStatus === "loading" ? "text-gray-500" :
                    cepStatus === "ok" ? "text-green-700" :
                    "text-red-600"
                  }`}>
                    {cepStatus === "loading" ? "Buscando endereço…" :
                     cepStatus === "ok" ? "Endereço localizado pelo CEP." :
                     cepStatus === "invalid" ? "CEP inválido." :
                     "CEP não encontrado."}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cidade (opcional)</label>
                <input className="w-full border rounded px-3 py-2" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">UF (opcional)</label>
                <input className="w-full border rounded px-3 py-2 uppercase" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0,2))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bairro (opcional)</label>
                <input className="w-full border rounded px-3 py-2" value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">País (opcional)</label>
                <input className="w-full border rounded px-3 py-2" value={pais} onChange={(e) => setPais(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data de nascimento (opcional)</label>
              <input type="date" className="w-full border rounded px-3 py-2" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            {ok && <p className="text-sm text-green-700">{ok}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <a href="/admin" className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50">Cancelar</a>
              <button type="submit" className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded">Criar admin</button>
            </div>
          </form>

          <p className="text-center text-sm mt-4">
            Voltar para o <a href="/admin" className="text-green-700 underline">Painel</a>
          </p>
        </div>
      </div>
    </div>
  );
}