// client/src/pages/cadastro.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import logo from "/assets/usuarios/footera-logo.png";
import { API } from "../config.js";

// ====== Tipos ======
type TipoPerfil = "Atleta" | "Professor" | "Escolinha" | "Clube" | "Admin";
type Etapa = 1 | 2 | 3;

type UsuarioBase = {
  tipo: TipoPerfil;
  nome: string;
  email: string;
  nomeDeUsuario: string;
  senha: string;
  confirmarSenha: string;
  aceitaTermos: boolean;
};

type CamposAtleta = {
  idade: number | "";
  categoria: string;
  treinaEscolinha: "sim" | "nao" | "";
};

type CamposProfessor = {
  treinaEscolinha: "sim" | "nao" | "";
  areaFormacao: string;
  cref?: string;
  statusCref?: "Ativo" | "Desativo" | "Pendente";
};

type CamposClube = {
  cnpjClube: string;
  cidadeClube: string;
};

type CamposEscolinha = {
  cnpjEscolinha: string;
  cidadeEscolinha: string;
};

type CamposVinculo = {
  desejaVinculo: boolean;
  tipoAlvo: "Professor" | "Escolinha" | "Clube" | "";
  alvoBusca: string;           // busca por nome/username
  destinatarioId: string;      // selecionado/confirmado
};

type ResultadoBusca = {
  id: string;
  tipo: "Professor" | "Escolinha" | "Clube";
  nome: string;
  username: string;
  fotoUrl: string | null;
};

// Placeholder para avatar
const PLACEHOLDER_AVATAR = logo;

