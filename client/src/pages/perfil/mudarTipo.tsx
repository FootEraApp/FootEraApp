import { toast } from "@/lib/toast";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  GraduationCap,
  Shield,
  Target,
  Telescope,
  Trophy,
  User,
} from "lucide-react";
import { API } from "../../config.js";

type TipoDestino =
  | "ATLETA"
  | "PROFESSOR"
  | "OLHEIRO"
  | "CLUBE"
  | "ESCOLINHA"
  | "FEDERACAO"
  | "MARCA";

const opcoes: {
  tipo: TipoDestino;
  titulo: string;
  subtitulo: string;
  grupo: "Pessoa" | "Organização";
  icon: JSX.Element;
}[] = [
  {
    tipo: "ATLETA",
    titulo: "Atleta",
    subtitulo: "Quero treinar, evoluir e participar do ecossistema esportivo.",
    grupo: "Pessoa",
    icon: <Trophy size={26} />,
  },
  {
    tipo: "PROFESSOR",
    titulo: "Profissional",
    subtitulo: "Sou professor, treinador ou especialista do esporte.",
    grupo: "Pessoa",
    icon: <Target size={26} />,
  },
  {
    tipo: "OLHEIRO",
    titulo: "Scout",
    subtitulo: "Quero observar, avaliar e indicar atletas.",
    grupo: "Pessoa",
    icon: <Telescope size={26} />,
  },
  {
    tipo: "ESCOLINHA",
    titulo: "Escolinha",
    subtitulo: "Tenho uma organização de formação de atletas.",
    grupo: "Organização",
    icon: <GraduationCap size={26} />,
  },
  {
    tipo: "CLUBE",
    titulo: "Clube",
    subtitulo: "Represento um clube ou equipe esportiva.",
    grupo: "Organização",
    icon: <Shield size={26} />,
  },
  {
    tipo: "FEDERACAO",
    titulo: "Federação",
    subtitulo: "Canal institucional com eventos, cursos e certificações.",
    grupo: "Organização",
    icon: <Building2 size={26} />,
  },
  {
    tipo: "MARCA",
    titulo: "Marca",
    subtitulo: "Marca parceira, patrocinadora ou produtora de conteúdo.",
    grupo: "Organização",
    icon: <User size={26} />,
  },
];

const posicoesCampo = [
  { value: "GOL", label: "Goleiro (GOL)" },
  { value: "LD", label: "Lateral direito (LD)" },
  { value: "LE", label: "Lateral esquerdo (LE)" },
  { value: "ZD", label: "Zagueiro direito (ZD)" },
  { value: "ZC", label: "Zagueiro central (ZC)" },
  { value: "ZE", label: "Zagueiro esquerdo (ZE)" },
  { value: "ALA_D", label: "Ala direito (ALA_D)" },
  { value: "ALA_E", label: "Ala esquerdo (ALA_E)" },
  { value: "VOL1", label: "Volante 1 (VOL1)" },
  { value: "VOL2", label: "Volante 2 (VOL2)" },
  { value: "MC1", label: "Meia central 1 (MC1)" },
  { value: "MC2", label: "Meia central 2 (MC2)" },
  { value: "MEI", label: "Meia ofensivo (MEI)" },
  { value: "MEI_D", label: "Meia direita (MEI_D)" },
  { value: "MEI_E", label: "Meia esquerda (MEI_E)" },
  { value: "ATA", label: "Atacante (ATA)" },
  { value: "PD", label: "Ponta direita (PD)" },
  { value: "PE", label: "Ponta esquerda (PE)" },
  { value: "CA", label: "Centroavante (CA)" },
];

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function getUsuarioNome() {
  return (
    localStorage.getItem("nomeUsuario") ||
    sessionStorage.getItem("nomeUsuario") ||
    ""
  );
}

const hojeInput = new Date().toISOString().slice(0, 10);

