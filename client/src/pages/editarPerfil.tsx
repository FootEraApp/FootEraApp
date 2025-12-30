// client/src/pages/editarPerfil
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { formatarUrlFoto } from "../utils/formatarFoto.js";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft, Volleyball, User, CirclePlus, Search, House } from "lucide-react";
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
  const [professorSelId, setProfessorSelId] = useState<string | null>(null);

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

        setDadosUsuario(res.data.usuario);

        const dadosEsp: any = { ...(res.data.dadosEspecificos || {}) };
        if (dadosEsp.site && !dadosEsp.siteOficial) {
          dadosEsp.siteOficial = dadosEsp.site;
        }

        const vinculos = res.data.vinculos || res.data.vinculo || {};

        const professorVinculoId =
          dadosEsp.professorId ??
          vinculos.professorId ??
          vinculos.professor?.id ??
          vinculos.professorAtual?.id ??
          null;

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

        if (professorVinculoId) {
          dadosEsp.professorId = professorVinculoId;
          setProfessorSelId(String(professorVinculoId));
        }

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
          : raw ?? "";

      return (
        <div className="mb-4" key={name}>
          <label className="block text-sm font-medium">{label}</label>
          <input
            type={type}
            name={`tipo_${name}`}
            value={value}
            onChange={handleChange}
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
              <select
                className="w-full border px-3 py-2 rounded"
                value={escolinhaSelId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEscolinhaSelId(v === "" ? null : v);
                }}
              >
                <option value="">Nenhuma</option>
                {listaEscolinhas.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium">Clube</label>
              <select
                className="w-full border px-3 py-2 rounded"
                value={clubeSelId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setClubeSelId(v === "" ? null : v);
                }}
              >
                <option value="">Nenhum</option>
                {listaClubes.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium">Professor</label>
              <select
                className="w-full border px-3 py-2 rounded"
                value={professorSelId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setProfessorSelId(v === "" ? null : v);
                }}
              >
                <option value="">Nenhum</option>
                {listaProfessores.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome}
                  </option>
                ))}
              </select>
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
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Email", "email")}
            {renderInput("Site Oficial", "siteOficial")}
            {renderInput("Complemento", "complemento")}
            {renderInput("Número", "numero")}
            {renderInput("Bairro", "bairro")}
            {renderInput("Cidade", "cidade")}
            {renderInput("Estado", "estado")}
            {renderInput("País", "pais")}
            {renderInput("CEP", "cep")}
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
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Email", "email")}
            {renderInput("Site Oficial", "siteOficial")}
            {renderInput("Sede", "sede")}
            {renderInput("Estádio", "estadio")}
            {renderInput("Logradouro", "logradouro")}
            {renderInput("Número", "numero")}
            {renderInput("Complemento", "complemento")}
            {renderInput("Bairro", "bairro")}
            {renderInput("Cidade", "cidade")}
            {renderInput("Estado", "estado")}
            {renderInput("País", "pais")}
            {renderInput("CEP", "cep")}

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

            {renderInput(
              "Categorias de Base (separadas por vírgula)",
              "categorias"
            )}
            <p className="text-xs text-gray-500 -mt-3 mb-2">
              Ex.: Sub9, Sub11, Sub13, Sub15, Sub17, Sub20, Livre
            </p>
          </>
        );
    }
  };

const FALLBACK_AVATAR = "/assets/usuarios/default-user.png"; // arquivo no client/public/assets/usuarios
  
