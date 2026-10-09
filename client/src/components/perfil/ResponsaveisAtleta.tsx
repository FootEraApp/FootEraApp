import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { API } from "../../config.js";
import Storage from "../../utils/storage.js";

type Vinculo = {
  id: string;
  status: "PENDENTE" | "ATIVO" | "REVOGADO";
  origemSolicitacao?: "ATLETA" | "RESPONSAVEL" | "CADASTRO_MENOR" | null;
  principal: boolean;
  parentesco?: string | null;
  podeEditarPerfil: boolean;
  podeGerenciarPrivacidade: boolean;
  podeGerenciarTreinos: boolean;
  podeGerenciarConteudo: boolean;
  responsavel: {
    id: string;
    nome: string;
    nomeDeUsuario?: string | null;
    foto?: string | null;
  };
};
type Resposta = {
  idade: number | null;
  podeDesvincularResponsaveis: boolean;
  podeResponderSolicitacoes: boolean;
  items: Vinculo[];
};

export default function ResponsaveisAtleta() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [novoId, setNovoId] = useState("");
  const [erro, setErro] = useState("");
  const [buscaResponsavel, setBuscaResponsavel] = useState<{ id: string; nome: string; nomeDeUsuario: string | null; foto: string | null } | null>(null);
  const [consultandoId, setConsultandoId] = useState(false);
  const [idNaoEncontrado, setIdNaoEncontrado] = useState(false);
  const [editandoParentesco, setEditandoParentesco] = useState<string | null>(null);
  const [parentescoEscolhido, setParentescoEscolhido] = useState("");
  const token = Storage.token;

  const request = useCallback(async (path: string, method: string = "GET", body?: object) => {
    const response = await fetch(`${API.BASE_URL}/api/responsaveis${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.message || `Erro HTTP ${response.status}`);
    return json;
  }, [token]);

  // Confirma no backend que o ID corresponde a uma conta com papel Responsável ativo.
  useEffect(() => {
    setBuscaResponsavel(null);
    setIdNaoEncontrado(false);
    const id = novoId.trim();
    if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setConsultandoId(false);
      return;
    }
    const controller = new AbortController();
    setConsultandoId(true);
    const timeout = window.setTimeout(async () => {
      try {
        const resposta = await fetch(`${API.BASE_URL}/api/responsaveis/consulta/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (!resposta.ok) { setIdNaoEncontrado(true); return; }
        const info = await resposta.json();
        if (!controller.signal.aborted) setBuscaResponsavel(info.usuario ?? null);
      } catch (e) {
        if (!controller.signal.aborted) setIdNaoEncontrado(true);
      } finally {
        if (!controller.signal.aborted) setConsultandoId(false);
      }
    }, 350);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [novoId, token]);

  async function salvarParentesco(item: Vinculo) {
    try {
      setProcessando(item.id);
      setErro("");
      await request(`/atleta/me/responsaveis/${encodeURIComponent(item.id)}/parentesco`, "PATCH", {
        parentesco: parentescoEscolhido || null,
      });
      setEditandoParentesco(null);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || "Não foi possível atualizar a relação.");
    } finally { setProcessando(null); }
  }

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      setCarregando(true);
      setErro("");
      const resposta = await request("/atleta/me/responsaveis");
      setDados(resposta);
    } catch (error: any) {
      setErro(error?.message || "Erro ao carregar responsáveis.");
    } finally {
      setCarregando(false);
    }
  }, [request, token]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function responder(vinculoId: string, acao: "aceitar" | "recusar") {
    if (!window.confirm(`Deseja ${acao} a solicitação de responsável?`)) return;
    try {
      setProcessando(vinculoId);
      setErro("");
      await request(`/atleta/me/solicitacoes-responsaveis/${encodeURIComponent(vinculoId)}/${acao}`, "PATCH");
      await carregar();
    } catch (error: any) {
      setErro(error?.message || "Não foi possível responder à solicitação.");
      await carregar();
    } finally {
      setProcessando(null);
    }
  }

  async function desvincular(item: Vinculo) {
    if (!window.confirm(`Desvincular ${item.responsavel.nome || item.responsavel.nomeDeUsuario}?`)) return;
    try {
      setProcessando(item.id);
      setErro("");
      await request(`/atleta/me/responsaveis/${encodeURIComponent(item.id)}`, "DELETE");
      await carregar();
    } catch (error: any) {
      setErro(error?.message || "Não foi possível desvincular.");
    } finally { setProcessando(null); }
  }

  async function solicitar() {
    const responsavelUsuarioId = novoId.trim();
    if (!responsavelUsuarioId) return;
    try {
      setProcessando("novo");
      setErro("");
      await request("/solicitacoes", "POST", { responsavelUsuarioId });
      setNovoId("");
      await carregar();
    } catch (error: any) {
      setErro(error?.message || "Não foi possível enviar a solicitação.");
    } finally { setProcessando(null); }
  }

  if (carregando && !dados) return <div className="py-6 text-center text-green-900">Carregando responsáveis...</div>;
  const items = dados?.items || [];
  const ativos = items.filter((v) => v.status === "ATIVO");
  const pendentes = items.filter((v) => v.status === "PENDENTE");
  const temPrincipal = ativos.some((v) => v.principal);

  return (
    <section className="mt-4 space-y-4">
      <header className="rounded-2xl border border-green-100 bg-white p-4">
        <h2 className="text-lg font-bold text-green-900">Meus responsáveis</h2>
        <p className="mt-1 text-sm text-gray-600">Veja os vínculos, quem é o principal e as permissões concedidas.</p>
        <button type="button" onClick={() => void carregar()} className="mt-2 text-sm text-green-800 underline">Atualizar lista</button>
      </header>

      {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}

      {ativos.length === 0 && <div className="rounded-xl bg-white p-4 text-sm text-gray-600">Nenhum responsável vinculado.</div>}
      {ativos.map((item) => (
        <article key={item.id} className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href={`/perfil/${encodeURIComponent(item.responsavel.id)}?papel=Responsavel`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:bg-green-50" title="Abrir perfil do responsável">
              {item.responsavel.foto ? <img src={item.responsavel.foto} alt={item.responsavel.nome} className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-900">{item.responsavel.nome?.slice(0, 1) || "R"}</div>}
              <div className="min-w-0"><div className="truncate font-semibold text-green-950">{item.responsavel.nome}</div><div className="truncate text-sm text-gray-500">@{item.responsavel.nomeDeUsuario || "usuario"}</div></div>
            </Link>
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">{item.principal ? "Principal" : "Secundário"}</span>
          </div>
          <div className="mt-3 text-sm text-gray-700">
            <p><strong>Relação com o atleta:</strong> {item.parentesco || "Não informada"}</p>
            {editandoParentesco === item.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={parentescoEscolhido} onChange={(e) => setParentescoEscolhido(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Não informada</option><option value="Mãe">Mãe</option><option value="Pai">Pai</option><option value="Responsável legal">Responsável legal</option><option value="Avó">Avó</option><option value="Avô">Avô</option><option value="Outro">Outro</option>
                </select>
                <button type="button" disabled={processando !== null} onClick={() => void salvarParentesco(item)} className="rounded-lg bg-green-800 px-3 py-2 text-sm text-white disabled:opacity-50">Salvar</button>
                <button type="button" onClick={() => setEditandoParentesco(null)} className="text-sm text-gray-600">Cancelar</button>
              </div>
            ) : (
              <button type="button" className="mt-1 text-xs text-green-800 underline" onClick={() => { setEditandoParentesco(item.id); setParentescoEscolhido(item.parentesco ?? ""); }}>Editar relação</button>
            )}
            <p className="mt-2 font-semibold">Permissões</p>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">
              <li>Editar perfil: {item.podeEditarPerfil ? "Sim" : "Não"}</li>
              <li>Privacidade: {item.podeGerenciarPrivacidade ? "Sim" : "Não"}</li>
              <li>Treinos: {item.podeGerenciarTreinos ? "Sim" : "Não"}</li>
              <li>Conteúdo: {item.podeGerenciarConteudo ? "Sim" : "Não"}</li>
            </ul>
          </div>
          {dados?.podeDesvincularResponsaveis && (
            <button type="button" disabled={processando !== null} onClick={() => void desvincular(item)} className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Desvincular</button>
          )}
        </article>
      ))}

      <div className="rounded-2xl border border-green-100 bg-white p-4">
        <h3 className="font-bold text-green-900">Solicitações pendentes</h3>
        {pendentes.length === 0 && <p className="mt-2 text-sm text-gray-500">Nenhuma solicitação pendente.</p>}
        {pendentes.map((item) => {
          const recebido = item.origemSolicitacao === "RESPONSAVEL";
          const podeDecidir = recebido && dados?.podeResponderSolicitacoes;
          return <article key={item.id} className="mt-3 rounded-xl border border-gray-200 p-3">
            <p className="font-semibold">{item.responsavel.nome || item.responsavel.nomeDeUsuario}</p>
            <p className="text-xs text-gray-500">@{item.responsavel.nomeDeUsuario || "usuario"}</p>
            <p className="mt-2 text-sm text-gray-600">{recebido ? "Solicitou ser seu responsável." : "Aguardando resposta do responsável solicitado."}</p>
            {recebido && !podeDecidir && <p className="mt-2 text-sm text-amber-800">{temPrincipal ? "Aguardando aprovação do responsável principal." : "Este pedido depende do fluxo protegido de vinculação."}</p>}
            {podeDecidir && <div className="mt-3 flex gap-2">
              <button type="button" disabled={processando !== null} onClick={() => void responder(item.id, "aceitar")} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white disabled:opacity-50">Aceitar</button>
              <button type="button" disabled={processando !== null} onClick={() => void responder(item.id, "recusar")} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50">Recusar</button>
            </div>}
          </article>;
        })}
      </div>

      <div className="rounded-2xl border border-green-100 bg-white p-4">
        <h3 className="font-bold text-green-900">Solicitar responsável</h3>
        <p className="mt-1 text-sm text-gray-600">Informe o ID da conta que possui o papel Responsável. A vinculação exige confirmação.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={novoId} onChange={(event) => setNovoId(event.target.value)} placeholder="ID do usuário responsável" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" disabled={processando !== null || !buscaResponsavel || buscaResponsavel.id !== novoId.trim()} onClick={() => void solicitar()} className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Enviar solicitação</button>
        </div>
         {consultandoId && <p className="mt-2 text-xs text-gray-500">Verificando responsável...</p>}
         {idNaoEncontrado && <p className="mt-2 text-sm text-red-700">ID não encontrado ou a conta não possui o papel Responsável ativo.</p>}
         {buscaResponsavel && (
           <div className="mt-3 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
             {buscaResponsavel.foto ? <img src={buscaResponsavel.foto} alt={buscaResponsavel.nome} className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-200 font-bold">{buscaResponsavel.nome.slice(0, 1)}</div>}
             <div className="min-w-0 flex-1"><p className="truncate font-semibold text-green-950">{buscaResponsavel.nome}</p><p className="text-xs text-gray-600">@{buscaResponsavel.nomeDeUsuario || "usuario"}</p><p className="text-xs text-green-800">Conta de Responsável encontrada</p></div>
             <Link href={`/perfil/${encodeURIComponent(buscaResponsavel.id)}?papel=Responsavel`} className="text-xs font-semibold text-green-800 underline">Ver perfil</Link>
           </div>
         )}
      </div>
    </section>
  );
}