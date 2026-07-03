import React, { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import axios from "axios";
import { Link, useLocation } from "wouter";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

type TabKey = "dashboard" | "atletas" | "transferencias" | "badges" | "documentos";

type DashboardDTO = {
  totalAtletasFormados: number;
  totalTransferenciasComSolidariedade: number;
  totalArrecadadoSolidariedade: number;
  totalBadges: number;
};

type VinculoFormacaoDTO = {
  id: string;
  atletaId: string;
  atletaNome?: string | null;
  origem: "escolinha" | "clube" | "professor";
  origemId: string;
  inicio?: string | null;
  fim?: string | null;
  documentos?: string[] | null;
  observacoes?: string | null;
  createdAt: string;
};

type TransferenciaDTO = {
  id: string;
  atletaId: string;
  atletaNome?: string | null;
  deClubeId?: string | null;
  paraClubeId?: string | null;
  deClubeNome?: string | null;  
  paraClubeNome?: string | null; 
  data?: string | null;
  valorTransferencia: number;
  gerouSolidariedade: boolean;
  valorSolidariedade: number;
  createdAt: string;
};

type BadgeDTO = {
  id: string;
  nome: string;
  descricao?: string | null;
  icon?: string | null;
  iconUrl?: string | null;
  conquistadoEm?: string | null;
};

type DocumentoDTO = {
  id: string;
  atletaId: string;
  atletaNome?: string | null;
  descricao?: string | null;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  createdAt: string;
};

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FormadoresPage() {
  const [, setLocation] = useLocation();
  const token = Storage.token;

  const [tab, setTab] = useState<TabKey>("dashboard");

  const [dash, setDash] = useState<DashboardDTO | null>(null);
  const [vinculos, setVinculos] = useState<VinculoFormacaoDTO[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaDTO[]>([]);
  const [badges, setBadges] = useState<BadgeDTO[]>([]);
  const [docs, setDocs] = useState<DocumentoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNovoVinculo, setOpenNovoVinculo] = useState(false);
  const [openNovaTransf, setOpenNovaTransf] = useState(false);
  const [openUploadDocs, setOpenUploadDocs] = useState(false);

  const [novoVinculo, setNovoVinculo] = useState({
    atletaId: "",
    origem: "" as "Escolinha" | "Clube" | "",
    origemId: "",
    inicio: "",
    observacoes: "",
  });

  const [novaTransf, setNovaTransf] = useState({
    atletaId: "",
    deClubeId: "",
    paraClubeId: "",
    data: "",
    valorTransferencia: "",
  });

  const [uploadPayload, setUploadPayload] = useState<{
    atletaId: string;
    descricao: string;
    files: FileList | null;
  }>({ atletaId: "", descricao: "", files: null });

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [d, a, t, b] = await Promise.all([
        axios.get<DashboardDTO>(`${API.BASE_URL}/api/formadores/dashboard`, { headers }),
        axios.get<VinculoFormacaoDTO[]>(`${API.BASE_URL}/api/formadores/vinculos`, { headers }),
        axios.get<TransferenciaDTO[]>(`${API.BASE_URL}/api/formadores/transferencias`, { headers }),
        axios.get<BadgeDTO[]>(`${API.BASE_URL}/api/formadores/badges`, { headers }),
      ]);
      setDash(d.data);
      setVinculos(a.data);
      setTransferencias(t.data);
      setBadges(b.data);
      
      const docsRes = await axios.get<DocumentoDTO[]>(`${API.BASE_URL}/api/formadores/documentos`, { headers });
      setDocs(docsRes.data);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message ?? "Falha ao carregar dados de Formadores.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchAll();
  }, []);

  async function refreshDocs() {
    const docsRes = await axios.get<DocumentoDTO[]>(`${API.BASE_URL}/api/formadores/documentos`, { headers });
    setDocs(docsRes.data);
  }

  async function handleCriarVinculo(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        atletaId: novoVinculo.atletaId.trim(),
        origem: (novoVinculo.origem as "Escolinha" | "Clube") || "Escolinha",
        origemId: novoVinculo.origemId.trim(),
        inicio: novoVinculo.inicio || undefined,
        observacoes: novoVinculo.observacoes || undefined,
      };
      await axios.post(`${API.BASE_URL}/api/formadores/vinculos`, body, { headers });
      setOpenNovoVinculo(false);
      setNovoVinculo({ atletaId: "", origem: "", origemId: "", inicio: "", observacoes: "" });
      fetchAll();
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível registrar o vínculo.");
    }
  }

  async function handleCriarTransferencia(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        atletaId: novaTransf.atletaId.trim(),
        deClubeId: novaTransf.deClubeId || undefined,
        paraClubeId: novaTransf.paraClubeId || undefined,
        data: novaTransf.data || undefined,
        valorTransferencia: Number(novaTransf.valorTransferencia || 0),
      };
      await axios.post(`${API.BASE_URL}/api/formadores/transferencias`, body, { headers });
      setOpenNovaTransf(false);
      setNovaTransf({ atletaId: "", deClubeId: "", paraClubeId: "", data: "", valorTransferencia: "" });
      fetchAll();
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível registrar a transferência.");
    }
  }

  const fileUrl = (p: string) => new URL(p, API.BASE_URL).toString(); 

  async function handleUploadDocs(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!uploadPayload.files || !uploadPayload.files.length) {
        return toast.error("Selecione ao menos um arquivo.");
      }
      const fd = new FormData();
      fd.append("atletaId", uploadPayload.atletaId.trim());
      if (uploadPayload.descricao) fd.append("descricao", uploadPayload.descricao);
      Array.from(uploadPayload.files).forEach((f) => fd.append("files", f));

      await axios.post(`${API.BASE_URL}/api/formadores/upload`, fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });

      setOpenUploadDocs(false);
      setUploadPayload({ atletaId: "", descricao: "", files: null });
      await refreshDocs();
      setTab("documentos");
    } catch (e: any) {
      console.error(e);
      toast.error("Falha no upload.");
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF8E6]">
      <div className="bg-emerald-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else setLocation("/perfil");
            }}
            className="text-white opacity-90 hover:opacity-100"
          >
            ← Voltar
          </button>
          <span className="text-2xl font-semibold flex items-center gap-2">
            <span className="inline-block rounded-full border border-white/40 p-1">🛡️</span>
            FootEra Formadores
          </span>
        </div>

        <div className="max-w-6xl mx-auto px-3">
          <div className="flex gap-2 pb-2">
            {(["dashboard", "atletas", "transferencias", "badges", "documentos"] as TabKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded ${tab === k ? "bg-white text-emerald-900 font-medium" : "text-white/90 hover:bg-white/10"}`}
              >
                {k === "dashboard" && "Dashboard"}
                {k === "atletas" && "Atletas"}
                {k === "transferencias" && "Transferências"}
                {k === "badges" && "Badges"}
                {k === "documentos" && "Documentos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === "dashboard" && (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashCard title="Atletas Formados" subtitle="Total registrado"><Stat value={dash?.totalAtletasFormados ?? 0} /></DashCard>
              <DashCard title="Transferências" subtitle="Geraram solidariedade"><Stat value={dash?.totalTransferenciasComSolidariedade ?? 0} /></DashCard>
              <DashCard title="Total Arrecadado" subtitle="Em solidariedade FIFA"><div className="text-2xl font-bold">{currency(dash?.totalArrecadadoSolidariedade ?? 0)}</div></DashCard>
              <DashCard title="Badges Conquistados" subtitle="Reconhecimentos"><Stat value={dash?.totalBadges ?? 0} /></DashCard>
            </div>

            <div className="mt-6 border rounded-2xl bg-white/70">
              <div className="px-5 py-4 text-2xl font-semibold">🔔 Sistema FootEra Formadores</div>
              <div className="px-5 pb-5 space-y-3">
                <InfoPill
                  dotClass="bg-emerald-500"
                  title="Sistema de Registro"
                  desc="Documento vínculos de formação de atletas"
                  onClick={() => setTab("documentos")}
                />
                <InfoPill
                  dotClass="bg-blue-500"
                  title="Upload de Documentos"
                  desc="Organize comprovantes de formação dos atletas"
                  onClick={() => setOpenUploadDocs(true)}
                />
              </div>
            </div>

            <div className="mt-4 border rounded-2xl bg-white/70">
              <div className="px-5 py-3 text-lg font-semibold">➕ Ações Rápidas</div>
              <div className="px-5 pb-5 flex flex-col gap-2">
                <ActionRow label="Registrar Novo Vínculo" onClick={() => setOpenNovoVinculo(true)} />
                <ActionRow label="Upload de Documentos" onClick={() => setOpenUploadDocs(true)} />
                <ActionRow label="Calcular Solidariedade" onClick={() => setOpenNovaTransf(true)} />
              </div>
            </div>
          </section>
        )}

        {tab === "atletas" && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Atletas Formados</h2>
              <button className="bg-emerald-800 text-white rounded px-3 py-2" onClick={() => setOpenNovoVinculo(true)}>+ Registrar</button>
            </div>
            {loading ? (
              <EmptyCard>Carregando…</EmptyCard>
            ) : vinculos.length === 0 ? (
              <EmptyCard>
                <div className="text-center space-y-3">
                  <div className="text-5xl opacity-40">👥</div>
                  <p className="text-gray-600">Nenhum vínculo de formação registrado ainda.</p>
                  <button className="bg-emerald-800 text-white rounded px-4 py-2" onClick={() => setOpenNovoVinculo(true)}>+ Registrar Primeiro Vínculo</button>
                </div>
              </EmptyCard>
            ) : (
              <div className="mt-4 grid gap-3">
                {vinculos.map((v) => (
                  <div key={v.id} className="border rounded-xl bg-white p-4">
                    <div className="font-semibold">{v.atletaNome ?? v.atletaId}</div>
                    <div className="text-sm text-gray-600">
                      Origem: {v.origem} • Início: {v.inicio ? new Date(v.inicio).toLocaleDateString() : "—"}
                      {v.observacoes ? <> • Obs: {v.observacoes}</> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "transferencias" && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Transferências</h2>
              <button className="bg-emerald-800 text-white rounded px-3 py-2" onClick={() => setOpenNovaTransf(true)}>+ Registrar</button>
            </div>
            {loading ? (
              <EmptyCard>Carregando…</EmptyCard>
            ) : transferencias.length === 0 ? (
              <EmptyCard>
                <div className="text-center space-y-3">
                  <p className="text-gray-600">Nenhuma transferência registrada ainda.</p>
                  <p className="text-gray-500 text-sm">As transferências de seus atletas formados aparecerão aqui.</p>
                </div>
              </EmptyCard>
            ) : (
              <div className="mt-4 grid gap-3">
                {transferencias.map((t) => (
                  <div key={t.id} className="border rounded-xl bg-white p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{t.atletaNome ?? t.atletaId}</div>
                      <div className="text-sm text-gray-600">
                        Valor: {currency(t.valorTransferencia)} • Solidariedade: {t.gerouSolidariedade ? currency(t.valorSolidariedade) : "—"} • {t.data ? new Date(t.data).toLocaleDateString() : "Data —"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.deClubeNome ? `De ${t.deClubeNome} ` : t.deClubeId ? `De ${t.deClubeId} ` : ""}
                      {t.paraClubeNome ? `→ ${t.paraClubeNome}` : t.paraClubeId ? `→ ${t.paraClubeId}` : ""}
                    </div>  
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "badges" && (
          <section>
            <h2 className="text-2xl font-semibold">Badges de Reconhecimento</h2>
            {loading ? (
              <EmptyCard>Carregando…</EmptyCard>
            ) : badges.length === 0 ? (
              <EmptyCard>
                <div className="text-center space-y-2">
                  <div className="text-5xl opacity-40">🎖️</div>
                  <p className="text-gray-600">Nenhum badge conquistado ainda.</p>
                  <p className="text-gray-500 text-sm">Registre vínculos de formação para começar a conquistar badges.</p>
                </div>
              </EmptyCard>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {badges.map((b) => (
                  <div key={b.id} className="border rounded-xl bg-white p-4">
                    <div className="text-2xl">{b.icon ?? "🏅"}</div>
                    <div className="font-semibold">{b.nome}</div>
                    {b.descricao ? <div className="text-sm text-gray-600">{b.descricao}</div> : null}
                    {b.conquistadoEm ? <div className="text-xs text-gray-500 mt-1">Conquistado em {new Date(b.conquistadoEm).toLocaleDateString()}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "documentos" && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Documentos Enviados</h2>
              <button className="bg-emerald-800 text-white rounded px-3 py-2" onClick={() => setOpenUploadDocs(true)}>+ Enviar</button>
            </div>
            {loading ? (
              <EmptyCard>Carregando…</EmptyCard>
            ) : docs.length === 0 ? (
              <EmptyCard>
                <div className="text-center space-y-2">
                  <p className="text-gray-600">Nenhum documento enviado ainda.</p>
                  <p className="text-gray-500 text-sm">Use “Upload de Documentos” para anexar comprovantes.</p>
                </div>
              </EmptyCard>
            ) : (
              <div className="mt-4 grid gap-3">
                {docs.map((d) => (
                  <div key={d.id} className="border rounded-xl bg-white p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{d.originalName}</div>
                      <div className="text-sm text-gray-600">
                        Atleta: {d.atletaNome ?? d.atletaId} • {new Date(d.createdAt).toLocaleString()} • {(d.size / 1024).toFixed(0)} KB
                        {d.descricao ? <> • {d.descricao}</> : null}
                      </div>
                    </div>
                    <a
                      className="text-emerald-800 underline"
                      href={fileUrl(d.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {openNovoVinculo && (
        <Modal onClose={() => setOpenNovoVinculo(false)} title="Registrar Vínculo de Formação">
          <form className="space-y-3" onSubmit={handleCriarVinculo}>
            <Input label="ID do Atleta" value={novoVinculo.atletaId} onChange={(e) => setNovoVinculo((s) => ({ ...s, atletaId: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Origem</label>
                <select className="mt-1 w-full border rounded px-3 py-2" value={novoVinculo.origem} onChange={(e) => setNovoVinculo((s) => ({ ...s, origem: e.target.value as any }))} required>
                  <option value="" disabled>Selecione</option>
                  <option value="Escolinha">Escolinha</option>
                  <option value="Clube">Clube</option>
                </select>
              </div>
              <Input label="ID da Origem" value={novoVinculo.origemId} onChange={(e) => setNovoVinculo((s) => ({ ...s, origemId: e.target.value }))} required />
            </div>
            <Input label="Data de início" type="date" value={novoVinculo.inicio} onChange={(e) => setNovoVinculo((s) => ({ ...s, inicio: e.target.value }))} />
            <div>
              <label className="text-sm font-medium">Observações</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={novoVinculo.observacoes} onChange={(e) => setNovoVinculo((s) => ({ ...s, observacoes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenNovoVinculo(false)}>Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-emerald-700 text-white">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {openNovaTransf && (
        <Modal onClose={() => setOpenNovaTransf(false)} title="Registrar Transferência">
          <form className="space-y-3" onSubmit={handleCriarTransferencia}>
            <Input label="ID do Atleta" value={novaTransf.atletaId} onChange={(e) => setNovaTransf((s) => ({ ...s, atletaId: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="De (ClubeId)" value={novaTransf.deClubeId} onChange={(e) => setNovaTransf((s) => ({ ...s, deClubeId: e.target.value }))} />
              <Input label="Para (ClubeId)" value={novaTransf.paraClubeId} onChange={(e) => setNovaTransf((s) => ({ ...s, paraClubeId: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Data" type="date" value={novaTransf.data} onChange={(e) => setNovaTransf((s) => ({ ...s, data: e.target.value }))} />
              <Input label="Valor da Transferência (R$)" type="number" min="0" step="0.01" value={novaTransf.valorTransferencia} onChange={(e) => setNovaTransf((s) => ({ ...s, valorTransferencia: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenNovaTransf(false)}>Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-emerald-700 text-white">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {openUploadDocs && (
        <Modal onClose={() => setOpenUploadDocs(false)} title="Upload de Documentos">
          <form className="space-y-3" onSubmit={handleUploadDocs}>
            <Input label="ID do Atleta" value={uploadPayload.atletaId} onChange={(e) => setUploadPayload((s) => ({ ...s, atletaId: e.target.value }))} required />
            <div>
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={uploadPayload.descricao} onChange={(e) => setUploadPayload((s) => ({ ...s, descricao: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Arquivos (png, jpg, pdf, docx, pptx, xlsx…)</label>
              <input
                type="file"
                multiple
                className="mt-1 w-full border rounded px-3 py-2"
                onChange={(e) => setUploadPayload((s) => ({ ...s, files: e.target.files }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpenUploadDocs(false)}>Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-emerald-700 text-white">Enviar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function DashCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-1">{children}</div>
      {subtitle ? <div className="text-xs text-gray-500 mt-1">{subtitle}</div> : null}
    </div>
  );
}
function Stat({ value }: { value: number }) {
  return <div className="text-3xl font-bold">{value}</div>;
}
function InfoPill({ dotClass, title, desc, onClick }: { dotClass: string; title: string; desc: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl border bg-white px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
      <span className={`mt-1 h-3 w-3 rounded-full ${dotClass}`} />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-gray-600">{desc}</div>
      </div>
    </button>
  );
}
function ActionRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="border rounded-xl bg-white px-4 py-3 text-left hover:bg-gray-50">
      + {label}
    </button>
  );
}
function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 border rounded-2xl bg-white p-8">{children}</div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-2xl w-[95%] max-w-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input {...rest} className="mt-1 w-full border rounded px-3 py-2" />
    </div>
  );
}