// Helper: debounce
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 400) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export default function Cadastro() {
  const [_, navigate] = useLocation();

  // ====== Estado base (Etapa 1) ======
  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfil>("Atleta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitaTermos, setAceitaTermos] = useState(false);

  // feedbacks
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // ====== Etapas ======
  const [etapa, setEtapa] = useState<Etapa>(1);

  // ====== Campos por tipo (Etapa 2) ======
  const [atleta, setAtleta] = useState<CamposAtleta>({ idade: "", categoria: "", treinaEscolinha: "" });
  const [professor, setProfessor] = useState<CamposProfessor>({
    treinaEscolinha: "",
    areaFormacao: "",
    statusCref: "Pendente",
    cref: ""
  });
  const [clube, setClube] = useState<CamposClube>({ cnpjClube: "", cidadeClube: "" });
  const [escolinha, setEscolinha] = useState<CamposEscolinha>({ cnpjEscolinha: "", cidadeEscolinha: "" });

  // ====== Complementar (Etapa 3) – vínculo p/ Atleta ======
  const [vinculo, setVinculo] = useState<CamposVinculo>({
    desejaVinculo: false,
    tipoAlvo: "",
    alvoBusca: "",
    destinatarioId: "",
  });

  // ====== Checagens de disponibilidade (Etapa 1) ======
  const [emailDisp, setEmailDisp] = useState<null | boolean>(null);
  const [userDisp, setUserDisp] = useState<null | boolean>(null);

  const verificarEmail = useMemo(
    () =>
      debounce(async (e: string) => {
        if (!e) return setEmailDisp(null);
        try {
          const r = await fetch(`${API.BASE_URL}/api/cadastro/check/email?email=${encodeURIComponent(e)}`);
          const j = await r.json();
          setEmailDisp(Boolean(j?.disponivel));
        } catch {
          setEmailDisp(null);
        }
      }, 350),
    []
  );

  const verificarUsername = useMemo(
    () =>
      debounce(async (u: string) => {
        if (!u) return setUserDisp(null);
        try {
          const r = await fetch(`${API.BASE_URL}/api/cadastro/check/username?username=${encodeURIComponent(u)}`);
          const j = await r.json();
          setUserDisp(Boolean(j?.disponivel));
        } catch {
          setUserDisp(null);
        }
      }, 350),
    []
  );

  useEffect(() => { verificarEmail(email.trim().toLowerCase()); }, [email]);
  useEffect(() => { verificarUsername(nomeDeUsuario.trim().toLowerCase()); }, [nomeDeUsuario]);

  // ====== Validações por etapa ======
  const podeIrParaEtapa2 = () => {
    if (!aceitaTermos) return setErro("Você deve aceitar os termos."), false;
    if (!nome || !email || !nomeDeUsuario || !senha || !confirmarSenha) return setErro("Preencha todos os campos obrigatórios da etapa 1."), false;
    if (senha !== confirmarSenha) return setErro("As senhas não coincidem."), false;
    if (emailDisp === false) return setErro("E-mail já cadastrado."), false;
    if (userDisp === false) return setErro("Nome de usuário indisponível."), false;
    setErro("");
    return true;
  };

  const podeIrParaEtapa3 = () => {
    if (tipoPerfil === "Atleta") {
      if (atleta.idade === "" || Number.isNaN(atleta.idade)) return setErro("Informe a idade do atleta."), false;
      if (!atleta.categoria) return setErro("Selecione a categoria do atleta."), false;
    }
    if (tipoPerfil === "Professor") {
      if (!professor.areaFormacao) return setErro("Informe a área de formação."), false;
    }
    if (tipoPerfil === "Clube") {
      if (!clube.cidadeClube) return setErro("Informe a cidade do clube."), false;
    }
    if (tipoPerfil === "Escolinha") {
      if (!escolinha.cidadeEscolinha) return setErro("Informe a cidade da escolinha."), false;
    }
    setErro("");
    return true;
  };

  // ====== Submeter (criar conta + opcional: criar solicitação de vínculo) ======
  const handleFinalizar = async () => {
    setErro("");
    setSucesso("");

    try {
      // monta payload principal
      const payload: any = {
        tipo: tipoPerfil,
        nome,
        email,
        nomeDeUsuario,
        senha,
      };

      if (tipoPerfil === "Atleta") {
        payload.idade = atleta.idade;
        payload.categoria = atleta.categoria ? [atleta.categoria] : [];
        payload.treinaEscolinha = atleta.treinaEscolinha || "nao";
      }
      if (tipoPerfil === "Professor") {
        payload.areaFormacao = professor.areaFormacao;
        if (professor.cref) payload.cref = professor.cref;
        if (professor.statusCref) payload.statusCref = professor.statusCref;
        payload.treinaEscolinha = professor.treinaEscolinha || "nao";
      }
      if (tipoPerfil === "Clube") {
        payload.cnpjClube = clube.cnpjClube || undefined;
        payload.cidadeClube = clube.cidadeClube || undefined;
      }
      if (tipoPerfil === "Escolinha") {
        payload.cnpjEscolinha = escolinha.cnpjEscolinha || undefined;
        payload.cidadeEscolinha = escolinha.cidadeEscolinha || undefined;
      }

      // cria usuário/tipo
      const res = await fetch(`${API.BASE_URL}/api/cadastro/cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Erro ao cadastrar.");
      }

      const data = await res.json();
      setSucesso("Cadastro realizado com sucesso!");

      // Se for atleta e marcou "deseja vínculo", cria a solicitação
      if (tipoPerfil === "Atleta" && vinculo.desejaVinculo && vinculo.destinatarioId) {
        try {
          await fetch(`${API.BASE_URL}/api/solicitacoes`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // o controller de cadastro retorna um token opcional (se existirem as vars de ambiente)
              ...(data?.token ? { Authorization: `Bearer ${data.token}` } : {}),
            },
            body: JSON.stringify({ destinatarioId: vinculo.destinatarioId }),
          });
        } catch (e) {
          console.warn("Falha ao criar solicitação de vínculo:", e);
        }
      }

      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      setErro(err?.message || "Falha no cadastro.");
    }
  };

  // ====== Busca simples do alvo para o vínculo ======
  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca[]>([]);

  const buscarAlvo = useMemo(
    () =>
      debounce(async (q: string, tipoAlvo: string) => {
        setResultadosBusca([]);
        if (!q) return;
        try {
          const url = `${API.BASE_URL}/api/cadastro/buscar?query=${encodeURIComponent(q)}&tipo=${encodeURIComponent(tipoAlvo || "Todos")}`;
          const r = await fetch(url);
          if (r.ok) {
            const j = await r.json();
            const arr: ResultadoBusca[] = (Array.isArray(j) ? j : []).filter(x => x?.id && x?.nome);
            setResultadosBusca(arr);
          }
        } catch {
          setResultadosBusca([]);
        }
      }, 400),
    []
  );

  useEffect(() => {
    if (etapa === 3 && tipoPerfil === "Atleta" && vinculo.desejaVinculo && vinculo.tipoAlvo && vinculo.alvoBusca.length >= 2) {
      buscarAlvo(vinculo.alvoBusca, vinculo.tipoAlvo);
    } else {
      setResultadosBusca([]);
    }
  }, [etapa, tipoPerfil, vinculo.desejaVinculo, vinculo.tipoAlvo, vinculo.alvoBusca]);

  // Item selecionado (para mostrar cartão com foto)
  const selectedAlvo: ResultadoBusca | null = useMemo(
    () => resultadosBusca.find(r => r.id === vinculo.destinatarioId) || null,
    [resultadosBusca, vinculo.destinatarioId]
  );

  // ====== UI helpers ======
  const Step = ({ n, label }: { n: Etapa; label: string }) => {
    const active = etapa === n;
    const done = etapa > n;
    return (
      <div className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
          ${done ? "bg-green-700 text-white" : active ? "bg-green-900 text-white" : "bg-gray-200 text-gray-700"}`}>
          {n}
        </div>
        <span className={`ml-2 text-sm ${active || done ? "text-green-900 font-medium" : "text-gray-500"}`}>{label}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* Lado esquerdo */}
      <div className="w-full lg:w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10">
        <img src={logo} alt="Logo FootEra" className="w-20 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Bem-vindo à FootEra</h1>
        <p className="text-center max-w-md text-lg">
          Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar... aqui é o seu lugar.
          FootEra. A metodologia dos profissionais, para quem vive futebol.
        </p>
        <ul className="text-left mt-6 text-base list-disc list-inside space-y-1 opacity-90">
          <li>Treinamentos personalizados</li>
          <li>Desafios para testar suas habilidades</li>
          <li>Compartilhe seu progresso com a comunidade</li>
          <li>Conecte-se com escolinhas e clubes profissionais</li>
          <li>Acompanhe sua evolução com pontuações e rankings</li>
        </ul>
      </div>

      {/* Lado direito (form) */}
      <div className="bg-cream flex justify-center items-center p-6 lg:p-10 w-full lg:w-1/2">
        <div className="bg-white rounded-2xl shadow-md w-full max-w-xl p-6">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-6">
            <Step n={1} label="Dados de Usuário" />
            <div className={`flex-1 mx-2 h-0.5 ${etapa >= 2 ? "bg-green-800" : "bg-gray-200"}`} />
            <Step n={2} label="Dados do Tipo" />
            <div className={`flex-1 mx-2 h-0.5 ${etapa >= 3 ? "bg-green-800" : "bg-gray-200"}`} />
            <Step n={3} label="Complementar" />
          </div>

          {/* Conteúdo por etapa */}
          {etapa === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Criar conta</h2>
              <p className="text-sm text-green-600 mb-4">Preencha os campos abaixo</p>

              <label className="block mb-2 font-medium">Tipo de Perfil</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(["Atleta","Escolinha","Clube","Professor","Admin"] as TipoPerfil[]).map((t) => (
                  <label className="flex items-center text-sm" key={t}>
                    <input
                      type="radio"
                      name="tipo"
                      className="mr-2"
                      value={t}
                      checked={tipoPerfil === t}
                      onChange={(e) => setTipoPerfil(e.target.value as TipoPerfil)}
                    />
                    {t === "Escolinha" ? "Escolinha de Futebol" :
                     t === "Clube" ? "Clube Profissional" :
                     t === "Professor" ? "Profissional do Futebol" : t}
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Nome Completo</label>
                <input className="w-full border rounded px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {email && (
                  <p className={`text-xs mt-1 ${emailDisp ? "text-green-700" : emailDisp === false ? "text-red-600" : "text-gray-400"}`}>
                    {emailDisp === null ? "Verificando..." : emailDisp ? "Disponível" : "Já cadastrado"}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Nome de usuário</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={nomeDeUsuario}
                  onChange={(e) => setNomeDeUsuario(e.target.value)}
                />
                {nomeDeUsuario && (
                  <p className={`text-xs mt-1 ${userDisp ? "text-green-700" : userDisp === false ? "text-red-600" : "text-gray-400"}`}>
                    {userDisp === null ? "Verificando..." : userDisp ? "Disponível" : "Indisponível"}
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Senha</label>
                  <input type="password" className="w-full border rounded px-3 py-2" value={senha} onChange={(e) => setSenha(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirmar Senha</label>
                  <input type="password" className="w-full border rounded px-3 py-2" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
                </div>
              </div>

              <div className="mt-4 mb-3">
                <label className="flex items-center text-sm">
                  <input type="checkbox" className="mr-2" checked={aceitaTermos} onChange={(e) => setAceitaTermos(e.target.checked)} />
                  Li e aceito os&nbsp;
                  <a href="#" className="underline text-blue-700">Termos de Uso</a> e&nbsp;
                  <a href="#" className="underline text-blue-700">Política de Privacidade</a>
                </label>
              </div>

              {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}

              <div className="flex justify-end">
                <button
                  onClick={() => { if (podeIrParaEtapa2()) setEtapa(2); }}
                  className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded"
                >
                  Próximo
                </button>
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

              {tipoPerfil === "Atleta" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">
                      Você treina em alguma escolinha cadastrada na FootEra?
                    </label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          className="mr-2"
                          name="escolinha_at"
                          value="sim"
                          checked={atleta.treinaEscolinha === "sim"}
                          onChange={(e) => {
                            const v = e.target.value as "sim" | "nao";
                            setAtleta(p => ({ ...p, treinaEscolinha: v }));
                            if (v === "sim") setVinculo(p => ({ ...p, desejaVinculo: true })); // liga vínculo
                          }}
                        />
                        Sim
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          className="mr-2"
                          name="escolinha_at"
                          value="nao"
                          checked={atleta.treinaEscolinha === "nao"}
                          onChange={(e) => {
                            const v = e.target.value as "sim" | "nao";
                            setAtleta(p => ({ ...p, treinaEscolinha: v }));
                            if (v === "nao") setVinculo(p => ({ ...p, desejaVinculo: false, destinatarioId: "", alvoBusca: "" }));
                          }}
                        />
                        Não, sou independente
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Idade</label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={atleta.idade}
                        onChange={(e) => setAtleta(p => ({ ...p, idade: e.target.value ? parseInt(e.target.value) : "" }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Categoria</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={atleta.categoria}
                        onChange={(e) => setAtleta(p => ({ ...p, categoria: e.target.value }))}
                      >
                        <option value="">Selecione</option>
                        <option value="Sub9">Sub9</option>
                        <option value="Sub11">Sub11</option>
                        <option value="Sub13">Sub13</option>
                        <option value="Sub15">Sub15</option>
                        <option value="Sub17">Sub17</option>
                        <option value="Sub20">Sub20</option>
                        <option value="Livre">Livre</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {tipoPerfil === "Professor" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Você dá aula em alguma escolinha cadastrada?</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center">
                        <input type="radio" className="mr-2" name="escolinha_pf" value="sim"
                          checked={professor.treinaEscolinha === "sim"}
                          onChange={(e) => setProfessor(p => ({ ...p, treinaEscolinha: e.target.value as any }))} />
                        Sim
                      </label>
                      <label className="flex items-center">
                        <input type="radio" className="mr-2" name="escolinha_pf" value="nao"
                          checked={professor.treinaEscolinha === "nao"}
                          onChange={(e) => setProfessor(p => ({ ...p, treinaEscolinha: e.target.value as any }))} />
                        Não, independente
                      </label>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Área de Formação</label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      value={professor.areaFormacao}
                      onChange={(e) => setProfessor(p => ({ ...p, areaFormacao: e.target.value }))}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">CREF (opcional)</label>
                      <input
                        className="w-full border rounded px-3 py-2"
                        value={professor.cref || ""}
                        onChange={(e) => setProfessor(p => ({ ...p, cref: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium mb-1">Status do CREF</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={professor.statusCref || "Pendente"}
                        onChange={(e) => setProfessor(p => ({ ...p, statusCref: e.target.value as any }))}
                      >
                        <option>Pendente</option>
                        <option>Ativo</option>
                        <option>Desativo</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {tipoPerfil === "Clube" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Parceria com a FootEra?</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center">
                        <input type="radio" className="mr-2" name="parceria_clube" value="sim" /> Sim
                      </label>
                      <label className="flex items-center">
                        <input type="radio" className="mr-2" name="parceria_clube" value="nao" /> Não
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">CNPJ (opcional)</label>
                      <input
                        className="w-full border rounded px-3 py-2"
                        placeholder="00.000.000/0000-00"
                        value={clube.cnpjClube}
                        onChange={(e) => setClube(p => ({ ...p, cnpjClube: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Cidade</label>
                      <input
                        className="w-full border rounded px-3 py-2"
                        placeholder="Ex: São Paulo - SP"
                        value={clube.cidadeClube}
                        onChange={(e) => setClube(p => ({ ...p, cidadeClube: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {tipoPerfil === "Escolinha" && (
                <>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">É uma escolinha cadastrada?</label>
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center">
                        <input type="radio" className="mr-2" name="parceria_escolinha" value="sim" /> Sim
                      </label>
                      <label className="flex items-center">
                        <input type="radio" className="mr-2" name="parceria_escolinha" value="nao" /> Não
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">CNPJ (opcional)</label>
                      <input
                        className="w-full border rounded px-3 py-2"
                        placeholder="00.000.000/0000-00"
                        value={escolinha.cnpjEscolinha}
                        onChange={(e) => setEscolinha(p => ({ ...p, cnpjEscolinha: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Cidade</label>
                      <input
                        className="w-full border rounded px-3 py-2"
                        placeholder="Ex: São Paulo - SP"
                        value={escolinha.cidadeEscolinha}
                        onChange={(e) => setEscolinha(p => ({ ...p, cidadeEscolinha: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {tipoPerfil === "Admin" && (
                <p className="text-sm text-gray-600">Nenhuma informação adicional é necessária para Admin.</p>
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
                  onClick={() => { if (podeIrParaEtapa3()) setEtapa(3); }}
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
              <p className="text-sm text-green-600 mb-4">Revise e finalize o cadastro</p>

              {/* Opção de vínculo só aparece para Atleta */}
              {tipoPerfil === "Atleta" && (
                <div className="border rounded-md p-3 mb-4">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={vinculo.desejaVinculo}
                      onChange={(e) => setVinculo(p => ({ ...p, desejaVinculo: e.target.checked }))}
                    />
                    Desejo solicitar vínculo com uma Escolinha, Professor ou Clube agora
                  </label>

                  {vinculo.desejaVinculo && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Tipo do destinatário</label>
                        <select
                          className="w-full border rounded px-3 py-2"
                          value={vinculo.tipoAlvo}
                          onChange={(e) => setVinculo(p => ({ ...p, tipoAlvo: e.target.value as any, destinatarioId: "" }))}
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
                              onChange={(e) => setVinculo(p => ({ ...p, alvoBusca: e.target.value }))}
                            />
                            {vinculo.alvoBusca && resultadosBusca.length === 0 && (
                              <p className="text-xs text-gray-500 mt-1">Buscando...</p>
                            )}
                          </div>

                          {resultadosBusca.length > 0 && (
                            <div className="max-h-48 overflow-auto border rounded mt-2 p-2 space-y-2">
                              {resultadosBusca.map((u) => {
                                const selected = vinculo.destinatarioId === u.id;
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    aria-pressed={selected}
                                    className={`w-full text-left px-3 py-2 rounded-md border transition hover:bg-gray-50
                                      ${selected ? "bg-green-50 border-green-600 ring-1 ring-green-600" : "border-gray-200"}`}
                                    onClick={() => setVinculo((p) => ({ ...p, destinatarioId: u.id }))}
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
                                        <div className="text-xs text-gray-500">@{u.username} • {u.tipo}</div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Cartão de confirmação do selecionado */}
                          {selectedAlvo && (
                            <div className="mt-3 p-3 border rounded bg-gray-50 flex items-center gap-3">
                              <img
                                src={selectedAlvo.fotoUrl || PLACEHOLDER_AVATAR}
                                alt={selectedAlvo.nome}
                                className="w-12 h-12 rounded-full object-cover border"
                                onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = PLACEHOLDER_AVATAR; }}
                              />
                              <div className="text-sm">
                                <div className="font-medium">{selectedAlvo.nome}</div>
                                <div className="text-gray-500">@{selectedAlvo.username} • {selectedAlvo.tipo}</div>
                              </div>
                              <button
                                type="button"
                                className="ml-auto text-xs px-3 py-1 border rounded hover:bg-white"
                                onClick={() => setVinculo(p => ({ ...p, destinatarioId: "" }))}
                              >
                                Trocar
                              </button>
                            </div>
                          )}

                          <div className="text-xs text-gray-500 mt-2">
                            Não encontrou? Se já souber o ID do destinatário, cole aqui:
                            <input
                              className="w-full border rounded px-3 py-2 mt-1"
                              placeholder="destinatarioId (UUID)"
                              value={vinculo.destinatarioId}
                              onChange={(e) => setVinculo(p => ({ ...p, destinatarioId: e.target.value }))}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Resumo simples */}
              <div className="bg-gray-50 border rounded p-3 text-sm">
                <div><span className="font-medium">Tipo:</span> {tipoPerfil}</div>
                <div><span className="font-medium">Nome:</span> {nome}</div>
                <div><span className="font-medium">Email:</span> {email}</div>
                <div><span className="font-medium">Username:</span> @{nomeDeUsuario}</div>
                {tipoPerfil === "Atleta" && (
                  <div className="mt-2">
                    <div><span className="font-medium">Idade:</span> {atleta.idade || "-"}</div>
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
                    <div><span className="font-medium">CNPJ:</span> {clube.cnpjClube || "-"}</div>
                    <div><span className="font-medium">Cidade:</span> {clube.cidadeClube || "-"}</div>
                  </div>
                )}
                {tipoPerfil === "Escolinha" && (
                  <div className="mt-2">
                    <div><span className="font-medium">CNPJ:</span> {escolinha.cnpjEscolinha || "-"}</div>
                    <div><span className="font-medium">Cidade:</span> {escolinha.cidadeEscolinha || "-"}</div>
                  </div>
                )}
              </div>

              {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
              {sucesso && <p className="text-sm text-green-700 mt-3">{sucesso}</p>}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setEtapa(2)}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  onClick={handleFinalizar}
                  className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded"
                >
                  Finalizar cadastro
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
