import { useState } from "react";
import { useLocation } from "wouter";
import { API } from "../config.js";
import {
  applyActiveContextSession,
} from "../utils/authSession.js";

type Papel =
  | "Atleta"
  | "Professor"
  | "Olheiro"
  | "Learning"
  | "Responsavel"
  | "Creator"
  | "Clube"
  | "Escolinha"
  | "Marca"
  | "Federacao";

const PAPEIS: Array<{
  valor: Papel;
  nome: string;
  disponivel: boolean;
}> = [
  { valor: "Atleta", nome: "Atleta", disponivel: true },
  { valor: "Professor", nome: "Professor", disponivel: true },
  { valor: "Olheiro", nome: "Olheiro", disponivel: true },
  { valor: "Learning", nome: "Learning", disponivel: true },
  { valor: "Responsavel", nome: "Responsável", disponivel: true },
  { valor: "Creator", nome: "Creator pessoal", disponivel: true },
  { valor: "Clube", nome: "Clube", disponivel: true },
  { valor: "Escolinha", nome: "Escolinha", disponivel: true },
  { valor: "Marca", nome: "Marca", disponivel: true },
  { valor: "Federacao", nome: "Federação", disponivel: true },
];

const PAPEIS_ORGANIZACIONAIS: Papel[] = [
  "Clube",
  "Escolinha",
  "Marca",
  "Federacao",
];

function ehOrganizacao(papel: Papel) {
  return PAPEIS_ORGANIZACIONAIS.includes(papel);
}

