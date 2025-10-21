import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { CalendarClock, Activity, PlusCircle, ChevronRight, Trophy } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import Avatar from "../shared/Avatar.js";

const ACHIEVEMENTS: Record<
  string,
  { title: string; desc: string; tier?: "Bronze" | "Prata" | "Ouro" }
> = {
  primeiro_treino_programado: {
    title: "Primeiro Treino Programado",
    desc: "Criou 1 treino programado.",
    tier: "Bronze",
  },
  serie_de_treinos: {
    title: "Série de Treinos",
    desc: "Criou 5 treinos programados.",
    tier: "Bronze",
  },
  planejamento_solido: {
    title: "Planejamento Sólido",
    desc: "Criou 10 treinos programados.",
    tier: "Prata",
  },
  grupo_inicial: {
    title: "Grupo Inicial",
    desc: "Treina 5 atletas (vínculo).",
    tier: "Bronze",
  },
  organizador_de_grupo: {
    title: "Organizador de Desafios em Grupo",
    desc: "Criou pelo menos 1 desafio em grupo.",
    tier: "Bronze",
  },
};
type Organizacao = { id: string; usuarioId?: string | null; nome: string; tipo: "Escolinha" | "Clube" };
type Props = { idDaUrl?: string };
type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };
type MetricsProf = {
  treinosProgramados: number;
  alunosRelacionados: number;
  conquistas?: number;            
  conquistasUnlocked?: string[];   
  gruposCriados?: number;        
};

type PayloadProfessor = {
  tipo: "Professor";
  usuario: UsuarioMin | null;
  professor: {
    id: string;
    usuarioId?: string | null;
    nome: string;
    codigo?: string | null;
    cref?: string | null;
    areaFormacao: string;
    escola?: string | null;
    qualificacoes: string[];
    certificacoes: string[];
    fotoUrl?: string | null;
    statusCref?: string | null;
  };
  metrics: MetricsProf;
};

type AtletaItem = {
  id: string;
  usuarioId: string;
  atletaId: string;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string;
  categoria?: string | null;
  pontuacao?: number | null;
};

type SolicitacaoItem = {
  id: string;
  remetenteId: string;
  remetente: {
    id: string;
    usuarioId: string;
    nomeDeUsuario: string;
    foto: string | null;
  };
  status?: "PENDENTE" | "APROVADO" | "REJEITADO";
  criadaEm?: string;
};

type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio";
  nome: string;       
  data: string;        
  imagemUrl?: string | null;
  duracao?: string;
  pontuacao?: number;
};