return (
    <div
      className="p-6 max-w-3xl mx-auto pb-24"
      style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      <div className="mb-3">
        <Link
          href="/perfil"
          aria-label="Voltar para perfil"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-800 bg-white text-green-900 shadow-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-700/30 mt-2 ml-2 mb-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>


      <h1 className="text-2xl font-bold mb-4">Editar Perfil</h1>
        {typeof dadosUsuario.foto === "string" && dadosUsuario.foto && (
          <div className="mb-6">
            <label className="block text-sm font-medium">Foto Atual</label>
            <img
              src={formatarUrlFoto(dadosUsuario.foto, "usuarios")}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;

                // trava pra não ficar em loop infinito
                img.onerror = null;

                // fallback LOCAL (5173), não no backend (3001)
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

      {renderCamposEspecificos()}

      <button
        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-600"
        onClick={async () => {
          const rawUsername = (dadosUsuario.nomeDeUsuario ?? "").trim();
          if (rawUsername) {
            const username = rawUsername.toLowerCase();
            dadosUsuario.nomeDeUsuario = username;

            if (!/^[a-z0-9._]{3,30}$/.test(username)) {
              alert(
                "Nome de usuário inválido. Use letras, números, ponto e underline (3–30)."
              );
              return;
            }
          }

          try {
            let fotoUrl = dadosUsuario.foto;
            if (dadosUsuario.foto instanceof File) {
              const formData = new FormData();
              formData.append("foto", dadosUsuario.foto);
              formData.append("usuarioId", usuarioId!);
              formData.append("tipo", tipoUsuarioOriginal!);

              const uploadRes = await axios.post(
                `${API.BASE_URL}/api/upload/perfil`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
              );

              fotoUrl = uploadRes.data?.url || uploadRes.data?.midia?.url;
            }
            const tipo: any = { ...dadosTipo };

            if (tipo.siteOficial && !tipo.site) tipo.site = tipo.siteOficial;

            tipo.colaboracaoClubeId =
              clubeSel?.id ?? tipo.colaboracaoClubeId ?? null;
            if (tipo.colaboracaoClube) delete tipo.colaboracaoClube;

            delete tipo.escola;
            delete tipo.clube;

            if (escolinhaSelId === null) tipo.escolinhaId = null;
            else if (typeof escolinhaSelId === "string")
              tipo.escolinhaId = escolinhaSelId;

            if (clubeSelId === null) tipo.clubeId = null;
            else if (typeof clubeSelId === "string") tipo.clubeId = clubeSelId;

            if (professorSelId === null) tipo.professorId = null;
            else if (typeof professorSelId === "string")
              tipo.professorId = professorSelId;

            if (typeof tipo.categorias === "string") {
              tipo.categorias = tipo.categorias
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
            }

            if (
              typeof tipo.anosExperiencia === "string" &&
              tipo.anosExperiencia !== ""
            ) {
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

            try {
              await axios.put(
                `${API.BASE_URL}/api/perfil/${usuarioId}`,
                {
                  usuario: { ...dadosUsuario, foto: fotoUrl },
                  tipo,
                  tipoUsuario: String(tipoUsuarioOriginal)
                    .toLowerCase()
                    .replace(/^escolinha$/, "escola"),
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            } catch (err: any) {
              console.error(
                "[EditarPerfil] PUT /perfil erro:",
                err?.response?.status,
                err?.response?.data,
                err?.message
              );
              alert(
                err?.response?.data?.error ||
                  err?.message ||
                  "Erro ao salvar os dados (PUT)."
              );
              return;
            }

            if (tipoRender === "olheiro") {
              const olheiroId = dadosTipo?.id ?? Storage.tipoUsuarioId;
              if (olheiroId) {
                try {
                  await axios.patch(
                    `${API.BASE_URL}/api/olheiros/${olheiroId}`,
                    { colaboracaoClubeId: clubeSel?.id ?? null },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                } catch (err: any) {
                  console.error(
                    "[EditarPerfil] PATCH /olheiros erro:",
                    err?.response?.status,
                    err?.response?.data,
                    err?.message
                  );
                  alert(
                    err?.response?.data?.error ||
                      err?.message ||
                      "Erro ao salvar os dados (PATCH)."
                  );
                  return;
                }
              }
            }
            alert("Dados atualizados com sucesso!");
            window.location.href = "/perfil";
          } catch (err: any) {
            console.error(
              "[EditarPerfil] PUT /perfil erro:",
              err?.response?.status,
              err?.response?.data
            );
            const msg =
              err?.response?.data?.error ||
              err?.response?.data?.message ||
              err?.message ||
              "Erro ao salvar os dados.";
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