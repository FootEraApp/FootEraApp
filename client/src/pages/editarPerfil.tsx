import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { formatarUrlFoto } from '@/utils/formatarFoto.js';
import Storage from "../../../server/utils/storage.js";
import { API } from '../config.js';

type ResultadoBuscaClube = { id: string; nome: string; username?: string; fotoUrl?: string | null; };
type OptionMin = { id: string; nome: string };

// normaliza string vazia -> null
function nullIfEmpty<T>(v: T) {
  // @ts-ignore
  return v === "" ? null : v;
}

const EditarPerfil = () => {
  const usuarioId = Storage.usuarioId;
  const tipoUsuarioOriginal = Storage.tipoSalvo;
  const token = Storage.token;

  const [dadosUsuario, setDadosUsuario] = useState<any>(null);
  const [dadosTipo, setDadosTipo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  type TipoRender = 'atleta' | 'professor' | 'escola' | 'escolinha' | 'clube' | 'admin' | 'olheiro';
  const [tipoRender, setTipoRender] = useState<TipoRender | null>(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [clubeQuery, setClubeQuery] = useState("");
  const [clubes, setClubes] = useState<ResultadoBuscaClube[]>([]);
  const [clubeSel, setClubeSel] = useState<ResultadoBuscaClube | null>(null);
  const [listaClubes, setListaClubes] = useState<OptionMin[]>([]);       
  const [listaEscolinhas, setListaEscolinhas] = useState<OptionMin[]>([]);
  const [clubeSelId, setClubeSelId] = useState<string | null>(null);      
  const [escolinhaSelId, setEscolinhaSelId] = useState<string | null>(null); 

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
      const dadosEsp = { ...(res.data.dadosEspecificos || {}) };
      if (dadosEsp.site && !dadosEsp.siteOficial) dadosEsp.siteOficial = dadosEsp.site;
      setDadosTipo(dadosEsp);

      if (dadosEsp?.colaboracaoClube?.id && dadosEsp?.colaboracaoClube?.nome) {
        setClubeSel({
          id: String(dadosEsp.colaboracaoClube.id),
          nome: String(dadosEsp.colaboracaoClube.nome),
          fotoUrl: dadosEsp.colaboracaoClube.logo ?? null,
          username: dadosEsp.colaboracaoClube.username ?? "",
        });
      }

      if (dadosEsp?.escolinhaId) setEscolinhaSelId(String(dadosEsp.escolinhaId));
      if (dadosEsp?.clubeId) setClubeSelId(String(dadosEsp.clubeId));           

      const tipoSrv = res.data?.tipo ?? tipoUsuarioOriginal ?? '';
      const t = String(tipoSrv).toLowerCase();
      setTipoRender((t === 'escolinha' ? 'escola' : (t as TipoRender)));
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
    if (q.length < 2) { setClubes([]); return; }
    try {
      const r = await axios.get<any[]>(
        `${API.BASE_URL}/api/cadastro/buscar`,
        { params: { query: q, tipo: "Clube" }, headers }
      );
      if (cancelado) return;
      const arr: ResultadoBuscaClube[] = (Array.isArray(r.data) ? r.data : [])
        .filter(x => x?.id && x?.nome && x?.tipo === "Clube")
        .map(x => ({
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
  return () => { cancelado = true; };
}, [clubeQuery, API?.BASE_URL, token]);

useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [clubesRes, escolasRes] = await Promise.all([
        axios.get<OptionMin[]>(`${API.BASE_URL}/api/catalogo/clubes`,     { headers }),
        axios.get<OptionMin[]>(`${API.BASE_URL}/api/catalogo/escolinhas`, { headers }),
      ])
        if (cancel) return;
        setListaClubes(clubesRes.data || []);
        setListaEscolinhas(escolasRes.data || []);
      } catch {
        if (!cancel) { setListaClubes([]); setListaEscolinhas([]); }
      }
    })();
    return () => { cancel = true; };
  }, [API?.BASE_URL, token]);

  if (loading) {
   return <div className="text-center text-gray-600 mt-10">Carregando perfil...</div>;
  }
  if (erro) {
    return <div className="text-center text-red-600 mt-10">{erro}</div>;
  }
  if (!dadosUsuario || !dadosTipo) {
    return <div className="text-center text-red-600 mt-10">Erro ao carregar o perfil.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('tipo_')) {
      setDadosTipo({ ...dadosTipo, [name.replace('tipo_', '')]: value });
    } else {
      setDadosUsuario({ ...dadosUsuario, [name]: value });
    }
  };

  const renderCamposEspecificos = () => {
    if (!dadosTipo) return null;

    const renderInput = (label: string, name: string, type = "text") => {
      const raw = dadosTipo[name];
      const value =
        name === "categorias"
          ? (Array.isArray(raw) ? raw.join(", ") : (raw ?? ""))
          : (raw ?? "");

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
      case 'atleta':
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("Sobrenome", "sobrenome")}
            {renderInput("Idade", "idade", "number")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Nacionalidade", "nacionalidade")}
            {renderInput("Naturalidade", "naturalidade")}
            {renderInput("Posição", "posicao")}
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
                {listaEscolinhas.map(op => (
                  <option key={op.id} value={op.id}>{op.nome}</option>
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
                {listaClubes.map(op => (
                  <option key={op.id} value={op.id}>{op.nome}</option>
                ))}
              </select>
            </div>
          </>
        );
      case 'professor':
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("CREF", "cref")}
            {renderInput("Área de Formação", "areaFormacao")}
            {renderInput("Escola", "escola")}
            {renderInput("Qualificações (separadas por vírgula)", "qualificacoes")}
            {renderInput("Certificações (separadas por vírgula)", "certificacoes")}
          </>
        );
      case 'escola':
      case 'escolinha':
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
      case 'olheiro':
        return (
          <>
            <h2 className="text-lg font-semibold mt-2 mb-2">Informações do Olheiro</h2>
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

            <h2 className="text-lg font-semibold mt-4 mb-2">Clube colaborador</h2>
            {clubeSel ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">Selecionado:</span>
                <span className="font-medium text-sm">{clubeSel.nome}</span>
                <button
                  type="button"
                  className="text-green-700 underline text-sm"
                  onClick={() => { setClubeSel(null); setClubeQuery(""); }}
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
                        onClick={() => { setClubeSel(c); setClubeQuery(""); setClubes([]); }}
                      >
                        <div className="text-sm font-medium">{c.nome}</div>
                        {c.username && <div className="text-xs text-gray-500">@{c.username}</div>}
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

      case 'clube':
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

            {renderInput("Categorias de Base (separadas por vírgula)", "categorias")}
            <p className="text-xs text-gray-500 -mt-3 mb-2">
              Ex.: Sub9, Sub11, Sub13, Sub15, Sub17, Sub20, Livre
            </p>
          </>
        );
      };
    }
    
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Editar Perfil</h1>

      {typeof dadosUsuario.foto === "string" && dadosUsuario.foto && (
        <div className="mb-6">
          <label className="block text-sm font-medium">Foto Atual</label>
          <img
            src={formatarUrlFoto(dadosUsuario.foto, "usuarios")}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `${API.BASE_URL}/assets/default-user.png`;
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
            if (file) setDadosUsuario((prev: any) => ({ ...prev, foto: file }));
          }}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Nome</label>
        <input
          name="nome"
          value={dadosUsuario.nome || ''}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Nome de usuário (@)</label>
        <input
          name="nomeDeUsuario"
          value={dadosUsuario.nomeDeUsuario || ''}
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
          value={dadosUsuario.email || ''}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {renderCamposEspecificos()}

          <button
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-600"
            onClick={async () => {
              // (a) normaliza e valida o username ANTES de enviar
            const rawUsername = (dadosUsuario.nomeDeUsuario ?? "").trim();
            if (rawUsername) {
              const username = rawUsername.toLowerCase();     // força minúsculas
              dadosUsuario.nomeDeUsuario = username;          // grava normalizado

              // sem o flag /i, pois já normalizamos para minúsculas
              if (!/^[a-z0-9._]{3,30}$/.test(username)) {
                alert("Nome de usuário inválido. Use letras, números, ponto e underline (3–30).");
                return;
              }
            }

              try {
                // (b) upload da foto, se preciso
                let fotoUrl = dadosUsuario.foto;
                if (dadosUsuario.foto instanceof File) {
                  const formData = new FormData();
                  formData.append("foto", dadosUsuario.foto);
                  formData.append("usuarioId", usuarioId!);
                  formData.append("tipo", tipoUsuarioOriginal!);
                  const uploadRes = await axios.post(`${API.BASE_URL}/api/upload/perfil`, formData, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  fotoUrl = uploadRes.data.url;
                }

                // (c) monta e normaliza o objeto "tipo"
                const tipo: any = { ...dadosTipo };

                if (tipo.siteOficial && !tipo.site) tipo.site = tipo.siteOficial;

                // seleção de clube colaborador (olheiro)
                tipo.colaboracaoClubeId = clubeSel?.id ?? tipo.colaboracaoClubeId ?? null;
                if (tipo.colaboracaoClube) delete tipo.colaboracaoClube;

                // limpar campos que não devem ir
                delete tipo.escola;
                delete tipo.clube;

                // selects (atleta)
                if (escolinhaSelId === null)             tipo.escolinhaId = null;
                else if (typeof escolinhaSelId === "string") tipo.escolinhaId = escolinhaSelId;

                if (clubeSelId === null)                 tipo.clubeId = null;
                else if (typeof clubeSelId === "string")     tipo.clubeId = clubeSelId;

                // arrays vindos como string
                if (typeof tipo.categorias === "string") {
                  tipo.categorias = tipo.categorias
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean);
                }

                // conversões numéricas
                if (typeof tipo.anosExperiencia === "string" && tipo.anosExperiencia !== "") {
                  const n = Number(tipo.anosExperiencia);
                  tipo.anosExperiencia = Number.isNaN(n) ? undefined : n;
                }

                // normalizar vazios -> null (contatos olheiro)
                tipo.emailPublico    = nullIfEmpty(tipo.emailPublico);
                tipo.telefonePublico = nullIfEmpty(tipo.telefonePublico);
                tipo.siteOuLinkedin  = nullIfEmpty(tipo.siteOuLinkedin);

                // professor: listas
                if (tipoUsuarioOriginal === "professor") {
                  if (typeof tipo.qualificacoes === "string") {
                    tipo.qualificacoes = tipo.qualificacoes.split(",").map((q: string) => q.trim()).filter(Boolean);
                  }
                  if (typeof tipo.certificacoes === "string") {
                    tipo.certificacoes = tipo.certificacoes.split(",").map((c: string) => c.trim()).filter(Boolean);
                  }
                }
                 // (d) PUT principal
                  try {
                    await axios.put(
                      `${API.BASE_URL}/api/perfil/${usuarioId}`,
                      {
                        usuario: { ...dadosUsuario, foto: fotoUrl },
                        tipo,
                        tipoUsuario: String(tipoUsuarioOriginal).toLowerCase(),
                      },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                  } catch (err: any) {
                    console.error("[EditarPerfil] PUT /perfil erro:", err?.response?.status, err?.response?.data, err?.message);
                    alert(err?.response?.data?.error || err?.message || "Erro ao salvar os dados (PUT).");
                    return; // evita tentar PATCH se o PUT falhou
                  }

                  // (e) PATCH extra (apenas para OLHEIRO) para vincular colaboracaoClubeId
                  if (tipoRender === "olheiro") {
                    const olheiroId = dadosTipo?.id ?? Storage.tipoUsuarioId; // fallback
                    if (olheiroId) {
                      try {
                        await axios.patch(
                          `${API.BASE_URL}/api/olheiros/${olheiroId}`,
                          { colaboracaoClubeId: clubeSel?.id ?? null },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                      } catch (err: any) {
                        console.error("[EditarPerfil] PATCH /olheiros erro:", err?.response?.status, err?.response?.data, err?.message);
                        alert(err?.response?.data?.error || err?.message || "Erro ao salvar os dados (PATCH).");
                        return;
                      }
                    }
                  }

                  // sucesso só depois dos dois passos passarem
                  alert("Dados atualizados com sucesso!");
                  window.location.href = "/perfil";
                } catch (err: any) {
                // (f) tratamento de erro detalhado
                console.error("[EditarPerfil] PUT /perfil erro:", err?.response?.status, err?.response?.data);
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

    </div>
  );
};

export default EditarPerfil;