function SectionCard({
  title, children, right,
}: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
      <div className="px-4 py-3 flex items-center justify-between border-b border-green-100">
        <h3 className="font-semibold text-green-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

export default function PerfilProfessor({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const canEdit = isOwn;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadProfessor | null>(null);
  const [loading, setLoading] = useState(true);
  
  type Aba = "visao" | "atletas" | "conquistas";
  const [aba, setAba] = useState<Aba>("visao");

  type SubAba = "vinculados" | "observados" | "solicitacoes";
  const [subAba, setSubAba] = useState<SubAba>("vinculados");

  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[] | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);

  const [orgsDisponiveis, setOrgsDisponiveis] = useState<Organizacao[]>([]);
  const [orgsVinculadas, setOrgsVinculadas] = useState<Organizacao[]>([]);
  const [orgSelecionada, setOrgSelecionada] = useState<string>("");

  const professorId = data?.professor?.id;

  useEffect(() => {
  if (!token || !professorId) return;
  let cancel = false;

  (async () => {
    try {
        if (canEdit) {
          const tentativas = [
            `${API.BASE_URL}/api/organizacoes?tipos=Escolinha,Clube`,
            `${API.BASE_URL}/api/escolinhas`,
            `${API.BASE_URL}/api/clubes`,
          ];
          let lista: any[] = [];
          for (const url of tentativas) {
            const r = await axios.get(url, { headers });
            const arr = Array.isArray(r.data) ? r.data : (r.data.items ?? r.data.data ?? []);
            if (Array.isArray(arr) && arr.length) { lista = arr; break; }
          }
          const normalizada: Organizacao[] = (lista || []).map((o: any) => ({
            id: o.id,
            usuarioId: o.usuarioId ?? null,
            nome: o.nome ?? o.titulo ?? "Organização",
            tipo: (o.tipo ?? o.kind ?? o.categoria ?? "").toLowerCase().includes("clube") ? "Clube" : "Escolinha",
          })) as any;
          if (!cancel) setOrgsDisponiveis(normalizada);
        }

        const r = await axios.get(`${API.BASE_URL}/api/organizacoes`, {
          headers,
          params: { vinculadasAoProfessorId: professorId },
        }).catch(() => null);
        const arr = r ? (Array.isArray(r.data) ? r.data : (r.data?.items ?? r.data?.data ?? [])) : [];
        const vinculadas: Organizacao[] = (arr || []).map((o: any) => ({
          id: o.id, usuarioId: o.usuarioId ?? null,
          nome: o.nome ?? o.titulo ?? "Organização",
          tipo: (o.tipo ?? o.kind ?? o.categoria ?? "").toLowerCase().includes("clube") ? "Clube" : "Escolinha",
        })) as any;
        if (!cancel) {
          setOrgsVinculadas(vinculadas);
          if (canEdit && vinculadas?.length) setOrgSelecionada(String(vinculadas[0].id));
        }
    } catch (e) {
      if (!cancel) { setOrgsDisponiveis([]); setOrgsVinculadas([]); setOrgSelecionada(""); }
    }
  })();
    return () => { cancel = true; };
  }, [token, professorId, canEdit]);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadProfessor>(
          `${API.BASE_URL}/api/perfil/professor/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilProfessor GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  useEffect(() => {
    if (aba !== "atletas" || subAba !== "solicitacoes") return;

    const fetch = async () => {
      try {
        const { data } = await axios.get<SolicitacaoItem[]>(
          `${API.BASE_URL}/api/solicitacoes-treino`,
          { headers }
        );
        setSolicitacoes((Array.isArray(data) ? data : [])
          .filter(s => (s.status ?? "PENDENTE") === "PENDENTE"));
      } catch {
        setSolicitacoes([]);
      }
    };

    fetch();

    const onFocus = () => fetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [aba, subAba, token]);

 const fetchVinculados = useCallback(async () => {
   if (!token) return;
   const headers = { Authorization: `Bearer ${token}` };
   const tipoId        = isOwn ? Storage.tipoUsuarioId : data?.professor?.id;
   const usuarioTarget = isOwn ? Storage.usuarioId      : data?.usuario?.id;

   const candidates = [
     { professorId: tipoId, incluirPontuacao: 1 },
     { tipoUsuarioId: tipoId, incluirPontuacao: 1 },
     { usuarioId: usuarioTarget, incluirPontuacao: 1 },
   ].filter(p => Object.values(p)[0]);

   let lista: any[] = [];
   for (const params of candidates) {
     try {
       const r = await axios.get(`${API.BASE_URL}/api/treinos/atletas-vinculados`, { headers, params });
       const arr = Array.isArray(r.data) ? r.data : (r.data?.items ?? r.data?.data ?? []);
       if (Array.isArray(arr) && arr.length) { lista = arr; break; }
     } catch {}
   }

   const arr = (lista || []).map((x: any) => ({
     id:        x.id ?? x.atletaId ?? x.usuarioId,
     usuarioId: x.usuarioId ?? x.userId ?? x.usuario?.id ?? null,
     atletaId:  x.atletaId ?? x.atleta?.id ?? null,
     nome:      x.nome ?? x.usuario?.nome ?? x.atleta?.nome ?? x.nomeDeUsuario ?? "Atleta",
     foto:      x.foto ?? x.usuario?.foto ?? x.atleta?.foto ?? null,
     posicao:   x.posicao ?? x.atleta?.posicao ?? null,
     idade:     x.idade ?? x.atleta?.idade ?? null,
     categoria: x.categoria ?? x.atleta?.categoria ?? null,
     pontuacao: x.pontuacao ?? null,
   }));
   const seen = new Set<string>();
   const unique = arr.filter((a: any) => {
     const key = String(a.usuarioId || a.atletaId || a.id);
     if (seen.has(key)) return false;
     seen.add(key);
     return true;
   });
   setVinculados(unique);
 }, [token, isOwn, data?.professor?.id, data?.usuario?.id]);

  useEffect(() => {
    if (!token) return;
    if ((data?.professor?.id || data?.usuario?.id) && vinculados == null) {
      fetchVinculados();
    }
  },  [token, data?.professor?.id, data?.usuario?.id, vinculados, fetchVinculados]);

  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    async function fetchAtividades() {
      try {
        const { data } = await axios.get<AtividadeRecente[]>(
          `${API.BASE_URL}/api/perfil/${targetId}/atividades`,
          { headers }
        );
        if (!cancel.v) setAtividades(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setAtividades([]);
      }
    }

    async function fetchObservados() {
      const usuarioTarget = isOwn ? Storage.usuarioId : data?.usuario?.id;
      const tipoId        = isOwn ? Storage.tipoUsuarioId : data?.professor?.id;
      const params: any = { incluirPontuacao: 1 };
      if (usuarioTarget) params.usuarioId = usuarioTarget;
      if (tipoId)        params.tipoUsuarioId = tipoId;

      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          { headers, params }
        );
        setObservados(Array.isArray(lista) ? lista : []);
      } catch {
        setObservados([]);
      }
    }

    async function fetchSolicitacoes() {
      try {
        const { data } = await axios.get<SolicitacaoItem[]>(
          `${API.BASE_URL}/api/solicitacoes-treino`,
          { headers }
        );
        setSolicitacoes(
          Array.isArray(data) ? data.filter(s => (s.status ?? "PENDENTE") === "PENDENTE") : []
        );
      } catch {
        setSolicitacoes([]);
      }
    }

    if (aba === "visao") {
      if (atividades == null) fetchAtividades();
      if (vinculados == null) fetchVinculados();
    }

    if (aba === "atletas") {
      if (subAba === "vinculados")   fetchVinculados();
      if (subAba === "observados")   fetchObservados();
      if (subAba === "solicitacoes") fetchSolicitacoes();
    }
  }, [aba, subAba, token, targetId, data?.usuario?.id, data?.professor?.id, vinculados, atividades, fetchVinculados]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.professor) return <div className="text-center p-10 text-red-600">Professor não encontrado.</div>;

  const nome = data.usuario?.nome || data.professor.nome;
  const headerFoto: string | undefined =
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    (typeof data.professor.fotoUrl === "string" && data.professor.fotoUrl) ||
    undefined;
  const time = data.professor.escola || "Professor";
  const unlockedIds = data.metrics.conquistasUnlocked ?? [];

  const extraFromGrupos =
    (data.metrics.gruposCriados ?? 0) > 0 ? ["organizador_de_grupo"] : [];

  const unlockedFinal = Array.from(new Set([...unlockedIds, ...extraFromGrupos]));
  const conquistasCount = unlockedFinal.length;
  const alunosCount = (vinculados?.length ?? data.metrics.alunosRelacionados ?? 0);
  async function salvarVinculo() {
    if (!token || !professorId || !orgSelecionada) return;
    try {
      await axios.put(
        `${API.BASE_URL}/api/professores/${professorId}/vinculos`,
        { organizacaoId: orgSelecionada },
        { headers }
      );
      alert("Vínculo atualizado!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar vínculo.");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.professor.usuarioId || data.professor.id}
        kpis={[
          { label: "Alunos",   value: alunosCount },
          { label: "Treinos",  value: data.metrics.treinosProgramados ?? 0 },
          { label: "Conquistas", value: conquistasCount },
        ]}
      />

      <div className="mt-4 px-4">
        <div className="bg-white/90 rounded-xl p-1 grid grid-cols-3 gap-1 border border-green-100">
          {(canEdit
            ? [{ id:"visao",label:"Visão Geral"},{ id:"atletas",label:"Atletas"},{ id:"conquistas",label:"Conquistas"}]
            : [{ id:"visao",label:"Visão Geral"},{ id:"conquistas",label:"Conquistas"}]
          ).map(t => (
            <button
              key={t.id}
              onClick={() => setAba(t.id as Aba)}
              className={`py-2 rounded-lg text-sm font-medium ${
                aba === t.id ? "bg-green-600 text-white" : "text-green-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "visao" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard
            title="Vínculo com Escolinha/Clube"
           right={canEdit ? (
             <button onClick={salvarVinculo} className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white" disabled={!orgSelecionada}>
               Salvar vínculo
             </button>
           ) : null}
          >

           {canEdit ? (
             <div className="grid gap-2">
               <label className="text-sm">Selecione a organização onde você trabalha</label>
               <select className="border rounded px-3 py-2" value={orgSelecionada} onChange={(e) => setOrgSelecionada(e.target.value)}>
                 <option value="">— Nenhuma —</option>
                 {orgsDisponiveis.map((o) => <option key={o.id} value={o.id}>{o.nome} ({o.tipo})</option>)}
               </select>
               <p className="text-xs text-green-900/70">Esse vínculo permitirá ver os alunos da organização e montar “turmas”.</p>
             </div>
           ) : (
             <div className="grid gap-3">
               {orgsVinculadas.length ? orgsVinculadas.map((o) => (
                 <Link key={o.id} href={`/perfil/${o.usuarioId ?? o.id}`} className="flex items-center justify-between rounded-xl border border-green-100 p-3 hover:bg-green-50">
                   <div>
                     <div className="text-sm font-medium text-green-900">{o.nome}</div>
                     <div className="text-xs text-green-900/70">{o.tipo}</div>
                   </div>
                   <ChevronRight className="w-4 h-4 text-green-800" />
                 </Link>
               )) : <div className="text-sm text-green-900/70">Nenhum vínculo público.</div>}
             </div>
           )}

          </SectionCard>

          <SectionCard title="Informações do Professor">
            <ul className="text-sm text-green-900/90 space-y-2">
              <li><b>Nome:</b> {data.professor.nome}</li>
              {data.professor.codigo && <li><b>Código:</b> {data.professor.codigo}</li>}
              {data.professor.cref && <li><b>CREF:</b> {data.professor.cref}</li>}
              <li><b>Área de formação:</b> {data.professor.areaFormacao}</li>
              {data.professor.escola && <li><b>Escola:</b> {data.professor.escola}</li>}
              {data.professor.statusCref && <li><b>Status do CREF:</b> {data.professor.statusCref}</li>}
            </ul>
          </SectionCard>

          {!!(data.professor.qualificacoes?.length) && (
            <SectionCard title="Qualificações">
              <div className="flex flex-wrap gap-2">
                {data.professor.qualificacoes.map((q, i) => (
                  <span key={i} className="px-2 py-1 rounded-full bg-green-100 text-green-900 text-xs">{q}</span>
                ))}
              </div>
            </SectionCard>
          )}

          {!!(data.professor.certificacoes?.length) && (
            <SectionCard title="Certificações">
              <div className="flex flex-wrap gap-2">
                {data.professor.certificacoes.map((c, i) => (
                  <span key={i} className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs">{c}</span>
                ))}
              </div>
            </SectionCard>
          )}

        {canEdit && (
         <SectionCard
          title="Treinos"
          right={
            <div className="flex gap-2">
              <Link
                href="/treinos"
                className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900"
              >
                Ver todos
              </Link>

              <Link
                href="/treinos/novo"
                className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                Criar novo treino
              </Link>
            </div>
          }
        >
            <p className="text-sm text-green-900/90">
              Crie e gerencie treinos para seus atletas vinculados.
            </p>
          </SectionCard>
        )}
          <SectionCard title="Atividade Recente">
            {atividades && atividades.length > 0 ? (
              <ul className="space-y-3">
                {atividades.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <CalendarClock className="w-5 h-5 text-green-700" />
                    <div className="text-sm">
                      <div className="font-medium text-green-900">{a.nome}</div>
                      <div className="text-xs text-green-900/70">{new Date(a.data).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text="Nenhuma atividade recente" />
            )}
          </SectionCard>
        </div>
      )}

      {aba === "atletas" && (
        <div className="mt-4 px-4">
          <div className="bg-white/90 rounded-xl p-1 grid grid-cols-3 gap-1 border border-green-100">
            {[
              { id: "vinculados", label: "Vinculados" },
              { id: "observados", label: "Observados" },
              { id: "solicitacoes", label: "Solicitações" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setSubAba(t.id as SubAba)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.id ? "bg-green-600 text-white" : "text-green-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4">
            {subAba === "vinculados" && (
              <SectionCard
                title="Atletas Vinculados"
                right={
                  <Link href="/perfil/GerenciarAtletas" className="text-sm text-green-800">
                    Gerenciar Atletas
                  </Link>
                }
              >
                {vinculados && vinculados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {vinculados.map((a) => (
                      <li key={a.usuarioId} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                        
                        <Avatar
                          foto={a.foto ?? null}
                          alt={a.nome}
                          className="w-10 h-10"
                        />

                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">{a.nome}</div>
                          <div className="text-xs text-green-900/70">
                            {[a.posicao, a.idade ? `${a.idade} anos` : "",  a.categoria ? `Cat. ${a.categoria}` : "",
                              a.pontuacao != null ? `${a.pontuacao} pts` : ""].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                          <Link
                            href={`/perfil/${a.usuarioId}`}
                            className="text-sm text-green-800 inline-flex items-center gap-1"
                          >
                            Ver perfil <ChevronRight className="w-4 h-4" />
                          </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Nenhum atleta vinculado ainda" />
                    <Link
                      href="/explorar"
                      className="px-4 py-2 rounded-md border border-green-200 text-green-900 inline-block"
                    >
                      Ver atletas
                    </Link>
                  </div>
                )}
              </SectionCard>
            )}

            {subAba === "observados" && (
              <SectionCard
                title="Atletas Observados"
                right={
                  <button className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-500 text-white">
                    <PlusCircle className="w-4 h-4" />
                    Descobrir novos atletas
                  </button>
                }
              >
                {observados && observados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {observados.map((a) => (
                      <li key={a.usuarioId} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                        
                        <Avatar
                          foto={a.foto ?? null}
                          alt={a.nome}
                          className="w-10 h-10"
                        />

                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">{a.nome}</div>
                          <div className="text-xs text-green-900/70">
                            {[a.posicao, a.idade ? `${a.idade} anos` : "",  a.categoria ? `Cat. ${a.categoria}` : "",
                              a.pontuacao != null ? `${a.pontuacao} pts` : ""].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                        <Link
                          href={`/perfil/${a.usuarioId}`}
                          className="text-sm text-green-800 inline-flex items-center gap-1"
                        >
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Você ainda não observa nenhum atleta" />
                    <div className="flex justify-center">
                      <button className="px-4 py-2 rounded-md border border-green-200 text-green-900">Ver atletas observados</button>
                    </div>
                  </div>
                )}
              </SectionCard>
            )}

            {subAba === "solicitacoes" && (
              <SectionCard
                title="Solicitações de Atletas"
                right={
                  <Link href="/notificacoes" className="text-sm text-green-800">
                    Abrir notificações
                  </Link>
                }
              >
                {solicitacoes && solicitacoes.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {solicitacoes.map((s) => (

                      <li
                        key={s.id}
                        className="flex items-center gap-3 rounded-xl border border-green-100 p-3 hover:bg-green-50"
                      >
                        <Link
                          href={`/perfil/${s.remetenteId}`}
                          className="flex items-center gap-3 flex-1"
                        >
                          <Avatar
                            foto={s.remetente.foto ?? null}
                            alt={s.remetente.nomeDeUsuario}
                            className="w-10 h-10"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-green-900">
                              {s.remetente.nomeDeUsuario}
                            </div>
                            <div className="text-xs text-green-900/70">
                              {s.criadaEm ? new Date(s.criadaEm).toLocaleString() : "—"}
                              {s.status ? ` • ${s.status}` : ""}
                            </div>
                            <div className="text-xs text-green-900/80">
                              quer treinar junto com você
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-green-800" />
                        </Link>
                      </li>

                    ))}
                  </ul>
                ) : (
                  <EmptyState text="Nenhuma solicitação pendente de atletas" />
                )}
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {aba === "conquistas" && (
         <div className="mt-4 px-4 grid gap-4">
          <SectionCard
            title="Conquistas e Troféus"
            right={
              <Link href="/perfil/conquistas" className="text-sm text-green-800">
                Ver conquistas
              </Link>
            }
          >
           {unlockedFinal.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {unlockedFinal.map((id) => {
                  const a = ACHIEVEMENTS[id] ?? { title: id, desc: "" };
                  return (
                    <div key={id} className="rounded-xl p-4 border border-green-100 text-center">
                      <Trophy className="mx-auto mb-2" />
                      <div className="text-sm font-medium text-green-900">{a.title}</div>
                      <div className="text-xs text-green-900/70">{a.desc}</div>
                      {a.tier && (
                        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          {a.tier}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="Nenhuma conquista registrada ainda" />
            )}
          </SectionCard>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
