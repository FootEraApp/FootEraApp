// client/src/components/perfil/PerfilProfessor.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import {
  CalendarClock, Activity, PlusCircle, Filter, ChevronRight, Trophy,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";

type Props = { idDaUrl?: string };

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

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
  metrics: { treinosProgramados: number; alunosRelacionados: number; conquistas?: number };
};

type AtletaItem = {
  id: string;
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
};

type SolicitacaoItem = {
  id: string;
  atleta: AtletaItem;
  status: "PENDENTE" | "APROVADO" | "REJEITADO";
  criadaEm: string;
};

type AtividadeRecente = {
  id: string;
  tipo: "Treino" | "Desafio" | "Vídeo" | "Postagem";
  titulo: string;
  criadoEm: string;
  imagemUrl?: string | null;
};

/* ---------- UI helpers ---------- */
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

/* ---------- Component ---------- */
export default function PerfilProfessor({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadProfessor | null>(null);
  const [loading, setLoading] = useState(true);

  // abas topo
  type Aba = "visao" | "atletas" | "conquistas";
  const [aba, setAba] = useState<Aba>("visao");

  // sub-abas atletas
  type SubAba = "vinculados" | "observados" | "solicitacoes";
  const [subAba, setSubAba] = useState<SubAba>("vinculados");

  // listas (lazy)
  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[] | null>(null);
  const [atividades, setAtividades] = useState<AtividadeRecente[] | null>(null);

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

  // lazy loads por aba (ajuste as rotas quando integrar)
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
    if (aba === "visao" && atividades == null) fetchAtividades();

    async function fetchVinculados() {
      try {
        const { data } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/professores/${targetId}/atletas/vinculados`,
          { headers }
        );
        if (!cancel.v) setVinculados(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setVinculados([]);
      }
    }
    async function fetchObservados() {
      try {
        const { data } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/professores/${targetId}/atletas/observados`,
          { headers }
        );
        if (!cancel.v) setObservados(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }
    async function fetchSolicitacoes() {
      try {
        const { data } = await axios.get<SolicitacaoItem[]>(
          `${API.BASE_URL}/api/professores/${targetId}/solicitacoes`,
          { headers }
        );
        if (!cancel.v) setSolicitacoes(Array.isArray(data) ? data : []);
      } catch {
        if (!cancel.v) setSolicitacoes([]);
      }
    }

    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
      if (subAba === "solicitacoes" && solicitacoes == null) fetchSolicitacoes();
    }

    return () => { cancel.v = true; };
  }, [aba, subAba, targetId, token, atividades, vinculados, observados, solicitacoes]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.professor) return <div className="text-center p-10 text-red-600">Professor não encontrado.</div>;

  const nome = data.usuario?.nome || data.professor.nome;
  const headerFoto: string | undefined =
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    (typeof data.professor.fotoUrl === "string" && data.professor.fotoUrl) ||
    undefined;
  const time = data.professor.escola || "Professor";

  const conquistasCount = data.metrics.conquistas ?? 0;

  return (
    <div className="max-w-md mx-auto">
      {/* HEADER com KPIs do professor */}
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.professor.usuarioId || data.professor.id}
        kpis={[
          { label: "Alunos", value: data.metrics.alunosRelacionados ?? 0 },
          { label: "Treinos", value: data.metrics.treinosProgramados ?? 0 },
          { label: "Conquistas", value: conquistasCount },
        ]}
      />

      {/* TABS */}
      <div className="mt-4 px-4">
        <div className="bg-white/90 rounded-xl p-1 grid grid-cols-3 gap-1 border border-green-100">
          {[
            { id: "visao", label: "Visão Geral" },
            { id: "atletas", label: "Atletas" },
            { id: "conquistas", label: "Conquistas" },
          ].map(t => (
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

      {/* VISÃO GERAL */}
      {aba === "visao" && (
        <div className="mt-4 px-4 grid gap-4">
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

          <SectionCard
            title="Treinos"
            right={
              <div className="flex gap-2">
                <button className="text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900">
                  Ver todos
                </button>
                <button className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white inline-flex items-center gap-1">
                  <PlusCircle className="w-4 h-4" /> Criar novo treino
                </button>
              </div>
            }
          >
            <p className="text-sm text-green-900/90">Crie e gerencie seus treinos.</p>
          </SectionCard>

          <SectionCard title="Atividade Recente">
            {atividades && atividades.length > 0 ? (
              <ul className="space-y-3">
                {atividades.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <CalendarClock className="w-5 h-5 text-green-700" />
                    <div className="text-sm">
                      <div className="font-medium text-green-900">{a.titulo}</div>
                      <div className="text-xs text-green-900/70">{new Date(a.criadoEm).toLocaleString()}</div>
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

      {/* ATLETAS */}
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
              <SectionCard title="Atletas Vinculados">
                {vinculados && vinculados.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {vinculados.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                        <img
                          src={a.foto?.startsWith("http") ? a.foto! : `${API.BASE_URL}/uploads/${a.foto ?? ""}`}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/attached_assets/Perfil.jpg"; }}
                          className="w-10 h-10 rounded-full object-cover"
                          alt={a.nome}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">{a.nome}</div>
                          <div className="text-xs text-green-900/70">
                            {[a.posicao, a.idade ? `${a.idade} anos` : ""].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                        <button className="text-sm text-green-800 inline-flex items-center gap-1">
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div>
                    <EmptyState text="Nenhum atleta vinculado ainda" />
                    <div className="flex justify-center">
                      <button className="px-4 py-2 rounded-md border border-green-200 text-green-900">Ver atletas</button>
                    </div>
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
                      <li key={a.id} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                        <img
                          src={a.foto?.startsWith("http") ? a.foto! : `${API.BASE_URL}/uploads/${a.foto ?? ""}`}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/attached_assets/Perfil.jpg"; }}
                          className="w-10 h-10 rounded-full object-cover"
                          alt={a.nome}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">{a.nome}</div>
                          <div className="text-xs text-green-900/70">{a.posicao ?? "-"}</div>
                        </div>
                        <button className="text-sm text-green-800 inline-flex items-center gap-1">
                          Ver perfil <ChevronRight className="w-4 h-4" />
                        </button>
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
                  <button className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-green-200 text-green-900">
                    <Filter className="w-4 h-4" />
                    Filtrar
                  </button>
                }
              >
                {solicitacoes && solicitacoes.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3">
                    {solicitacoes.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
                        <img
                          src={s.atleta.foto?.startsWith("http") ? s.atleta.foto! : `${API.BASE_URL}/uploads/${s.atleta.foto ?? ""}`}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/attached_assets/Perfil.jpg"; }}
                          className="w-10 h-10 rounded-full object-cover"
                          alt={s.atleta.nome}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-green-900">{s.atleta.nome}</div>
                          <div className="text-xs text-green-900/70">{new Date(s.criadaEm).toLocaleString()} • {s.status}</div>
                        </div>
                        {s.status === "PENDENTE" ? (
                          <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white">Aprovar</button>
                            <button className="px-3 py-1.5 text-sm rounded-md bg-red-100 text-red-700">Rejeitar</button>
                          </div>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-800">{s.status}</span>
                        )}
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

      {/* CONQUISTAS */}
      {aba === "conquistas" && (
        <div className="mt-4 px-4 grid gap-4">
          <SectionCard title="Conquistas e Troféus">
            {conquistasCount > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(conquistasCount)].map((_, i) => (
                  <div key={i} className="rounded-xl p-4 border border-green-100 text-center">
                    <Trophy className="mx-auto mb-2" />
                    <div className="text-sm font-medium text-green-900">Conquista #{i + 1}</div>
                    <div className="text-xs text-green-900/70">do professor ou seus atletas</div>
                  </div>
                ))}
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