function calcularIdade(dataNascimento: string) {
  if (!dataNascimento) return null;

  const data = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();

  const mesAtual = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const mesNasc = data.getMonth();
  const diaNasc = data.getDate();

  if (mesAtual < mesNasc || (mesAtual === mesNasc && diaAtual < diaNasc)) {
    idade--;
  }

  return idade;
}

function validarDataNascimento(dataNascimento: string) {
  if (!dataNascimento) return false;

  const data = new Date(`${dataNascimento}T00:00:00`);
  const min = new Date("1900-01-01T00:00:00");
  const hoje = new Date(`${hojeInput}T00:00:00`);

  return !Number.isNaN(data.getTime()) && data >= min && data <= hoje;
}

function LabelOpcional() {
  return <span className="font-normal text-green-800/60">(opcional)</span>;
}

export default function MudarTipoPerfilPage() {
  const [, setLocation] = useLocation();

  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDestino | "">("");
  const [nome, setNome] = useState(getUsuarioNome());
  const [nomeOrganizacao, setNomeOrganizacao] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [posicao, setPosicao] = useState("");
  const [areaFormacao, setAreaFormacao] = useState("");
  const [cref, setCref] = useState("");
  const [statusCref, setStatusCref] = useState("");
  const [areaAtuacao, setAreaAtuacao] = useState("");
  const [anosExperiencia, setAnosExperiencia] = useState("");
  const [headline, setHeadline] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const isOrganizacao = useMemo(
    () =>
      ["CLUBE", "ESCOLINHA", "FEDERACAO", "MARCA"].includes(
        String(tipoSelecionado)
      ),
    [tipoSelecionado]
  );

  const isAtleta = tipoSelecionado === "ATLETA";
  const isProfessor = tipoSelecionado === "PROFESSOR";
  const isOlheiro = tipoSelecionado === "OLHEIRO";

  function validar() {
    setErro("");

    if (!tipoSelecionado) {
        setErro("Escolha o novo tipo de perfil.");
        return false;
    }

    if (isOrganizacao && !nomeOrganizacao.trim()) {
        setErro("Informe o nome da organização.");
        return false;
    }

    const precisaDataNascimento = isAtleta || isProfessor || isOlheiro;

    if (precisaDataNascimento && !dataNascimento.trim()) {
        setErro("Informe a data de nascimento.");
        return false;
    }

    if (precisaDataNascimento && !validarDataNascimento(dataNascimento)) {
        setErro("A data de nascimento deve estar entre 1900 e a data de hoje.");
        return false;
    }

    return true;
 }

  async function salvar() {
    if (!validar()) return;

    const token = getToken();

    if (!token) {
      setLocation("/login");
      return;
    }

    try {
      setLoading(true);
      setErro("");

      const payload: any = {
        tipo: tipoSelecionado,
        nome: nome.trim() || undefined,
      };

      if (isAtleta) {
        payload.dataNascimento = dataNascimento || undefined;
        payload.categoria = categoria || undefined;
        payload.posicao = posicao || undefined;
      }

      if (isProfessor) {
        payload.dataNascimento = dataNascimento || undefined;
        payload.areaFormacao = areaFormacao || undefined;
        payload.cref = cref || undefined;
        payload.statusCref = statusCref || undefined;
      }

      if (isOlheiro) {
        payload.dataNascimento = dataNascimento || undefined;
        payload.areaAtuacao = areaAtuacao || undefined;
        payload.anosExperiencia = anosExperiencia
          ? Number(anosExperiencia)
          : undefined;
        payload.headline = headline || undefined;
      }

      if (isOrganizacao) {
        payload.nomeOrganizacao = nomeOrganizacao || nome || undefined;
        payload.cnpj = cnpj || undefined;
        payload.cidade = cidade || undefined;
        payload.estado = estado || undefined;
      }

      const res = await fetch(`${API.BASE_URL}/api/perfil/learning/upgrade`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Erro ao mudar tipo de perfil.");
      }

      const tipoLower = String(tipoSelecionado).toLowerCase();

      localStorage.setItem("tipoUsuario", tipoLower);
      sessionStorage.setItem("tipoUsuario", tipoLower);
      localStorage.setItem("usuarioTipoRaw", tipoLower);
      sessionStorage.setItem("usuarioTipoRaw", tipoLower);

      toast.success("Tipo de perfil atualizado com sucesso!");

      if (tipoLower === "federacao" || tipoLower === "marca") {
        window.location.href = "/creator/dashboard";
        return;
      }

      window.location.href = "/perfil";
    } catch (e: any) {
      setErro(e?.message || "Erro ao mudar tipo de perfil.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f2e8] pb-24">
      <header className="bg-green-900 text-white px-5 py-6">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-5 h-11 w-11 rounded-full border border-white/30 flex items-center justify-center"
        >
          <ArrowLeft size={22} />
        </button>

        <h1 className="text-2xl font-extrabold">Mudar tipo de perfil</h1>
        <p className="text-white/80 mt-1">
          Transforme sua conta Learning em um perfil completo da FootEra.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <section className="bg-white rounded-2xl border p-5 shadow-sm">
          <h2 className="font-bold text-green-950 mb-1">
            Escolha seu novo perfil
          </h2>
          <p className="text-sm text-green-900/70 mb-4">
            Você não perde seus cursos, lives, metodologias compradas nem seu progresso.
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            {opcoes.map((opcao) => {
              const ativo = tipoSelecionado === opcao.tipo;

              return (
                <button
                  key={opcao.tipo}
                  type="button"
                  onClick={() => setTipoSelecionado(opcao.tipo)}
                  className={`text-left rounded-2xl border p-4 transition ${
                    ativo
                      ? "border-green-800 bg-green-50 ring-2 ring-green-700/20"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        ativo
                          ? "bg-green-800 text-white"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {opcao.icon}
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-green-700 font-bold">
                        {opcao.grupo}
                      </div>
                      <h3 className="font-extrabold text-green-950">
                        {opcao.titulo}
                      </h3>
                      <p className="text-sm text-green-900/70 mt-1">
                        {opcao.subtitulo}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {tipoSelecionado && (
          <section className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-bold text-green-950">
                Completar dados do novo perfil
              </h2>
              <p className="text-sm text-green-900/70">
                Vamos usar os dados já existentes da sua conta e pedir só o necessário.
              </p>
            </div>

            {!isOrganizacao && (
              <div>
                <label className="block text-sm font-semibold text-green-950 mb-1">
                  Nome
                </label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border px-3 py-3"
                  placeholder="Seu nome"
                />
              </div>
            )}

            {isAtleta && (
            <div className="grid md:grid-cols-3 gap-3">
                <div>
                <label className="block text-sm font-semibold text-green-950 mb-1">
                    Data de nascimento
                </label>
                <input
                    type="date"
                    min="1900-01-01"
                    max={hojeInput}
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3"
                />
                {dataNascimento && calcularIdade(dataNascimento) !== null && (
                    <p className="mt-1 text-xs text-green-800">
                    Idade calculada: {calcularIdade(dataNascimento)} anos
                    </p>
                )}
                </div>

                <div>
                <label className="block text-sm font-semibold text-green-950 mb-1">
                    Categoria <LabelOpcional />
                </label>
                <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3"
                >
                    <option value="">Selecione</option>
                    <option value="Sub3">Sub3</option>
                    <option value="Sub5">Sub5</option>
                    <option value="Sub7">Sub7</option>
                    <option value="Sub9">Sub9</option>
                    <option value="Sub11">Sub11</option>
                    <option value="Sub13">Sub13</option>
                    <option value="Sub15">Sub15</option>
                    <option value="Sub16">Sub16</option>
                    <option value="Livre">Livre</option>
                </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Posição <LabelOpcional />
                    </label>

                    <select
                        value={posicao}
                        onChange={(e) => setPosicao(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                    >
                        <option value="">Selecione</option>

                        {posicoesCampo.map((p) => (
                        <option key={p.value} value={p.value}>
                            {p.label}
                        </option>
                        ))}
                    </select>
                </div>
            </div>
            )}

            {isProfessor && (
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Data de nascimento
                    </label>
                    <input
                        type="date"
                        min="1900-01-01"
                        max={hojeInput}
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                    />
                    {dataNascimento && calcularIdade(dataNascimento) !== null && (
                        <p className="mt-1 text-xs text-green-800">
                        Idade calculada: {calcularIdade(dataNascimento)} anos
                        </p>
                    )}
                    </div>

                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Área de formação <LabelOpcional />
                    </label>
                    <input
                        value={areaFormacao}
                        onChange={(e) => setAreaFormacao(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                        placeholder="Ex.: Educação Física"
                    />
                    </div>

                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        CREF <LabelOpcional />
                    </label>
                    <input
                        value={cref}
                        onChange={(e) => setCref(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                        placeholder="Ex.: 123456-G/SP"
                    />
                    </div>

                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Status CREF <LabelOpcional />
                    </label>
                    <select
                        value={statusCref}
                        onChange={(e) => setStatusCref(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                    >
                        <option value="">Selecione</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Desativo">Desativo</option>
                    </select>
                    </div>
                </div>
            )}

            {isOlheiro && (
                <div className="grid md:grid-cols-2 gap-3">
                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Data de nascimento
                    </label>
                    <input
                        type="date"
                        min="1900-01-01"
                        max={hojeInput}
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                    />
                    {dataNascimento && calcularIdade(dataNascimento) !== null && (
                        <p className="mt-1 text-xs text-green-800">
                        Idade calculada: {calcularIdade(dataNascimento)} anos
                        </p>
                    )}
                    </div>

                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Área de atuação <LabelOpcional />
                    </label>
                    <input
                        value={areaAtuacao}
                        onChange={(e) => setAreaAtuacao(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                        placeholder="Ex.: Sudeste"
                    />
                    </div>

                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Anos de experiência <LabelOpcional />
                    </label>
                    <input
                        type="number"
                        value={anosExperiencia}
                        onChange={(e) => setAnosExperiencia(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                        placeholder="Ex.: 5"
                    />
                    </div>

                    <div>
                    <label className="block text-sm font-semibold text-green-950 mb-1">
                        Headline <LabelOpcional />
                    </label>
                    <input
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        className="w-full rounded-xl border px-3 py-3"
                        placeholder="Ex.: Scout regional"
                    />
                    </div>
                </div>
            )}

            {isOrganizacao && (
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-green-950 mb-1">
                    Nome da organização 
                  </label>
                  <input
                    value={nomeOrganizacao}
                    onChange={(e) => setNomeOrganizacao(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3"
                    placeholder="Ex.: Federação Paulista"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-950 mb-1">
                    CNPJ <LabelOpcional />
                  </label>
                  <input
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3"
                    placeholder="Ex.: 12.345.678/0001-90"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-950 mb-1">
                    Cidade <LabelOpcional />
                  </label>
                  <input
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3"
                    placeholder="Ex.: São Paulo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-green-950 mb-1">
                    Estado <LabelOpcional />
                  </label>
                  <input
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full rounded-xl border px-3 py-3"
                    placeholder="Ex.: SP"
                  />
                </div>
              </div>
            )}

            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {erro}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => history.back()}
                className="rounded-xl border px-4 py-3 font-bold text-green-900"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={salvar}
                className="rounded-xl bg-green-700 px-5 py-3 text-white font-bold disabled:opacity-60"
              >
                {loading ? "Salvando..." : "Confirmar mudança"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}