export default function RecuperarPerfil() {
  const [, navegar] = useLocation();

  const [papel, setPapel] = useState<Papel>("Professor");
  const [etapa, setEtapa] = useState<"ESCOLHER" | "PREENCHER">("ESCOLHER");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aguardandoResponsavel, setAguardandoResponsavel] =
    useState(false);
  const [responsavelUsuarioId, setResponsavelUsuarioId] =
    useState("");
  const [solicitacaoEnviada, setSolicitacaoEnviada] =
    useState(false);
  const [perfilAtletaPreparado, setPerfilAtletaPreparado] =
    useState(false);
  const [dadosCreator, setDadosCreator] = useState({
    nomePublico: "",
    headline: "",
    bio: "",
    nicho: "",
    });
  const [dadosOrganizacao, setDadosOrganizacao] = useState({
    nome: "",
    cnpj: "",
    email: "",
    telefone1: "",
    siteOficial: "",
    cidade: "",
    estado: "",
    });

  const [perfilCreatorPreparado, setPerfilCreatorPreparado] =
    useState(false);

  function aplicarEstadoAtleta(estado: {
    perfilExiste?: boolean;
    solicitacaoPendente?: boolean;
    requerResponsavel?: boolean;
    responsavelConfirmado?: boolean;
    }) {
    const perfilExiste = estado.perfilExiste === true;

    setPerfilAtletaPreparado(perfilExiste);

    setSolicitacaoEnviada(
        estado.solicitacaoPendente === true
    );

    setAguardandoResponsavel(
        perfilExiste &&
        estado.requerResponsavel === true &&
        estado.responsavelConfirmado !== true
    );
    }

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  async function requisitar(
    caminho: string,
    method: "GET" | "POST" | "PATCH",
    body?: unknown
  ) {
    const resposta = await fetch(
    `${API.BASE_URL}/api${caminho}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });

    const json = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        json.message ||
        json.error ||
        `Erro ${resposta.status}`
      );
    }

    return json;
  }

  async function escolherPapel() {
    setErro(null);
    setCarregando(true);

    try {
      if (ehOrganizacao(papel)) {
        setEtapa("PREENCHER");
        return;
        }
      const resultadoPapel = await requisitar(
        "/usuarios/me/papeis",
        "POST",
        {
            papel,
            reativar: false,
        }
        );

        setPerfilCreatorPreparado(
        papel === "Creator" &&
        resultadoPapel?.perfilExiste === true
        );

        if (papel === "Atleta") {
            const estado = await requisitar(
                "/usuarios/me/papeis/Atleta/recuperacao",
                "GET"
            );

            aplicarEstadoAtleta(estado);
            } else {
            setPerfilAtletaPreparado(false);
            setSolicitacaoEnviada(false);
            setAguardandoResponsavel(false);
            setResponsavelUsuarioId("");
            }

        setEtapa("PREENCHER");
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function solicitarResponsavel() {
    setErro(null);
    setCarregando(true);

    try {
        const resultado = await requisitar(
        "/usuarios/me/papeis/Atleta/recuperacao/responsavel",
        "POST",
        {
            responsavelUsuarioId: responsavelUsuarioId.trim(),
        }
        );

        setSolicitacaoEnviada(
        resultado?.solicitacaoPendente === true
        );

        setAguardandoResponsavel(true);
    } catch (error: any) {
        setErro(error.message);
    } finally {
        setCarregando(false);
    }
    }

  async function verificarSituacaoAtleta() {
    setErro(null);
    setCarregando(true);

    try {
        const estado = await requisitar(
        "/usuarios/me/papeis/Atleta/recuperacao",
        "GET"
        );

        aplicarEstadoAtleta(estado);
        return estado;

    } catch (error: any) {
        setErro(error.message);
        return null;
    } finally {
        setCarregando(false);
    }
    }

  async function salvarEAtivar() {
    setErro(null);
    setCarregando(true);
    let operacaoConfirmada = false;

    try {
      if (ehOrganizacao(papel)) {
        if (dadosOrganizacao.nome.trim().length < 3) {
            throw new Error(
            "Informe o nome da organização com pelo menos 3 caracteres."
            );
        }

        const resultado = await requisitar(
            "/usuarios/me/organizacao-recuperacao",
            "POST",
            {
            tipo: papel,
            perfil: dadosOrganizacao,
            }
        );

        if (
        resultado?.activeContext?.kind !== "ORGANIZATION" ||
        resultado.activeContext.organizationId !==
            resultado.organizacaoId
        ) {
        throw new Error(
            "A organização foi criada, mas o contexto retornado " +
            "não corresponde à nova organização."
        );
        }

        applyActiveContextSession(resultado.activeContext);
        operacaoConfirmada = true;

        const sessao = await requisitar("/auth/me", "GET");

        if (
        sessao?.somenteGestaoConta === true ||
        sessao?.activeContext?.kind !== "ORGANIZATION" ||
        sessao.activeContext.organizationId !==
            resultado.organizacaoId
        ) {
        throw new Error(
            "A organização foi criada, mas a sessão ainda " +
            "não reconheceu o novo contexto. Atualize a sessão " +
            "antes de tentar criar outra organização."
        );
        }

        localStorage.setItem("somenteGestaoConta", "false");
        sessionStorage.setItem("somenteGestaoConta", "false");

        window.location.assign("/perfil");
        return;
        }
      if (papel !== "Responsavel") {
        if (
        (papel !== "Atleta" || !perfilAtletaPreparado) &&
        (papel !== "Creator" || !perfilCreatorPreparado)
        ) {
            const resultado = await requisitar(
            `/usuarios/me/papeis/${papel}/perfil-recuperacao`,
            "POST",
            {
                perfil:
                papel === "Creator"
                    ? dadosCreator
                    : {},
            }
            );

            if (papel === "Creator") {
            setPerfilCreatorPreparado(true);
            }

            if (papel === "Atleta") {
            setPerfilAtletaPreparado(true);

            if (resultado?.requerResponsavel === true) {
                setAguardandoResponsavel(true);
                return;
            }
            }
        }

        if (papel === "Atleta") {
            const estado = await requisitar(
            "/usuarios/me/papeis/Atleta/recuperacao",
            "GET"
            );

            if (estado.requerResponsavel && !estado.responsavelConfirmado) {
            setAguardandoResponsavel(true);
            return;
            }

            if (!estado.podeConcluir) {
            throw new Error(
                "O perfil Atleta ainda não está pronto para ativação."
            );
            }

            setAguardandoResponsavel(false);
        }
        }

      const conclusao = await requisitar(
        `/usuarios/me/papeis/${papel}/concluir`,
        "PATCH",
        {}
        );

        if (!conclusao?.activeContext) {
        throw new Error(
            "O perfil foi concluído, mas o servidor não retornou " +
            "o contexto ativo. Entre novamente na sua conta."
        );
        }

        applyActiveContextSession(conclusao.activeContext);
        operacaoConfirmada = true;

      const sessao = await requisitar("/auth/me", "GET");

      if (
        sessao?.somenteGestaoConta === true ||
        !sessao?.activeContext
      ) {
        throw new Error(
          "O perfil foi salvo, mas a sessão ainda não reconheceu " +
          "o novo contexto. Faça login novamente."
        );
      }

      localStorage.setItem("somenteGestaoConta", "false");
      sessionStorage.setItem("somenteGestaoConta", "false");

      window.location.assign("/perfil");
    } catch (error: any) {
        if (operacaoConfirmada) {
            try {
            const sessao = await requisitar("/auth/me", "GET");

            if (
                sessao?.somenteGestaoConta === false &&
                sessao?.activeContext
            ) {
                applyActiveContextSession(sessao.activeContext);

                localStorage.setItem("somenteGestaoConta", "false");
                sessionStorage.setItem("somenteGestaoConta", "false");

                window.location.assign("/perfil");
                return;
            }
            } catch {
            }
        }

        setErro(
            error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação."
        );
        } finally {
        setCarregando(false);
        }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-5 rounded-2xl bg-white p-5 shadow">
        <h1 className="text-xl font-bold text-green-900">
          Ativar outro perfil
        </h1>

        <p className="text-sm text-gray-600">
          Continue utilizando sua conta FootEra com um novo perfil pessoal ou uma nova organização. Organizações transferidas anteriormente permanecem com seus atuais proprietários.
        </p>

        {erro && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {aguardandoResponsavel && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-900">
                Confirmação do responsável necessária
                </h3>

                <p className="mt-2 text-sm text-amber-800">
                Seu perfil Atleta foi preparado e continuará
                pendente até que um responsável legal seja
                confirmado.
                </p>

                <p className="mt-2 text-sm text-amber-800">
                Você poderá concluir a ativação após a
                confirmação. Nenhuma organização foi vinculada
                automaticamente.
                </p>
                <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold text-amber-900">
                    ID do responsável no FootEra
                </label>

                <input
                    type="text"
                    value={responsavelUsuarioId}
                    onChange={event =>
                    setResponsavelUsuarioId(event.target.value)
                    }
                    placeholder="Informe o ID do responsável"
                    disabled={carregando || solicitacaoEnviada}
                    className="w-full rounded-lg border border-amber-300 p-3 text-sm"
                />

                {solicitacaoEnviada ? (
                    <p className="text-sm text-amber-800">
                    Solicitação enviada. O responsável deverá
                    acessar a própria conta para aceitar.
                    </p>
                ) : (
                    <button
                    type="button"
                    disabled={carregando || !responsavelUsuarioId.trim()}
                    onClick={() => void solicitarResponsavel()}
                    className="w-full rounded-lg bg-amber-800 p-3 font-semibold text-white disabled:opacity-50"
                    >
                    Solicitar confirmação
                    </button>
                )}

                <button
                    type="button"
                    disabled={carregando}
                    onClick={() => void verificarSituacaoAtleta()}
                    className="w-full rounded-lg border border-amber-300 p-3 text-sm"
                >
                    Verificar confirmação
                </button>
                </div>
            </div>
        )}

        {etapa === "ESCOLHER" ? (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="font-semibold">
                Escolha o novo perfil
              </span>

              <select
                value={papel}
                onChange={event => {
                    setPapel(event.target.value as Papel);
                    setAguardandoResponsavel(false);
                    setErro(null);
                    setEtapa("ESCOLHER");
                }}
                className="w-full rounded-lg border border-gray-300 p-3"
              >
                {PAPEIS.map(opcao => (
                <option
                    key={opcao.valor}
                    value={opcao.valor}
                    disabled={!opcao.disponivel}
                >
                    {opcao.nome}
                    {!opcao.disponivel ? " — Em implementação" : ""}
                </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={carregando || !token}
              onClick={escolherPapel}
              className="w-full rounded-lg bg-green-800 p-3 font-semibold text-white disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              void salvarEAtivar();
            }}
          >
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <h3 className="font-semibold text-green-900">
                Seu novo perfil está pronto para ser criado
            </h3>

            <p className="mt-2 text-sm text-gray-700">
                Você continuará utilizando o mesmo login e os dados
                da sua conta FootEra.
            </p>

            <p className="mt-2 text-sm text-gray-600">
                {papel === "Atleta"
                    ? "Vamos usar sua data de nascimento para calcular a categoria automaticamente. Nenhum clube ou escolinha será vinculado sem autorização."
                    : papel === "Professor"
                        ? "Informações profissionais poderão ser preenchidas depois."
                        : papel === "Olheiro"
                        ? "Experiência e área de atuação poderão ser preenchidas depois."
                        : papel === "Responsavel"
                            ? "Seu perfil será ativado sem atletas vinculados."
                            : "Você poderá completar os dados de Learning depois."}
            </p>
            </div>

            {ehOrganizacao(papel) && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-green-900">
                    Criar nova organização
                    </h3>

                    <p className="text-sm text-gray-600">
                    A nova organização será independente de
                    organizações transferidas anteriormente.
                    </p>

                    {([
                    ["nome", "Nome da organização", "Ex.: Escola Futuro FC", true],
                    ["cnpj", "CNPJ", "Ex.: 12.345.678/0001-90", false],
                    ["email", "E-mail institucional", "Ex.: contato@exemplo.com.br", false],
                    ["telefone1", "Telefone", "Ex.: (27) 99999-9999", false],
                    ["siteOficial", "Site oficial", "Ex.: https://exemplo.com.br", false],
                    ["cidade", "Cidade", "Ex.: Vitória", false],
                    ["estado", "Estado", "Ex.: ES", false],
                    ] as const).map(([campo, titulo, exemplo, obrigatorio]) => (
                    <label key={campo} className="block space-y-1">
                        <span className="text-sm font-medium">
                        {titulo} {obrigatorio ? "(obrigatório)" : "(opcional)"}
                        </span>

                        <input
                        type={campo === "email" ? "email" : "text"}
                        required={obrigatorio}
                        value={dadosOrganizacao[campo]}
                        placeholder={exemplo}
                        onChange={(event) =>
                            setDadosOrganizacao((anterior) => ({
                            ...anterior,
                            [campo]: event.target.value,
                            }))
                        }
                        className="w-full rounded-lg border p-3"
                        />
                    </label>
                    ))}
                </div>
                )}

            {papel === "Creator" && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-green-900">
                    Configurar Creator pessoal
                    </h3>

                    <p className="text-sm text-gray-600">
                    Os campos abaixo são opcionais.
                    Você poderá editá-los posteriormente.
                    </p>

                    <label className="block space-y-1">
                    <span className="text-sm font-medium">
                        Nome público (opcional)
                    </span>
                    <input
                        type="text"
                        maxLength={120}
                        placeholder="Ex.: Futebol com Pedro"
                        value={dadosCreator.nomePublico}
                        onChange={(e) =>
                        setDadosCreator((anterior) => ({
                            ...anterior,
                            nomePublico: e.target.value,
                        }))
                        }
                        className="w-full rounded-lg border p-3"
                    />
                    </label>

                    <label className="block space-y-1">
                    <span className="text-sm font-medium">
                        Título ou especialidade (opcional)
                    </span>
                    <input
                        type="text"
                        maxLength={160}
                        placeholder="Ex.: Criador de conteúdo esportivo"
                        value={dadosCreator.headline}
                        onChange={(e) =>
                        setDadosCreator((anterior) => ({
                            ...anterior,
                            headline: e.target.value,
                        }))
                        }
                        className="w-full rounded-lg border p-3"
                    />
                    </label>

                    <label className="block space-y-1">
                    <span className="text-sm font-medium">
                        Nicho de atuação (opcional)
                    </span>
                    <input
                        type="text"
                        maxLength={120}
                        placeholder="Ex.: Futebol de base"
                        value={dadosCreator.nicho}
                        onChange={(e) =>
                        setDadosCreator((anterior) => ({
                            ...anterior,
                            nicho: e.target.value,
                        }))
                        }
                        className="w-full rounded-lg border p-3"
                    />
                    </label>

                    <label className="block space-y-1">
                    <span className="text-sm font-medium">
                        Biografia (opcional)
                    </span>
                    <textarea
                        rows={4}
                        maxLength={2000}
                        placeholder="Ex.: Compartilho treinos e dicas para atletas."
                        value={dadosCreator.bio}
                        onChange={(e) =>
                        setDadosCreator((anterior) => ({
                            ...anterior,
                            bio: e.target.value,
                        }))
                        }
                        className="w-full rounded-lg border p-3"
                    />
                    </label>
                </div>
                )}

            <button
              type="submit"
              disabled={carregando || !token || aguardandoResponsavel}
              className="w-full rounded-lg bg-green-800 p-3 font-semibold text-white disabled:opacity-50"
            >
              {carregando
                ? "Ativando..."
                : papel === "Learning"
                    ? "Confirmar e ativar Learning"
                    : "Criar e ativar perfil"}
            </button>

            <button
              type="button"
              disabled={carregando}
              onClick={() => {
                setAguardandoResponsavel(false);
                setErro(null);
                setEtapa("ESCOLHER");
                }}
              className="w-full rounded-lg border p-3"
            >
              Voltar
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navegar("/configuracoes")}
          className="text-sm text-gray-600 underline"
        >
          Manter minha conta sem perfil ativo
        </button>
      </div>
    </main>
  );
}