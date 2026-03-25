// client/src/pages/learning/create.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  Video,
  Dumbbell,
  FileText,
  Trophy,
} from "lucide-react";
import {
  createMetodologia,
  createMetodologiaEstruturas,
  createMetodologiaEstruturaItens,
  uploadMetodologiaFile,
  type LearningEstruturaInput,
  type LearningEstruturaItemInput,
  type LearningEstruturaTipo,
  type LearningItemTipo,
  type LearningMetodoTipo,
  type LearningModoExecucao,
} from "../../services/metodologias.js";
import LearningHeader from "../../components/learning/LearningHeader.js";
import LearningTypeChooser from "../../components/learning/LearningTypeChooser.js";

type AreaOption =
  | "TECNICO"
  | "FISICO"
  | "TATICO"
  | "MENTAL"
  | "GOLEIROS"
  | "PSICOLOGIA"
  | "INOVACAO"
  | "ANALISE_DESEMPENHO"
  | "OUTRO";

type PublicoOption = "ATLETAS" | "PROFISSIONAIS" | "AMBOS";

type LocalItem = LearningEstruturaItemInput & {
  localId: string;
  uploading?: boolean;
};

type LocalEstrutura = LearningEstruturaInput & {
  localId: string;
  expanded: boolean;
  itens: LocalItem[];
};

const DURACOES = [2, 4, 6, 8];
const MODOS: { value: LearningModoExecucao; label: string }[] = [
  { value: "LIVRE", label: "Livre" },
  { value: "PRAZO_SUGERIDO", label: "Com prazo sugerido" },
  { value: "DESAFIO_FECHADO", label: "Desafio fechado" },
];

const AREAS: { value: AreaOption; label: string }[] = [
  { value: "TECNICO", label: "Técnico" },
  { value: "FISICO", label: "Físico" },
  { value: "TATICO", label: "Tático" },
  { value: "MENTAL", label: "Mental" },
  { value: "GOLEIROS", label: "Goleiros" },
  { value: "PSICOLOGIA", label: "Psicologia" },
  { value: "INOVACAO", label: "Inovação" },
  { value: "ANALISE_DESEMPENHO", label: "Análise de desempenho" },
  { value: "OUTRO", label: "Outro" },
];

const PUBLICOS: { value: PublicoOption; label: string }[] = [
  { value: "ATLETAS", label: "Para atletas" },
  { value: "PROFISSIONAIS", label: "Para profissionais" },
  { value: "AMBOS", label: "Ambos" },
];

const ITEM_TYPES_TRILHA: { value: LearningItemTipo; label: string; icon: React.ReactNode }[] = [
  { value: "TREINO", label: "Treino", icon: <Dumbbell className="w-4 h-4" /> },
  { value: "VIDEO", label: "Vídeo", icon: <Video className="w-4 h-4" /> },
  { value: "DESAFIO", label: "Desafio", icon: <Trophy className="w-4 h-4" /> },
];

const ITEM_TYPES_MODULO: { value: LearningItemTipo; label: string; icon: React.ReactNode }[] = [
  { value: "AULA", label: "Aula", icon: <Video className="w-4 h-4" /> },
  { value: "VIDEO", label: "Vídeo", icon: <Video className="w-4 h-4" /> },
  { value: "MATERIAL", label: "Material", icon: <FileText className="w-4 h-4" /> },
  { value: "DESAFIO", label: "Desafio", icon: <Trophy className="w-4 h-4" /> },
];

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function emptyItem(tipo: LearningItemTipo = "VIDEO"): LocalItem {
  return {
    localId: uid("item"),
    titulo: "",
    descricao: "",
    tipo,
    ordem: undefined,
    videoUrl: "",
    thumbUrl: "",
    arquivoUrl: "",
    materialUrl: "",
    treinoProgramadoId: "",
    pontos: null,
    duracaoMin: null,
    obrigatorio: true,
    publicado: true,
  };
}

