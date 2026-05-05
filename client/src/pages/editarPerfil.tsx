// client/src/pages/editarPerfil
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
    | "olheiro";
  const [tipoRender, setTipoRender] = useState<TipoRender | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [clubeQuery, setClubeQuery] = useState("");
  const [clubes, setClubes] = useState<ResultadoBuscaClube[]>([]);
  const [clubeSel, setClubeSel] = useState<ResultadoBuscaClube | null>(null);
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

        if (!res?.data?.usuario || !res?.data?.dadosEspecificos) {
          setErro("Perfil não encontrado ou resposta inválida do servidor.");
          return;
        }

        const u = res.data.usuario || {};
        const dadosEsp: any = { ...(res.data.dadosEspecificos || {}) };
        
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

        const tipoSrv = res.data?.tipo ?? tipoUsuarioOriginal ?? "";
        const t = String(tipoSrv).toLowerCase();
        setTipoRender((t === "escolinha" ? "escola" : (t as TipoRender)));
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

    // só busca quando tiver exatamente 8 números
    if (cepDigits.length !== 8) return;

    let cancel = false;

    (async () => {
      try {
        const { data } = await axios.get(`https://viacep.com.br/ws/${cepDigits}/json/`);

        if (cancel) return;

        if (!data || data.erro) {
          // opcional: você pode avisar, mas eu recomendo só não preencher
          return;
        }

        setDadosUsuario((prev: any) => ({
          ...prev,
          cep: cepDigits,
          logradouro: prev?.logradouro || data.logradouro || "",
          cidade: prev?.cidade || data.localidade || "",
          estado: prev?.estado || data.uf || "",
          pais: prev?.pais || "Brasil",
        }));
      } catch (e) {
        // opcional: log
        console.warn("[EditarPerfil] ViaCEP falhou", e);
      }
    })();

    return () => {
      cancel = true;
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
  if (!dadosUsuario || !dadosTipo) {
    return (
      <div className="text-center text-red-600 mt-10">
        Erro ao carregar o perfil.
      </div>
    );
  }

  const isAtleta = tipoRender === "atleta";
  const isOlheiro = tipoRender === "olheiro";
  const isProfessor = tipoRender === "professor";
  const isClube = tipoRender === "clube";
  const isEscolinha = tipoRender === "escola" || tipoRender === "escolinha";

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
      const value =
        name === "categorias"
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
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("CNPJ", "cnpj")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Email", "email")}
            {renderInput("Site Oficial", "siteOficial")}
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

            <h2 className="text-lg font-semibold mt-4 mb-2">
              Clube colaborador
            </h2>
            {clubeSel ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">Selecionado:</span>
                <span className="font-medium text-sm">{clubeSel.nome}</span>
                <button
                  type="button"
                  className="text-green-700 underline text-sm"
                  onClick={() => {
                    setClubeSel(null);
                    setClubeQuery("");
                  }}
                >
                  trocar/remover
                </button>
              </div>
            ) : (
              <>
                <input
                  className="w-full border rounded px-3 py-2 mb-2"
                  placeholder="Buscar clube (mín. 2 letras)…"
                  value={clubeQuery}
                  onChange={(e) => setClubeQuery(e.target.value)}
                />
                {clubes.length > 0 && (
                  <div className="max-h-48 overflow-auto border rounded">
                    {clubes.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50"
                        onClick={() => {
                          setClubeSel(c);
                          setClubeQuery("");
                          setClubes([]);
                        }}
                      >
                        <div className="text-sm font-medium">{c.nome}</div>
                        {c.username && (
                          <div className="text-xs text-gray-500">
                            @{c.username}
                          </div>
                        )}
                      </button>
                    ))}
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
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("CNPJ", "cnpj")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Email", "email")}
            {renderInput("Site Oficial", "siteOficial")}
            {renderInput("Estádio", "estadio")}

            <div className="mb-4">
              <label className="block text-sm font-medium">Descrição</label>
              <textarea
                name="tipo_descricao"
                value={dadosTipo["descricao"] ?? ""}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                rows={4}
                placeholder="Fale sobre o clube, história, missão, etc."
              />
            </div>

           <div className="mb-4">
            <label className="block text-sm font-medium">Categorias de Base</label>

            <select
              multiple
              value={Array.isArray(dadosTipo.categorias) ? dadosTipo.categorias : []}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setDadosTipo((prev: any) => ({
                  ...prev,
                  categorias: values,
                }));
              }}
              className="w-full border px-3 py-2 rounded bg-white min-h-[180px]"
            >
              <option value="Sub3">Sub-3</option>
              <option value="Sub5">Sub-5</option>
              <option value="Sub7">Sub-7</option>
              <option value="Sub9">Sub-9</option>
              <option value="Sub11">Sub-11</option>
              <option value="Sub13">Sub-13</option>
              <option value="Sub15">Sub-15</option>
              <option value="Sub16">Sub-16</option>
              <option value="Livre">Livre</option>
            </select>

            <p className="text-xs text-gray-500 mt-1">
              Segure Ctrl (ou Cmd no Mac) para selecionar mais de uma categoria.
            </p>
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
            value={dadosUsuario.cep || ""}
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

          // 1. Validação de Username
          if (usernameFinal) {
            if (!/^[a-z0-9._]{3,30}$/.test(usernameFinal)) {
              alert("Nome de usuário inválido. Use letras, números, ponto e underline (3–30).");
              return;
            }
          }

          try {
            const formData = new FormData();

            // 2. Tratamento da Foto (Se for arquivo, vai pro FormData)
            if (dadosUsuario.foto instanceof File) {
              formData.append("foto", dadosUsuario.foto);
            }

            // 3. Preparação do objeto 'tipo' (Lógica específica de cada categoria)
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

            tipo.colaboracaoClubeId = clubeSel?.id ?? tipo.colaboracaoClubeId ?? null;
            if (tipo.colaboracaoClube) delete tipo.colaboracaoClube;
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

            if (tipoUsuarioOriginal === "professor") {
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
              String(tipoUsuarioOriginal).toLowerCase().replace(/^escolinha$/, "escola")
            );

            // 5. Única requisição PUT para o Perfil
            await axios.put(
              `${API.BASE_URL}/api/perfil/${usuarioId}`,
              formData,
              { 
                headers: { 
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "multipart/form-data" // Necessário para enviar arquivos
                } 
              }
            );

            // 6. Lógica extra para Olheiro (se necessário manter separado)
            if (tipoRender === "olheiro") {
              const olheiroId = dadosTipo?.id ?? Storage.tipoUsuarioId;
              if (olheiroId) {
                await axios.patch(
                  `${API.BASE_URL}/api/olheiros/${olheiroId}`,
                  { colaboracaoClubeId: clubeSel?.id ?? null },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
              }
            }

            alert("Perfil atualizado com sucesso!");
            Storage.nomeDeUsuario = usernameFinal || Storage.nomeDeUsuario;
            const returnTo = new URLSearchParams(window.location.search).get("returnTo");
            window.location.href = returnTo || "/perfil";

          } catch (err: any) {
            console.error("[EditarPerfil] Erro ao salvar:", err);
            const msg = err?.response?.data?.error || err?.message || "Erro ao salvar os dados.";
            alert(msg);
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