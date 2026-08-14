// client/src/pages/editarPerfil
import { toast } from "@/lib/toast";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import BottomNav from "@/components/layout/BottomNav.js";

type ResultadoBuscaClube = {
  id: string;
  nome: string;
  username?: string;

  fotoUrl?: string | null;
};
type OptionMin = { id: string; nome: string };

type PosicaoCampo =
  | "GOL"
  | "LD"
  | "ZD"
  | "ZE"
  | "LE"
  | "VOL1"
  | "VOL2"
  | "MEI"
  | "PD"
  | "CA"
  | "PE";

function nullIfEmpty<T>(v: T) {
  // @ts-ignore
  return v === "" ? null : v;
}

const POSICOES: Array<{ value: PosicaoCampo; label: string }> = [
  { value: "GOL", label: "Goleiro (GOL)" },
  { value: "LD", label: "Lateral Direito (LD)" },
  { value: "ZD", label: "Zagueiro Direito (ZD)" },
  { value: "ZE", label: "Zagueiro Esquerdo (ZE)" },
  { value: "LE", label: "Lateral Esquerdo (LE)" },
  { value: "VOL1", label: "Volante 1 (VOL1)" },
  { value: "VOL2", label: "Volante 2 (VOL2)" },
  { value: "MEI", label: "Meia (MEI)" },
  { value: "PD", label: "Ponta Direita (PD)" },
  { value: "CA", label: "Centroavante (CA)" },
  { value: "PE", label: "Ponta Esquerda (PE)" },
];