function emptyEstrutura(tipo: LearningEstruturaTipo): LocalEstrutura {
  const isTrilha = tipo === "TRILHA";

  return {
    localId: uid("estrutura"),
    expanded: true,
    tipo,
    titulo: "",
    descricao: "",
    objetivo: "",
    ordem: undefined,
    duracaoSemanas: isTrilha ? 4 : null,
    treinosPorSemana: isTrilha ? 3 : null,
    quantidadeMinConclusao: isTrilha ? 12 : null,
    modoExecucao: isTrilha ? "DESAFIO_FECHADO" : null,
    pontosPorItem: isTrilha ? 10 : null,
    bonusConsistencia: isTrilha ? 20 : null,
    bonusFinal: isTrilha ? 50 : null,
    prazoFinal: null,
    permiteAtraso: true,
    ativo: true,
    itens: [emptyItem(isTrilha ? "TREINO" : "AULA")],
  };
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <div className="text-[15px] font-bold text-[#193b2e]">{title}</div>
      {subtitle ? (
        <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>
      ) : null}
    </div>
  );
}

function ChipButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 h-10 text-sm font-medium transition ${
        active
          ? "bg-[#216c43] text-white border-[#216c43]"
          : "bg-white text-slate-700 border-slate-300 hover:border-[#216c43]"
      }`}
    >
      {children}
    </button>
  );
}

export default function LearningCreatePage() {
  const [location, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [tipoMetodologia, setTipoMetodologia] = useState<LearningMetodoTipo | null>(null);
  const [estruturaTipo, setEstruturaTipo] = useState<LearningEstruturaTipo | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState<PublicoOption>("AMBOS");
  const [area, setArea] = useState<AreaOption>("TECNICO");
  const [geraCertificado, setGeraCertificado] = useState(false);
  const [geraBadge, setGeraBadge] = useState(false);
  const [capaUrl, setCapaUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);

  const [estruturas, setEstruturas] = useState<LocalEstrutura[]>([]);

  const itemTypeOptions = useMemo(
    () => (estruturaTipo === "TRILHA" ? ITEM_TYPES_TRILHA : ITEM_TYPES_MODULO),
    [estruturaTipo]
  );

  useEffect(() => {
    const q = location.split("?")[1] ?? "";
    const params = new URLSearchParams(q);
    const tipo = params.get("tipo");

    if (tipo === "TRILHAS_TREINO") {
        setTipoMetodologia("TRILHAS_TREINO");
        setEstruturaTipo("TRILHA");
        setEstruturas([emptyEstrutura("TRILHA")]);
        setStep(2);
        return;
    }

    if (tipo === "CURSO_FORMACAO") {
        setTipoMetodologia("CURSO_FORMACAO");
        setEstruturaTipo("MODULO");
        setEstruturas([emptyEstrutura("MODULO")]);
        setStep(2);
    }
    }, [location]);

  function escolherTipo(tipo: LearningMetodoTipo, estrutura: LearningEstruturaTipo) {
    setTipoMetodologia(tipo);
    setEstruturaTipo(estrutura);
    setEstruturas([emptyEstrutura(estrutura)]);
    setStep(2);
  }

  function addEstrutura() {
    if (!estruturaTipo) return;
    setEstruturas((prev) => [...prev, emptyEstrutura(estruturaTipo)]);
  }

  function removeEstrutura(localId: string) {
    setEstruturas((prev) => prev.filter((e) => e.localId !== localId));
  }

  function updateEstrutura(localId: string, patch: Partial<LocalEstrutura>) {
    setEstruturas((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e))
    );
  }

  function addItem(estruturaLocalId: string, tipo?: LearningItemTipo) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? { ...e, itens: [...e.itens, emptyItem(tipo || (e.tipo === "TRILHA" ? "TREINO" : "AULA"))] }
          : e
      )
    );
  }

  function updateItem(
    estruturaLocalId: string,
    itemLocalId: string,
    patch: Partial<LocalItem>
  ) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? {
              ...e,
              itens: e.itens.map((it) =>
                it.localId === itemLocalId ? { ...it, ...patch } : it
              ),
            }
          : e
      )
    );
  }

  function removeItem(estruturaLocalId: string, itemLocalId: string) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? { ...e, itens: e.itens.filter((it) => it.localId !== itemLocalId) }
          : e
      )
    );
  }

  async function handleCoverUpload(file: File) {
    try {
      setUploadingCover(true);
      const up = await uploadMetodologiaFile(file);
      setCapaUrl(up.url);
    } catch (e: any) {
      alert(e?.message || "Falha ao enviar capa.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleItemFileUpload(
    estruturaLocalId: string,
    itemLocalId: string,
    file: File,
    target: "videoUrl" | "arquivoUrl" | "materialUrl"
  ) {
    try {
      updateItem(estruturaLocalId, itemLocalId, { uploading: true });
      const up = await uploadMetodologiaFile(file);
      updateItem(estruturaLocalId, itemLocalId, {
        [target]: up.url,
        uploading: false,
      } as Partial<LocalItem>);
    } catch (e: any) {
      updateItem(estruturaLocalId, itemLocalId, { uploading: false });
      alert(e?.message || "Falha ao enviar arquivo.");
    }
  }

  function validar() {
    if (!tipoMetodologia || !estruturaTipo) {
      alert("Escolha o tipo da metodologia.");
      return false;
    }

    if (!titulo.trim()) {
      alert("Informe o nome da metodologia.");
      return false;
    }

    if (!estruturas.length) {
      alert("Adicione pelo menos uma trilha ou módulo.");
      return false;
    }

    for (const [indexEstrutura, estrutura] of estruturas.entries()) {
      if (!estrutura.titulo?.trim()) {
        alert(`Preencha o título da ${estruturaTipo === "TRILHA" ? "trilha" : "módulo"} ${indexEstrutura + 1}.`);
        return false;
      }

      if (estruturaTipo === "TRILHA") {
        if (!estrutura.duracaoSemanas || estrutura.duracaoSemanas <= 0) {
          alert(`Defina a duração da trilha "${estrutura.titulo || indexEstrutura + 1}".`);
          return false;
        }
        if (!estrutura.treinosPorSemana || estrutura.treinosPorSemana <= 0) {
          alert(`Defina os treinos por semana da trilha "${estrutura.titulo || indexEstrutura + 1}".`);
          return false;
        }
      }

      if (!estrutura.itens.length) {
        alert(`Adicione ao menos um item em "${estrutura.titulo || indexEstrutura + 1}".`);
        return false;
      }

      for (const [indexItem, item] of estrutura.itens.entries()) {
        if (!item.titulo?.trim()) {
          alert(`Preencha o título do item ${indexItem + 1} da estrutura "${estrutura.titulo}".`);
          return false;
        }

        if ((item.tipo === "VIDEO" || item.tipo === "AULA") && !item.videoUrl?.trim()) {
          alert(`O item "${item.titulo}" precisa ter vídeo.`);
          return false;
        }

        if (item.tipo === "MATERIAL" && !item.arquivoUrl?.trim() && !item.materialUrl?.trim()) {
          alert(`O item "${item.titulo}" precisa ter arquivo ou link do material.`);
          return false;
        }

        if (item.tipo === "TREINO" && !item.treinoProgramadoId?.trim()) {
          alert(`O item "${item.titulo}" precisa do ID do treino programado.`);
          return false;
        }
      }
    }

    return true;
  }

  async function salvarTudo() {
    if (!validar() || !tipoMetodologia || !estruturaTipo) return;

    try {
      setSaving(true);

      const metodologiaResp = await createMetodologia({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        capaUrl: capaUrl.trim() || null,
        publicoAlvo,
        tipo: tipoMetodologia,
        estruturaTipo,
        area,
        geraBadge,
        geraCertificado,
        ativo: true,
      });

      const metodologiaId = metodologiaResp?.item?.id;
      if (!metodologiaId) throw new Error("Não foi possível criar a metodologia.");

      for (let i = 0; i < estruturas.length; i++) {
        const estrutura = estruturas[i];

        const estruturaResp = await createMetodologiaEstruturas(metodologiaId, {
          titulo: estrutura.titulo.trim(),
          descricao: estrutura.descricao?.trim() || null,
          objetivo: estrutura.objetivo?.trim() || null,
          tipo: estruturaTipo,
          ordem: i + 1,
          duracaoSemanas: estruturaTipo === "TRILHA" ? Number(estrutura.duracaoSemanas || 0) : null,
          treinosPorSemana: estruturaTipo === "TRILHA" ? Number(estrutura.treinosPorSemana || 0) : null,
          quantidadeMinConclusao:
            estruturaTipo === "TRILHA" ? Number(estrutura.quantidadeMinConclusao || 0) : null,
          modoExecucao: estruturaTipo === "TRILHA" ? estrutura.modoExecucao || null : null,
          pontosPorItem: estruturaTipo === "TRILHA" ? Number(estrutura.pontosPorItem || 0) : null,
          bonusConsistencia:
            estruturaTipo === "TRILHA" ? Number(estrutura.bonusConsistencia || 0) : null,
          bonusFinal: estruturaTipo === "TRILHA" ? Number(estrutura.bonusFinal || 0) : null,
          prazoFinal: estrutura.prazoFinal || null,
          permiteAtraso: !!estrutura.permiteAtraso,
          ativo: true,
        });

        const estruturaId = estruturaResp?.estruturas?.[0]?.id;
        if (!estruturaId) {
          throw new Error(`Falha ao criar a estrutura "${estrutura.titulo}".`);
        }

        await createMetodologiaEstruturaItens(metodologiaId, estruturaId, {
          itens: estrutura.itens.map((item, itemIndex) => ({
            titulo: item.titulo.trim(),
            descricao: item.descricao?.trim() || null,
            tipo: item.tipo,
            ordem: itemIndex + 1,
            videoUrl: item.videoUrl?.trim() || null,
            thumbUrl: item.thumbUrl?.trim() || null,
            arquivoUrl: item.arquivoUrl?.trim() || null,
            materialUrl: item.materialUrl?.trim() || null,
            duracaoMin: item.duracaoMin ? Number(item.duracaoMin) : null,
            treinoProgramadoId: item.treinoProgramadoId?.trim() || null,
            pontos: item.pontos ? Number(item.pontos) : null,
            obrigatorio: item.obrigatorio !== false,
            publicado: item.publicado !== false,
          })),
        });
      }

      alert("Metodologia criada com sucesso!");
      navigate(`/learning/${metodologiaId}`);
    } catch (e: any) {
      alert(e?.message || "Erro ao criar metodologia.");
    } finally {
      setSaving(false);
    }
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#f6f6f3] pb-16">
        <div className="max-w-3xl mx-auto px-4 pt-5">
          <LearningHeader
            title="Criar Metodologia"
            backHref="/learning"
          />
          <LearningTypeChooser onChoose={escolherTipo} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-5">
        <LearningHeader
            title={estruturaTipo === "TRILHA" ? "Nova Trilha" : "Novo Curso"}
            subtitle="Monte sua metodologia no novo formato de Learning."
            backHref="/learning"
        />

        <div className="space-y-4">
          <div className="rounded-[20px] bg-white border border-slate-200 shadow-sm p-4">
            <SectionTitle
              title="Informações da metodologia"
              subtitle="Esses dados aparecem na capa e nas listagens."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nome da metodologia
                </label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Método Keeper Academy"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#216c43]/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o objetivo da metodologia"
                  className="w-full min-h-[100px] rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#216c43]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Público
                </label>
                <select
                  value={publicoAlvo}
                  onChange={(e) => setPublicoAlvo(e.target.value as PublicoOption)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white outline-none"
                >
                  {PUBLICOS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Área
                </label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value as AreaOption)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white outline-none"
                >
                  {AREAS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Capa da metodologia
                </label>

                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                    <Upload className="w-4 h-4" />
                    {uploadingCover ? "Enviando..." : "Enviar capa"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverUpload(file);
                      }}
                    />
                  </label>

                  <input
                    value={capaUrl}
                    onChange={(e) => setCapaUrl(e.target.value)}
                    placeholder="Ou cole a URL da capa"
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={geraCertificado}
                    onChange={(e) => setGeraCertificado(e.target.checked)}
                  />
                  Gerar certificado
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={geraBadge}
                    onChange={(e) => setGeraBadge(e.target.checked)}
                  />
                  Gerar badge
                </label>
              </div>
            </div>
          </div>

          {estruturas.map((estrutura, index) => (
            <div
              key={estrutura.localId}
              className="rounded-[20px] bg-white border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-4 flex items-center justify-between border-b border-slate-100">
                <div>
                  <div className="text-lg font-extrabold text-[#193b2e]">
                    {estruturaTipo === "TRILHA" ? `Trilha ${index + 1}` : `Módulo ${index + 1}`}
                  </div>
                  <div className="text-sm text-slate-500">
                    {estrutura.titulo?.trim() || "Sem título ainda"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateEstrutura(estrutura.localId, { expanded: !estrutura.expanded })
                    }
                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600"
                  >
                    {estrutura.expanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeEstrutura(estrutura.localId)}
                    className="h-10 w-10 rounded-xl border border-red-200 text-red-600 flex items-center justify-center"
                    disabled={estruturas.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {estrutura.expanded ? (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Nome da {estruturaTipo === "TRILHA" ? "trilha" : "módulo"}
                      </label>
                      <input
                        value={estrutura.titulo || ""}
                        onChange={(e) =>
                          updateEstrutura(estrutura.localId, { titulo: e.target.value })
                        }
                        placeholder={
                          estruturaTipo === "TRILHA"
                            ? "Ex.: Explosão e Impulsão"
                            : "Ex.: Módulo 1 - Fundamentos"
                        }
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Objetivo da {estruturaTipo === "TRILHA" ? "trilha" : "estrutura"}
                      </label>
                      <textarea
                        value={estrutura.objetivo || ""}
                        onChange={(e) =>
                          updateEstrutura(estrutura.localId, { objetivo: e.target.value })
                        }
                        placeholder={
                          estruturaTipo === "TRILHA"
                            ? "Desenvolver a impulsão e o poder explosivo nos goleiros."
                            : "Explique o que o aluno vai aprender neste módulo."
                        }
                        className="w-full min-h-[96px] rounded-xl border border-slate-300 px-4 py-3 outline-none"
                      />
                    </div>

                    {estruturaTipo === "TRILHA" ? (
                      <>
                        <div className="md:col-span-2 mt-1">
                          <SectionTitle
                            title="Plano de execução"
                            subtitle="Configure o ciclo e a gamificação da trilha."
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Duração do ciclo
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {DURACOES.map((dur) => (
                              <ChipButton
                                key={dur}
                                active={Number(estrutura.duracaoSemanas) === dur}
                                onClick={() =>
                                  updateEstrutura(estrutura.localId, {
                                    duracaoSemanas: dur,
                                  })
                                }
                              >
                                {dur} semanas
                              </ChipButton>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Treinos por semana
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={estrutura.treinosPorSemana ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                treinosPorSemana: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Meta mínima para concluir
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={estrutura.quantidadeMinConclusao ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                quantidadeMinConclusao: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Modo de execução
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {MODOS.map((modo) => (
                              <ChipButton
                                key={modo.value}
                                active={estrutura.modoExecucao === modo.value}
                                onClick={() =>
                                  updateEstrutura(estrutura.localId, {
                                    modoExecucao: modo.value,
                                  })
                                }
                              >
                                {modo.label}
                              </ChipButton>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Pontuação por treino/item
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={estrutura.pontosPorItem ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                pontosPorItem: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Bônus por consistência semanal
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={estrutura.bonusConsistencia ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                bonusConsistencia: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Bônus final
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={estrutura.bonusFinal ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                bonusFinal: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Prazo final (opcional)
                          </label>
                          <input
                            type="date"
                            value={estrutura.prazoFinal ? String(estrutura.prazoFinal).slice(0, 10) : ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                prazoFinal: e.target.value || null,
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={estrutura.permiteAtraso !== false}
                              onChange={(e) =>
                                updateEstrutura(estrutura.localId, {
                                  permiteAtraso: e.target.checked,
                                })
                              }
                            />
                            Permitir atraso / flexibilidade no ciclo
                          </label>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Descrição curta
                          </label>
                          <input
                            value={estrutura.descricao || ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, { descricao: e.target.value })
                            }
                            placeholder="Resumo do módulo"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Prazo final (opcional)
                          </label>
                          <input
                            type="date"
                            value={estrutura.prazoFinal ? String(estrutura.prazoFinal).slice(0, 10) : ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                prazoFinal: e.target.value || null,
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="text-base font-bold text-[#193b2e]">
                          Itens da {estruturaTipo === "TRILHA" ? "trilha" : "estrutura"}
                        </div>
                        <div className="text-sm text-slate-500">
                          Adicione treinos, vídeos, aulas, materiais ou desafios.
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {itemTypeOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => addItem(estrutura.localId, opt.value)}
                            className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 inline-flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {estrutura.itens.map((item, itemIndex) => (
                        <div
                          key={item.localId}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100">
                                {itemTypeOptions.find((t) => t.value === item.tipo)?.icon}
                                {item.tipo}
                              </span>
                              Item {itemIndex + 1}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(estrutura.localId, item.localId)}
                              className="h-9 w-9 rounded-xl border border-red-200 text-red-600 flex items-center justify-center"
                              disabled={estrutura.itens.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Tipo do item
                              </label>
                              <select
                                value={item.tipo}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    tipo: e.target.value as LearningItemTipo,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white outline-none"
                              >
                                {itemTypeOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Título
                              </label>
                              <input
                                value={item.titulo || ""}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    titulo: e.target.value,
                                  })
                                }
                                placeholder="Nome do item"
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Descrição
                              </label>
                              <textarea
                                value={item.descricao || ""}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    descricao: e.target.value,
                                  })
                                }
                                placeholder="Descrição do item"
                                className="w-full min-h-[86px] rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            {(item.tipo === "VIDEO" || item.tipo === "AULA") && (
                              <>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Enviar vídeo
                                  </label>
                                  <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                                    <Upload className="w-4 h-4" />
                                    {item.uploading ? "Enviando..." : "Selecionar vídeo"}
                                    <input
                                      type="file"
                                      accept="video/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleItemFileUpload(
                                            estrutura.localId,
                                            item.localId,
                                            file,
                                            "videoUrl"
                                          );
                                        }
                                      }}
                                    />
                                  </label>
                                </div>

                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    URL do vídeo
                                  </label>
                                  <input
                                    value={item.videoUrl || ""}
                                    onChange={(e) =>
                                      updateItem(estrutura.localId, item.localId, {
                                        videoUrl: e.target.value,
                                      })
                                    }
                                    placeholder="Cole a URL do vídeo"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                  />
                                </div>
                              </>
                            )}

                            {item.tipo === "MATERIAL" && (
                              <>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Enviar material
                                  </label>
                                  <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                                    <Upload className="w-4 h-4" />
                                    {item.uploading ? "Enviando..." : "Selecionar arquivo"}
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleItemFileUpload(
                                            estrutura.localId,
                                            item.localId,
                                            file,
                                            "arquivoUrl"
                                          );
                                        }
                                      }}
                                    />
                                  </label>
                                </div>

                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    URL do material
                                  </label>
                                  <input
                                    value={item.materialUrl || item.arquivoUrl || ""}
                                    onChange={(e) =>
                                      updateItem(estrutura.localId, item.localId, {
                                        materialUrl: e.target.value,
                                      })
                                    }
                                    placeholder="Cole a URL do material"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                  />
                                </div>
                              </>
                            )}

                            {item.tipo === "TREINO" && (
                              <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">
                                  ID do treino programado
                                </label>
                                <input
                                  value={item.treinoProgramadoId || ""}
                                  onChange={(e) =>
                                    updateItem(estrutura.localId, item.localId, {
                                      treinoProgramadoId: e.target.value,
                                    })
                                  }
                                  placeholder="Cole o ID do treino salvo no banco"
                                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Pontos do item
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={item.pontos ?? ""}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    pontos: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Duração em minutos
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={item.duracaoMin ?? ""}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    duracaoMin: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div className="md:col-span-2 flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={item.obrigatorio !== false}
                                  onChange={(e) =>
                                    updateItem(estrutura.localId, item.localId, {
                                      obrigatorio: e.target.checked,
                                    })
                                  }
                                />
                                Obrigatório
                              </label>

                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={item.publicado !== false}
                                  onChange={(e) =>
                                    updateItem(estrutura.localId, item.localId, {
                                      publicado: e.target.checked,
                                    })
                                  }
                                />
                                Publicado
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            onClick={addEstrutura}
            className="w-full h-12 rounded-2xl border border-dashed border-[#216c43] text-[#216c43] font-bold inline-flex items-center justify-center gap-2 bg-white"
          >
            <Plus className="w-4 h-4" />
            {estruturaTipo === "TRILHA" ? "Nova trilha" : "Novo módulo"}
          </button>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/learning")}
              className="h-12 px-5 rounded-2xl border border-slate-300 bg-white text-slate-700 font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvarTudo}
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-[#216c43] text-white font-bold disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar metodologia"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}