const EditarPerfil = () => {
  const usuarioId = Storage.usuarioId;
  const tipoUsuarioOriginal = Storage.tipoSalvo;
  const token = Storage.token;

  const [dadosUsuario, setDadosUsuario] = useState<any>(null);
  const [dadosTipo, setDadosTipo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  type TipoRender =
    | "atleta"
    | "professor"
    | "escola"
    | "escolinha"
    | "clube"
    | "admin"
    | "olheiro"
    | "federacao"
    | "marca"
    | "learning"
    ;
  const [tipoRender, setTipoRender] = useState<TipoRender | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [clubeQuery, setClubeQuery] = useState("");
  const [clubes, setClubes] = useState<ResultadoBuscaClube[]>([]);
  const [clubeSel, setClubeSel] = useState<ResultadoBuscaClube | null>(null);
  type ColaboracaoAtualOlheiro = {
    tipo:
      | "CLUBE"
      | "ESCOLINHA";
    id: string;
    usuarioId?: string | null;
    nome: string;
    logo?: string | null;
  };

  type SolicitacaoColaboracaoPendente = {
    id: string;
    tipo:
      | "CLUBE"
      | "ESCOLINHA";
    destinoId: string;
    nome: string;
    logo?: string | null;
    criadaEm?: string | null;
  };

  type ResultadoBuscaEscolinhaColab = {
    id: string;
    nome: string;
    username?: string;
    fotoUrl?: string | null;
  };

  const [
    colaboracaoAtual,
    setColaboracaoAtual,
  ] =
    useState<ColaboracaoAtualOlheiro | null>(
      null
    );

  const [
    solicitacaoColabPendente,
    setSolicitacaoColabPendente,
  ] =
    useState<SolicitacaoColaboracaoPendente | null>(
      null
    );

  const [
    escolinhaColabQuery,
    setEscolinhaColabQuery,
  ] = useState("");

  const [
    escolinhasColab,
    setEscolinhasColab,
  ] =
    useState<
      ResultadoBuscaEscolinhaColab[]
    >([]);

  const [
    escolinhaColabSel,
    setEscolinhaColabSel,
  ] =
    useState<ResultadoBuscaEscolinhaColab | null>(
      null
    );
  const [listaClubes, setListaClubes] = useState<OptionMin[]>([]);
  const [listaEscolinhas, setListaEscolinhas] = useState<OptionMin[]>([]);
  const [listaProfessores, setListaProfessores] = useState<OptionMin[]>([]);
  const [clubeSelId, setClubeSelId] = useState<string | null>(null);
  const [escolinhaSelId, setEscolinhaSelId] = useState<string | null>(null);
  const [professorSelIds, setProfessorSelIds] = useState<string[]>([]);
  const [buscaClubeVinculo, setBuscaClubeVinculo] = useState("");
  const [buscaEscolinhaVinculo, setBuscaEscolinhaVinculo] = useState("");
  const [buscaProfessorVinculo, setBuscaProfessorVinculo] = useState("");
  
  function onlyDigits(v: string) {
    return (v || "").replace(/\D/g, "");
  }

  function onlyCnpj(v: string) {
    return (v || "").replace(/\D/g, "").slice(0, 14);
  }

  function formatCnpj(v: string) {
    const digits = onlyCnpj(v);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  useEffect(() => {
    if (!usuarioId || !token) {
      console.error("[EditarPerfil] Sem usuarioId ou token — verifique login.");
      setErro("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const fetchDados = async () => {
      try {
        const res = await axios.get(`${API.BASE_URL}/api/perfil/${usuarioId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res?.data?.usuario) {
          setErro("Perfil não encontrado ou resposta inválida do servidor.");
          return;
        }

        const u = res.data.usuario || {};
        const tipoSrv = res.data?.tipo ?? res.data?.tipoUsuario ?? tipoUsuarioOriginal ?? "";
        const tipoNorm = String(tipoSrv || "").toLowerCase();

        const dadosEsp: any = {
          ...(res.data.dadosEspecificos || {}),
        };

        if (!dadosEsp.id && res.data?.tipoUsuarioId) {
          dadosEsp.id = res.data.tipoUsuarioId;
        }

        if (tipoNorm === "learning" && !dadosEsp.id && res.data?.learningProfileId) {
          dadosEsp.id = res.data.learningProfileId;
        }

        if (tipoNorm === "marca" && !dadosEsp.id && res.data?.marcaId) {
          dadosEsp.id = res.data.marcaId;
        }

        if (tipoNorm === "federacao" && !dadosEsp.id && res.data?.federacaoId) {
          dadosEsp.id = res.data.federacaoId;
        }

        if (!Array.isArray(dadosEsp.categorias)) {
          dadosEsp.categorias = dadosEsp.categorias ? [dadosEsp.categorias] : [];
        }

        if (dadosEsp.site && !dadosEsp.siteOficial) {
          dadosEsp.siteOficial = dadosEsp.site;
        }

        const nomeDeUsuario =
          u.nomeDeUsuario ??
          u.username ??
          u.nome_usuario ??
          u.nomeDeUsuarioAtual ??
          "";

        setDadosUsuario({
          ...u,
          nomeDeUsuario: String(nomeDeUsuario || ""),
          cep: u.cep ?? dadosEsp.cep ?? "",
          cidade: u.cidade ?? dadosEsp.cidade ?? "",
          estado: u.estado ?? dadosEsp.estado ?? "",
          pais: u.pais ?? dadosEsp.pais ?? "",
          logradouro: u.logradouro ?? dadosEsp.logradouro ?? "",
          cpf: u.cpf ?? dadosEsp.cpf ?? "",
        });

        setDadosTipo(dadosEsp);

        const vinculos = res.data.vinculos || res.data.vinculo || {};

        const professoresIdsFromApi: string[] =
          (Array.isArray(vinculos?.professoresIds) ? vinculos.professoresIds : []) ||
          (Array.isArray(vinculos?.professorIds) ? vinculos.professorIds : []) ||
          [];

        const professoresFromObj: string[] =
          (Array.isArray(vinculos?.professores) ? vinculos.professores : [])
            .map((p: any) => String(p?.id || ""))
            .filter(Boolean) || [];

        const professorUnicoId =
          dadosEsp.professorId ??
          vinculos.professorId ??
          vinculos.professor?.id ??
          vinculos.professorAtual?.id ??
          null;

        const idsFinal = [
          ...professoresIdsFromApi.map(String),
          ...professoresFromObj,
          ...(professorUnicoId ? [String(professorUnicoId)] : []),
        ].filter(Boolean);

        const uniq = Array.from(new Set(idsFinal));

        setProfessorSelIds(uniq);

        if (uniq.length > 0) {
          dadosEsp.professorId = uniq[0];
        } else {
          dadosEsp.professorId = null;
        }

        const clubeVinculoId =
          dadosEsp.clubeId ??
          vinculos.clubeId ??
          vinculos.clube?.id ??
          vinculos.clubeAtual?.id ??
          null;

        const escolinhaVinculoId =
          dadosEsp.escolinhaId ??
          vinculos.escolinhaId ??
          vinculos.escolinha?.id ??
          vinculos.escola?.id ??
          null;

        if (clubeVinculoId) {
          dadosEsp.clubeId = clubeVinculoId;
          setClubeSelId(String(clubeVinculoId));
        }

        if (escolinhaVinculoId) {
          dadosEsp.escolinhaId = escolinhaVinculoId;
          setEscolinhaSelId(String(escolinhaVinculoId));
        }

        setDadosTipo(dadosEsp);

        const t = String(tipoSrv).toLowerCase();
        setTipoRender((t === "escolinha" ? "escola" : (t as TipoRender)));
        if (
          tipoNorm === "olheiro"
        ) {
          const olheiroId =
            String(
              dadosEsp.id ||
                Storage.tipoUsuarioId ||
                ""
            ).trim();

          if (olheiroId) {
            const colabResp =
              await axios.get(
                `${API.BASE_URL}/api/olheiros/${encodeURIComponent(
                  olheiroId
                )}/colaboracao`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              );

            setColaboracaoAtual(
              colabResp.data?.atual ??
                null
            );

            setSolicitacaoColabPendente(
              colabResp.data?.pendente ??
                null
            );
          }
        }
      } catch (err: any) {
        console.error("[EditarPerfil] Erro ao buscar dados", {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        });
        if (err?.response?.status === 401) {
          setErro("Não autorizado. Faça login novamente.");
        } else {
          setErro("Erro ao buscar dados do perfil.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDados();
  }, [usuarioId, token]);

  useEffect(() => {
    const cepDigits = onlyDigits(String(dadosUsuario?.cep ?? ""));

    if (cepDigits.length !== 8) return;

    let cancel = false;

    const timer = window.setTimeout(async () => {
      try {
        const { data } = await axios.get(
          `https://viacep.com.br/ws/${cepDigits}/json/`
        );

        if (cancel) return;

        if (!data || data.erro) {
          console.warn("[EditarPerfil] CEP não encontrado:", cepDigits);
          return;
        }

        setDadosUsuario((prev: any) => ({
          ...prev,
          cep: cepDigits,
          logradouro: data.logradouro || "",
          bairro: data.bairro || prev?.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
          pais: "Brasil",
        }));
      } catch (e) {
        console.warn("[EditarPerfil] ViaCEP falhou", e);
      }
    }, 350);

    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [dadosUsuario?.cep]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const q = clubeQuery.trim();
      if (q.length < 2) {
        setClubes([]);
        return;
      }
      try {
        const r = await axios.get<any[]>(
          `${API.BASE_URL}/api/cadastro/buscar`,
          { params: { query: q, tipo: "Clube" }, headers }
        );
        if (cancelado) return;
        const arr: ResultadoBuscaClube[] = (Array.isArray(r.data) ? r.data : [])
          .filter((x) => x?.id && x?.nome && x?.tipo === "Clube")
          .map((x) => ({
            id: String(x.id),
            nome: String(x.nome),
            username: String(x.username || ""),
            fotoUrl: x.fotoUrl ?? null,
          }));
        setClubes(arr);
      } catch {
        if (!cancelado) setClubes([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [clubeQuery, API?.BASE_URL, token]);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const q =
        escolinhaColabQuery.trim();

      if (q.length < 2) {
        setEscolinhasColab([]);
        return;
      }

      try {
        const r =
          await axios.get<any[]>(
            `${API.BASE_URL}/api/cadastro/buscar`,
            {
              params: {
                query: q,
                tipo:
                  "Escolinha",
              },
              headers,
            }
          );

        if (cancelado) return;

        const arr =
          (
            Array.isArray(r.data)
              ? r.data
              : []
          )
            .filter(
              (x) =>
                x?.id &&
                x?.nome &&
                x?.tipo ===
                  "Escolinha"
            )
            .map((x) => ({
              id:
                String(x.id),

              nome:
                String(x.nome),

              username:
                String(
                  x.username ||
                    ""
                ),

              fotoUrl:
                x.fotoUrl ??
                null,
            }));

        setEscolinhasColab(
          arr
        );
      } catch {
        if (!cancelado) {
          setEscolinhasColab(
            []
          );
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [
    escolinhaColabQuery,
    token,
  ]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resultados = await Promise.allSettled([
          axios.get<OptionMin[]>(`${API.BASE_URL}/api/catalogo/clubes`, {
            headers,
          }),
          axios.get<OptionMin[]>(`${API.BASE_URL}/api/catalogo/escolinhas`, {
            headers,
          }),
          axios.get<OptionMin[]>(`${API.BASE_URL}/api/catalogo/professores`, {
            headers,
          }),
        ]);
        if (cancel) return;

        const [clubesRes, escolasRes, profsRes] = resultados;

        if (clubesRes.status === "fulfilled") {
          setListaClubes(clubesRes.value.data || []);
        }
        if (escolasRes.status === "fulfilled") {
          setListaEscolinhas(escolasRes.value.data || []);
        }
        if (profsRes.status === "fulfilled") {
          setListaProfessores(profsRes.value.data || []);
        }
      } catch (e) {
        if (!cancel) {
          console.error("[EditarPerfil] erro geral catálogo:", e);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [API?.BASE_URL, token]);

  if (loading) {
    return (
      <div className="text-center text-gray-600 mt-10">
        Carregando perfil...
      </div>
    );
  }
  if (erro) {
    return <div className="text-center text-red-600 mt-10">{erro}</div>;
  }
  if (!dadosUsuario) {
    return (
      <div className="text-center text-red-600 mt-10">
        Erro ao carregar o perfil.
      </div>
    );
  }
  const dadosTipoSeguro = dadosTipo || {};
  const isAtleta = tipoRender === "atleta";
  const isOlheiro = tipoRender === "olheiro";
  const isProfessor = tipoRender === "professor";
  const isClube = tipoRender === "clube";
  const isEscolinha = tipoRender === "escola" || tipoRender === "escolinha";
  const isFederacao = tipoRender === "federacao";
  const isMarca = tipoRender === "marca";
  const isLearning = tipoRender === "learning";
  const isOrganizacaoInstitucional = isClube || isEscolinha || isFederacao || isMarca;

  const mostrarCepUsuario = true;
  const clubesFiltrados = listaClubes.filter((op) =>
    op.nome.toLowerCase().includes(buscaClubeVinculo.toLowerCase())
  );

  const escolinhasFiltradas = listaEscolinhas.filter((op) =>
    op.nome.toLowerCase().includes(buscaEscolinhaVinculo.toLowerCase())
  );

  const professoresFiltrados = listaProfessores.filter((op) =>
    op.nome.toLowerCase().includes(buscaProfessorVinculo.toLowerCase())
  );

  const clubeSelecionado = listaClubes.find((op) => op.id === clubeSelId) || null;
  const escolinhaSelecionada = listaEscolinhas.find((op) => op.id === escolinhaSelId) || null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (name.startsWith("tipo_")) {
      setDadosTipo({ ...dadosTipo, [name.replace("tipo_", "")]: value });
    } else {
      setDadosUsuario({ ...dadosUsuario, [name]: value });
    }
  };

  const olheiroIdAtual =
    String(
      dadosTipoSeguro?.id ||
        Storage.tipoUsuarioId ||
        ""
    ).trim();

  const removerColaboracaoAtual =
    async () => {
      if (!olheiroIdAtual) {
        return;
      }

      const confirmar =
        window.confirm(
          "Deseja realmente encerrar esta colaboração?"
        );

      if (!confirmar) {
        return;
      }

      try {
        await axios.delete(
          `${API.BASE_URL}/api/olheiros/${encodeURIComponent(
            olheiroIdAtual
          )}/colaboracao`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        setColaboracaoAtual(
          null
        );

        toast.success(
          "Colaboração encerrada."
        );
      } catch (e: any) {
        toast.error(
          e?.response?.data
            ?.error ||
            "Não foi possível remover a colaboração."
        );
      }
    };


  const cancelarSolicitacaoColab =
    async () => {
      if (
        !olheiroIdAtual ||
        !solicitacaoColabPendente
      ) {
        return;
      }

      try {
        await axios.delete(
          `${API.BASE_URL}/api/olheiros/${encodeURIComponent(
            olheiroIdAtual
          )}/colaboracao/solicitacoes/${encodeURIComponent(
            solicitacaoColabPendente.id
          )}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        setSolicitacaoColabPendente(
          null
        );

        toast.success(
          "Solicitação cancelada."
        );
      } catch (e: any) {
        toast.error(
          e?.response?.data
            ?.error ||
            "Não foi possível cancelar a solicitação."
        );
      }
    };
    
  const renderCamposEspecificos = () => {
    if (!dadosTipo) return null;

    const renderSelect = (
      label: string,
      name: string,
      options: Array<{ value: string; label: string }>
    ) => {
      const value = dadosTipo[name] ?? "";
      return (
        <div className="mb-4" key={name}>
          <label className="block text-sm font-medium">{label}</label>
          <select
            name={`tipo_${name}`}
            value={value}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded bg-white"
          >
            <option value="">Selecione...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    };

    const renderInput = (
      label: string,
      name: string,
      type: string = "text"
    ) => {
      const raw = dadosTipo[name];

      const isLista =
        name === "categorias" ||
        name === "qualificacoes" ||
        name === "certificacoes";

      const value =
        isLista
          ? Array.isArray(raw)
            ? raw.join(", ")
            : raw ?? ""
          : name === "cnpj"
          ? formatCnpj(String(raw ?? ""))
          : raw ?? "";

      return (
        <div className="mb-4" key={name}>
          <label className="block text-sm font-medium">{label}</label>
          <input
            type={type}
            name={`tipo_${name}`}
            value={value}
            onChange={(e) => {
              if (name === "cnpj") {
                const digits = onlyCnpj(e.target.value);
                setDadosTipo({ ...dadosTipo, [name]: digits });
                return;
              }

              handleChange(e);
            }}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
      );
    };

    if (isLearning) {
      return (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium">Bio</label>
            <textarea
              name="tipo_bio"
              value={dadosTipo?.bio || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded min-h-[90px]"
              placeholder="Conte um pouco sobre você, seus interesses e seu momento na FootEra."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Objetivo</label>
            <input
              name="tipo_objetivo"
              value={dadosTipo?.objetivo || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder="Ex: aprender mais, evoluir como atleta, estudar metodologias..."
            />
          </div>
        </>
      );
    }

    if (isFederacao || isMarca) {
      return (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium">
              {isFederacao ? "Nome da Federação" : "Nome da Marca"}
            </label>
            <input
              name="tipo_nome"
              value={dadosTipo?.nome || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder={isFederacao ? "Ex: Federação Capixaba" : "Ex: Marca FootEra"}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">CNPJ</label>
            <input
              name="tipo_cnpj"
              value={formatCnpj(String(dadosTipo?.cnpj ?? ""))}
              onChange={(e) => {
                setDadosTipo({
                  ...dadosTipo,
                  cnpj: onlyCnpj(e.target.value),
                });
              }}
              className="w-full border px-3 py-2 rounded"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Telefone 1</label>
            <input
              name="tipo_telefone1"
              value={dadosTipo?.telefone1 || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder="Ex: (27) 99999-9999"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Telefone 2</label>
            <input
              name="tipo_telefone2"
              value={dadosTipo?.telefone2 || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder="Opcional"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">E-mail público</label>
            <input
              type="email"
              name="tipo_email"
              value={dadosTipo?.email || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder="contato@exemplo.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Site oficial</label>
            <input
              name="tipo_siteOficial"
              value={dadosTipo?.siteOficial || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder="https://..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Sede</label>
            <input
              name="tipo_sede"
              value={dadosTipo?.sede || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              placeholder={
                isFederacao
                  ? "Ex: Sede administrativa em Vitória - ES"
                  : "Ex: Unidade matriz em Vila Velha - ES"
              }
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium">Descrição</label>
            <textarea
              name="tipo_descricao"
              value={dadosTipo?.descricao || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded min-h-[110px]"
              placeholder={
                isFederacao
                  ? "Descreva a federação, atuação, região, modalidades e objetivos."
                  : "Descreva a marca, atuação, produtos, serviços ou conteúdos."
              }
            />
          </div>
        </>
      );
    }

    switch (tipoRender) {
      case "atleta":
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("Sobrenome", "sobrenome")}
            {renderInput("Idade", "idade", "number")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Nacionalidade", "nacionalidade")}
            {renderInput("Naturalidade", "naturalidade")}
            {renderSelect("Posição", "posicao", POSICOES)}
            {renderInput("Altura (cm)", "altura", "number")}
            {renderInput("Peso (kg)", "peso", "number")}
            {renderInput("Selo de Qualidade", "seloQualidade")}

            <div className="mb-4">
              <label className="block text-sm font-medium">Escolinha</label>

              {escolinhaSelecionada && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setEscolinhaSelId(null)}
                    className="text-xs rounded-full border px-2 py-1 bg-white hover:bg-gray-50"
                    title="Remover"
                  >
                    {escolinhaSelecionada.nome} <span className="ml-1 text-gray-500">×</span>
                  </button>
                </div>
              )}

              <input
                className="w-full border px-3 py-2 rounded mb-2"
                placeholder="Pesquisar escolinha pelo nome..."
                value={buscaEscolinhaVinculo}
                onChange={(e) => setBuscaEscolinhaVinculo(e.target.value)}
              />

              <div className="border rounded p-2 bg-white max-h-56 overflow-auto">
                {escolinhasFiltradas.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhuma escolinha encontrada.</div>
                ) : (
                  escolinhasFiltradas.map((op) => {
                    const checked = escolinhaSelId === op.id;

                    return (
                      <label
                        key={op.id}
                        className="flex items-center gap-2 py-1 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="escolinhaVinculo"
                          checked={checked}
                          onChange={() => setEscolinhaSelId(op.id)}
                        />
                        <span className="text-sm">{op.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-gray-500 mt-1">
                Você pode selecionar apenas uma escolinha.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium">Clube</label>

              {clubeSelecionado && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setClubeSelId(null)}
                    className="text-xs rounded-full border px-2 py-1 bg-white hover:bg-gray-50"
                    title="Remover"
                  >
                    {clubeSelecionado.nome} <span className="ml-1 text-gray-500">×</span>
                  </button>
                </div>
              )}

              <input
                className="w-full border px-3 py-2 rounded mb-2"
                placeholder="Pesquisar clube pelo nome..."
                value={buscaClubeVinculo}
                onChange={(e) => setBuscaClubeVinculo(e.target.value)}
              />

              <div className="border rounded p-2 bg-white max-h-56 overflow-auto">
                {clubesFiltrados.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhum clube encontrado.</div>
                ) : (
                  clubesFiltrados.map((op) => {
                    const checked = clubeSelId === op.id;

                    return (
                      <label
                        key={op.id}
                        className="flex items-center gap-2 py-1 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="clubeVinculo"
                          checked={checked}
                          onChange={() => setClubeSelId(op.id)}
                        />
                        <span className="text-sm">{op.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-gray-500 mt-1">
                Você pode selecionar apenas um clube.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium">Professores</label>

              {professorSelIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {professorSelIds.map((id) => {
                    const nome = listaProfessores.find((p) => p.id === id)?.nome ?? id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setProfessorSelIds((prev) => prev.filter((x) => x !== id))
                        }
                        className="text-xs rounded-full border px-2 py-1 bg-white hover:bg-gray-50"
                        title="Remover"
                      >
                        {nome} <span className="ml-1 text-gray-500">×</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                className="w-full border px-3 py-2 rounded mb-2"
                placeholder="Pesquisar professor pelo nome..."
                value={buscaProfessorVinculo}
                onChange={(e) => setBuscaProfessorVinculo(e.target.value)}
              />

              <div className="border rounded p-2 bg-white max-h-56 overflow-auto">
                {professoresFiltrados.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhum professor disponível.</div>
                ) : (
                  professoresFiltrados.map((op) => {
                    const checked = professorSelIds.includes(op.id);
                    return (
                      <label
                        key={op.id}
                        className="flex items-center gap-2 py-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setProfessorSelIds((prev) => {
                              if (prev.includes(op.id)) return prev.filter((x) => x !== op.id);
                              return [...prev, op.id];
                            });
                          }}
                        />
                        <span className="text-sm">{op.nome}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <p className="text-xs text-gray-500 mt-1">
                Você pode selecionar mais de um professor.
              </p>
            </div>
          </>
        );

      case "professor":
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("CREF", "cref")}
            {renderInput("Área de Formação", "areaFormacao")}
            {renderInput("Escola", "escola")}
            {renderInput(
              "Qualificações (separadas por vírgula)",
              "qualificacoes"
            )}
            {renderInput(
              "Certificações (separadas por vírgula)",
              "certificacoes"
            )}
          </>
        );

      case "escola":
      case "escolinha":
        return (
          <>
            {renderInput("Nome da Escolinha", "nome")}
            {renderInput("CNPJ", "cnpj")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("E-mail público", "email", "email")}
            {renderInput("Site oficial", "siteOficial")}
            {renderInput("Sede", "sede")}
            {renderInput("Categorias", "categorias")}
            <div className="mb-4">
              <label className="block text-sm font-medium">Descrição</label>
              <textarea
                name="tipo_descricao"
                value={dadosTipo.descricao ?? ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded min-h-[110px]"
                placeholder="Descreva a escolinha, estrutura, categorias e metodologia."
              />
            </div>
          </>
        );
      case "olheiro":
        return (
          <>
            <h2 className="text-lg font-semibold mt-2 mb-2">
              Informações do Olheiro
            </h2>
            {renderInput("Headline", "headline")}
            {renderInput("Área de atuação", "areaAtuacao")}
            {renderInput("Anos de experiência", "anosExperiencia", "number")}

            <div className="mb-4">
              <label className="block text-sm font-medium">Sobre</label>
              <textarea
                name="tipo_descricao"
                value={dadosTipo["descricao"] ?? ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                rows={4}
                placeholder="Conte resumidamente seu foco, experiência, regiões etc."
              />
            </div>

              {(colaboracaoAtual || solicitacaoColabPendente) && (
                <h2 className="text-lg font-semibold mt-4 mb-2">
                  Colaboração
                </h2>
              )}

              {colaboracaoAtual && (
                <div className="
                  mb-5
                  rounded-xl
                  border
                  border-green-200
                  bg-green-50
                  px-4
                  py-3
                  flex
                  items-center
                  justify-between
                  gap-3
                ">
                  <div>
                    <div className="text-xs text-green-700">
                      Colaboração atual
                    </div>

                    <div className="font-semibold text-green-950">
                      {colaboracaoAtual.tipo ===
                      "CLUBE"
                        ? "Clube"
                        : "Escola"}
                      :{" "}
                      {colaboracaoAtual.nome}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    removerColaboracaoAtual
                  }
                  className="
                    h-8
                    w-8
                    rounded-full
                    border
                    border-green-300
                    bg-white
                    text-green-900
                    hover:bg-red-50
                    hover:text-red-600
                  "
                  title="Encerrar colaboração"
                  aria-label="Encerrar colaboração"
                >
                  ×
                </button>
              </div>
            )}


            {/* ==============================
                SOLICITAÇÃO PENDENTE
            ================================ */}

            {solicitacaoColabPendente && (
              <div className="
                mb-5
                rounded-xl
                border
                border-yellow-200
                bg-yellow-50
                px-4
                py-3
                flex
                items-center
                justify-between
                gap-3
              ">
                <div>
                  <div className="text-xs text-yellow-700">
                    Aguardando aprovação
                  </div>

                  <div className="font-semibold text-yellow-950">
                    {solicitacaoColabPendente.tipo ===
                    "CLUBE"
                      ? "Clube"
                      : "Escola"}
                    :{" "}
                    {
                      solicitacaoColabPendente.nome
                    }
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    cancelarSolicitacaoColab
                  }
                  className="
                    h-8
                    w-8
                    rounded-full
                    border
                    bg-white
                    text-yellow-900
                    hover:text-red-600
                  "
                  title="Cancelar solicitação"
                >
                  ×
                </button>
              </div>
            )}


            {/* ==============================
                CLUBE
            ================================ */}

            <h2 className="text-lg font-semibold mt-4 mb-2">
              Clube colaborador
            </h2>

            {clubeSel ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 mb-3">
                <div>
                  <div className="text-xs text-gray-500">
                    Será enviada uma solicitação
                  </div>

                  <div className="font-medium">
                    {clubeSel.nome}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setClubeSel(null);
                    setClubeQuery("");
                  }}
                  className="h-8 w-8 rounded-full border"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <input
                  disabled={
                    !!solicitacaoColabPendente
                  }
                  className="
                    w-full
                    border
                    rounded
                    px-3
                    py-2
                    mb-2
                    disabled:bg-gray-100
                  "
                  placeholder={
                    solicitacaoColabPendente
                      ? "Cancele a solicitação pendente para escolher outro clube"
                      : "Buscar clube (mín. 2 letras)…"
                  }
                  value={clubeQuery}
                  onChange={(e) =>
                    setClubeQuery(
                      e.target.value
                    )
                  }
                />

                {!solicitacaoColabPendente &&
                  clubes.length > 0 && (
                    <div className="max-h-48 overflow-auto border rounded mb-3">
                      {clubes.map(
                        (c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50"
                            onClick={() => {
                              setClubeSel(
                                c
                              );

                              setEscolinhaColabSel(
                                null
                              );

                              setClubeQuery(
                                ""
                              );

                              setClubes(
                                []
                              );
                            }}
                          >
                            <div className="text-sm font-medium">
                              {c.nome}
                            </div>

                            {c.username && (
                              <div className="text-xs text-gray-500">
                                @{c.username}
                              </div>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
              </>
            )}


            {/* ==============================
                ESCOLA
            ================================ */}

            <h2 className="text-lg font-semibold mt-6 mb-2">
              Escola colaboradora
            </h2>

            {escolinhaColabSel ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 mb-3">
                <div>
                  <div className="text-xs text-gray-500">
                    Será enviada uma solicitação
                  </div>

                  <div className="font-medium">
                    {
                      escolinhaColabSel.nome
                    }
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEscolinhaColabSel(
                      null
                    );

                    setEscolinhaColabQuery(
                      ""
                    );
                  }}
                  className="h-8 w-8 rounded-full border"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <input
                  disabled={
                    !!solicitacaoColabPendente
                  }
                  className="
                    w-full
                    border
                    rounded
                    px-3
                    py-2
                    mb-2
                    disabled:bg-gray-100
                  "
                  placeholder={
                    solicitacaoColabPendente
                      ? "Cancele a solicitação pendente para escolher outra escola"
                      : "Buscar escola (mín. 2 letras)…"
                  }
                  value={
                    escolinhaColabQuery
                  }
                  onChange={(e) =>
                    setEscolinhaColabQuery(
                      e.target.value
                    )
                  }
                />

                {!solicitacaoColabPendente &&
                  escolinhasColab.length >
                    0 && (
                    <div className="max-h-48 overflow-auto border rounded">
                      {escolinhasColab.map(
                        (e) => (
                          <button
                            key={e.id}
                            type="button"
                            className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50"
                            onClick={() => {
                              setEscolinhaColabSel(
                                e
                              );

                              setClubeSel(
                                null
                              );

                              setEscolinhaColabQuery(
                                ""
                              );

                              setEscolinhasColab(
                                []
                              );
                            }}
                          >
                            <div className="text-sm font-medium">
                              {e.nome}
                            </div>

                            {e.username && (
                              <div className="text-xs text-gray-500">
                                @{e.username}
                              </div>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
              </>
            )}
            <h2 className="text-lg font-semibold mt-6 mb-2">Contatos</h2>
            {renderInput("E-mail público", "emailPublico")}
            {renderInput("Telefone público", "telefonePublico")}
            {renderInput("Site/LinkedIn", "siteOuLinkedin")}
          </>
        );

      case "clube":
        return (
          <>
            {renderInput("Nome do Clube", "nome")}
            {renderInput("CNPJ", "cnpj")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("E-mail público", "email", "email")}
            {renderInput("Site oficial", "siteOficial")}
            {renderInput("Sede", "sede")}
            {renderInput("Estádio", "estadio")}
            {renderInput("Categorias", "categorias")}
            <div className="mb-4">
              <label className="block text-sm font-medium">Descrição</label>
              <textarea
                name="tipo_descricao"
                value={dadosTipo.descricao ?? ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded min-h-[110px]"
                placeholder="Descreva o clube, história, estrutura e objetivos."
              />
            </div>
          </>
        );
      }
  };

const FALLBACK_AVATAR = "/assets/usuarios/default-user.png";
  
return (
    <div
      className="p-6 max-w-3xl mx-auto pb-24"
      style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >


    <header className="bg-green-900 text-white rounded mb-4 px-3 py-3 flex items-center relative">
      <Link 
        href={new URLSearchParams(window.location.search).get("returnTo") || "/perfil"}
        aria-label="Voltar para perfil"
        className="inline-flex h-10 w-10 items-center justify-center
          rounded-full bg-white/10 text-white
          hover:bg-white/20 focus:outline-none
          focus:ring-2 focus:ring-white/30 z-10"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h1 className="absolute left-1/2 -translate-x-1/2 text-xl font-bold pointer-events-none">
        Editar Perfil
      </h1>
    </header>



        {typeof dadosUsuario.foto === "string" && dadosUsuario.foto && (
          <div className="mb-6">
            <label className="block text-sm font-medium">Foto Atual</label>
            <img
              src={formatarUrlFoto(dadosUsuario.foto, "usuarios")}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.onerror = null;
                img.src = FALLBACK_AVATAR;
              }}
              className="w-24 h-24 rounded-full object-cover mt-2"
              alt="Foto atual"
            />
          </div>
        )}


      <div className="mb-6">
        <label className="block text-sm font-medium">Foto de Perfil</label>
        {dadosUsuario?.foto instanceof File && (
          <img
            src={URL.createObjectURL(dadosUsuario.foto)}
            className="w-24 h-24 rounded-full object-cover mt-2 mb-2 border"
            alt="Preview"
          />
        )}

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
              setDadosUsuario((prev: any) => ({ ...prev, foto: file }));
          }}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Nome</label>
        <input
          name="nome"
          value={dadosUsuario.nome || ""}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Nome de usuário (@)</label>
        <input
          name="nomeDeUsuario"
          value={dadosUsuario.nomeDeUsuario || ""}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="ex: joao.olheiro"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use apenas letras, números, pontos e underline.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          value={dadosUsuario.email || ""}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

{(isProfessor || isOlheiro || isAtleta) && (
        <div className="mb-6">
          <label className="block text-sm font-medium">CPF</label>
          <input
            name="cpf"
            value={dadosUsuario.cpf || ""}
            onChange={(e) => {
              const digits = onlyDigits(e.target.value).slice(0, 11);
              setDadosUsuario((prev: any) => ({ ...prev, cpf: digits }));
            }}
            className="w-full border px-3 py-2 rounded"
            placeholder="000.000.000-00"
          />
        </div>
      )}
      
      {mostrarCepUsuario && (
        <div className="mb-6">
          <label className="block text-sm font-medium">CEP</label>
          <input
            name="cep"
            value={String(dadosUsuario.cep || "").replace(/^(\d{5})(\d)/, "$1-$2")}
            onChange={(e) => {
              const digits = onlyDigits(e.target.value).slice(0, 8);
              setDadosUsuario((prev: any) => ({ ...prev, cep: digits }));
            }}
            className="w-full border px-3 py-2 rounded"
            placeholder="Ex: 29102-999"
          />
          <p className="text-xs text-gray-500 mt-1">
            Você pode deixar em branco.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">País </label>
          <input
            name="pais"
            value={dadosUsuario.pais || ""}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Brasil"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Estado (UF) </label>
          <input
            name="estado"
            value={dadosUsuario.estado || ""}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="ES"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Cidade </label>
          <input
            name="cidade"
            value={dadosUsuario.cidade || ""}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            placeholder="Vila Velha"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Logradouro (Endereço)</label>
        <input
          name="logradouro"
          value={dadosUsuario.logradouro || ""}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Rua, avenida, etc."
        />
      </div>

      {renderCamposEspecificos()}

      <button
        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-600"
        onClick={async () => {
          const rawUsername = (dadosUsuario.nomeDeUsuario ?? "").trim();
          const usernameFinal = rawUsername ? rawUsername.toLowerCase() : "";

          if (usernameFinal) {
            if (!/^[a-z0-9._]{3,30}$/.test(usernameFinal)) {
              toast.error("Nome de usuário inválido. Use letras, números, ponto e underline (3–30).");
              return;
            }
          }

          try {
            const formData = new FormData();

            if (dadosUsuario.foto instanceof File) {
              formData.append("foto", dadosUsuario.foto);
            }

            const tipo: any = { ...dadosTipo };

            if (typeof tipo.cnpj === "string") {
              const cnpjLimpo = onlyCnpj(tipo.cnpj);
              tipo.cnpj = cnpjLimpo === "" ? null : cnpjLimpo;
            }

            if (typeof tipo.cref === "string") {
              const crefLimpo = tipo.cref.trim();
              tipo.cref = crefLimpo === "" ? null : crefLimpo;
            }
            if (tipo.siteOficial && !tipo.site) tipo.site = tipo.siteOficial;

            delete tipo.colaboracaoClubeId;
            delete tipo.colaboracaoEscolinhaId;
            delete tipo.colaboracaoProfessorId;
            delete tipo.colaboracaoClube;
            delete tipo.colaboracaoEscolinha;
            delete tipo.colaboracaoProfessor;
            delete tipo.escola;
            delete tipo.clube;

            if (escolinhaSelId === null) tipo.escolinhaId = null;
            else if (typeof escolinhaSelId === "string") tipo.escolinhaId = escolinhaSelId;

            if (clubeSelId === null) tipo.clubeId = null;
            else if (typeof clubeSelId === "string") tipo.clubeId = clubeSelId;

            tipo.professorIds = professorSelIds;
            tipo.professorId = professorSelIds.length > 0 ? professorSelIds[0] : null;

            if (!Array.isArray(tipo.categorias)) {
              tipo.categorias = tipo.categorias ? [tipo.categorias] : [];
            }

            if (typeof tipo.anosExperiencia === "string" && tipo.anosExperiencia !== "") {
              const n = Number(tipo.anosExperiencia);
              tipo.anosExperiencia = Number.isNaN(n) ? undefined : n;
            }

            tipo.emailPublico = nullIfEmpty(tipo.emailPublico);
            tipo.telefonePublico = nullIfEmpty(tipo.telefonePublico);
            tipo.siteOuLinkedin = nullIfEmpty(tipo.siteOuLinkedin);

            if (tipoRender === "professor") {
              if (typeof tipo.qualificacoes === "string") {
                tipo.qualificacoes = tipo.qualificacoes
                  .split(",")
                  .map((q: string) => q.trim())
                  .filter(Boolean);
              }
              if (typeof tipo.certificacoes === "string") {
                tipo.certificacoes = tipo.certificacoes
                  .split(",")
                  .map((c: string) => c.trim())
                  .filter(Boolean);
              }
            }

            const cepFinal = onlyDigits((dadosUsuario.cep ?? "").toString());

            const usuarioPayload = {
              ...dadosUsuario,
              foto: dadosUsuario.foto instanceof File ? undefined : dadosUsuario.foto,
              nomeDeUsuario: usernameFinal || null,
              cep: cepFinal === "" ? null : cepFinal,
            };

            formData.append("usuario", JSON.stringify(usuarioPayload));
            formData.append("tipo", JSON.stringify(tipo));
            formData.append(
              "tipoUsuario",
              String(tipoUsuarioOriginal)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/^escolinha$/, "escola")
            );

            await axios.put(
              `${API.BASE_URL}/api/perfil/${usuarioId}`,
              formData,
              { 
                headers: { 
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "multipart/form-data" 
                } 
              }
            );

            let solicitacaoColaboracaoEnviada =
              false;

            if (
              tipoRender === "olheiro"
            ) {
              const olheiroId =
                String(
                  dadosTipo?.id ||
                    Storage.tipoUsuarioId ||
                    ""
                ).trim();

              if (
                olheiroId &&
                clubeSel
              ) {
                await axios.post(
                  `${API.BASE_URL}/api/olheiros/${encodeURIComponent(
                    olheiroId
                  )}/colaboracao/solicitar`,
                  {
                    tipo:
                      "CLUBE",

                    destinoId:
                      clubeSel.id,
                  },
                  {
                    headers: {
                      Authorization:
                        `Bearer ${token}`,
                      "Content-Type":
                        "application/json",
                    },
                  }
                );

                solicitacaoColaboracaoEnviada =
                  true;
              }

              if (
                olheiroId &&
                escolinhaColabSel
              ) {
                await axios.post(
                  `${API.BASE_URL}/api/olheiros/${encodeURIComponent(
                    olheiroId
                  )}/colaboracao/solicitar`,
                  {
                    tipo:
                      "ESCOLINHA",

                    destinoId:
                      escolinhaColabSel.id,
                  },
                  {
                    headers: {
                      Authorization:
                        `Bearer ${token}`,
                      "Content-Type":
                        "application/json",
                    },
                  }
                );

                solicitacaoColaboracaoEnviada =
                  true;
              }
            }

            toast.success(
              solicitacaoColaboracaoEnviada
                ? "Perfil atualizado e solicitação de colaboração enviada!"
                : "Perfil atualizado com sucesso!"
            );
            Storage.nomeDeUsuario = usernameFinal || Storage.nomeDeUsuario;
            const returnTo = new URLSearchParams(window.location.search).get("returnTo");
            window.location.href = returnTo || "/perfil";

          } catch (err: any) {
            console.error("[EditarPerfil] Erro ao salvar:", err);
            const msg = err?.response?.data?.error || err?.message || "Erro ao salvar os dados.";
            toast.error(msg);
          }
        }}
      >
        Salvar Alterações
      </button>

      <BottomNav />
    </div>
  );
};

export default EditarPerfil;