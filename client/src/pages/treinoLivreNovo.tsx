import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TreinoLivreNovo() {
  const [, navigate] = useLocation();
  
  const atletaIdDaUrl = new URLSearchParams(
    window.location.search
  ).get("atletaId");

  const [atletaSelecionado, setAtletaSelecionado] =
    useState<{
      id: string;
      nome: string;
    } | null>(null);

  const [verificandoAtleta, setVerificandoAtleta] =
    useState(Boolean(atletaIdDaUrl));

  useEffect(() => {
    if (!atletaIdDaUrl) {
      setAtletaSelecionado(null);
      setVerificandoAtleta(false);
      return;
    }

    let cancelado = false;

    async function consultarAtleta() {
      setVerificandoAtleta(true);
      setAtletaSelecionado(null);

      try {
        const token =
          Storage.token ??
          localStorage.getItem("token") ??
          sessionStorage.getItem("token");

        const resposta = await fetch(
          `${API.BASE_URL}/api/responsaveis/me/atletas`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resposta.ok) {
          throw new Error("Não foi possível consultar os atletas.");
        }

        const dados = await resposta.json();

        const vinculo = (
          Array.isArray(dados?.items) ? dados.items : []
        ).find(
          (item: any) =>
            item.atletaId === atletaIdDaUrl &&
            item.status === "ATIVO" &&
            (
              item.principal === true ||
              item.podeGerenciarTreinos === true
            )
        );

        if (!vinculo) {
          throw new Error(
            "Você não possui permissão para registrar treinos deste atleta."
          );
        }

        if (!cancelado) {
          setAtletaSelecionado({
            id: vinculo.atletaId,
            nome: vinculo.atleta.nome,
          });
        }
      } catch (error) {
        if (!cancelado) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Não foi possível identificar o atleta."
          );
        }
      } finally {
        if (!cancelado) {
          setVerificandoAtleta(false);
        }
      }
    }

    void consultarAtleta();

    return () => {
      cancelado = true;
    };
  }, [atletaIdDaUrl]);

  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [duracaoMin, setDuracaoMin] = useState<number>(30);
  const [tipoAtividade, setTipoAtividade] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [arquivoMidia, setArquivoMidia] = useState<File | null>(null); 

  async function salvar() {
    const token = (Storage as any).token ?? localStorage.getItem("token");
    
    if (verificandoAtleta) {
      return toast.error("Aguarde a identificação do atleta.");
    }

    if (atletaIdDaUrl && !atletaSelecionado) {
      return toast.error(
        "Não foi possível confirmar sua permissão para este atleta."
      );
    }

    const atletaId = atletaIdDaUrl
      ? atletaSelecionado?.id
      : (
          (Storage as any).tipoUsuarioId ??
          localStorage.getItem("tipoUsuarioId") ??
          sessionStorage.getItem("tipoUsuarioId")
        );

    if (!token) {
      return toast.error("Sessão expirada.");
    }

    if (!atletaId) {
      return toast.error("Atleta não identificado.");
    }
    if (!descricao.trim()) {
      return toast.error("Descreva rapidamente o treino (ex.: Corrida 5km).");
    }

    try {
      const form = new FormData();
      form.append("atletaId", atletaId);
      form.append(
        "data",
        data ? new Date(data).toISOString() : new Date().toISOString()
      );
      form.append("descricao", descricao);
      form.append("duracaoMin", String(duracaoMin || 0));
      if (tipoAtividade) form.append("tipoAtividade", tipoAtividade);
      if (categoria) form.append("categoria", categoria);
      if (arquivoMidia) form.append("midia", arquivoMidia);

      const r = await fetch(`${API.BASE_URL}/api/treinos-livres`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!r.ok) {
        const txt = await r.text();
        console.error("Falha ao salvar treino livre:", r.status, txt);
        return toast.error("Não foi possível salvar o treino.");
      }

      toast.success("Treino livre registrado!");
      navigate(
        atletaIdDaUrl
          ? `/treinos/livre/historico?atletaId=${encodeURIComponent(atletaIdDaUrl)}`
          : "/treinos/livre/historico"
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado.");
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <Link
        href="/treinos"
        aria-label="Voltar para treinos"
        title="Voltar para explorar"
        className="inline-flex h-10 w-10 items-center justify-center
          rounded-full border border-green-800 bg-white text-green-900
          shadow-sm hover:bg-green-50 focus:outline-none
          focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      
      {atletaSelecionado && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold uppercase text-green-800">
            Registrando treino livre para
          </p>

          <p className="mt-2 text-lg font-bold text-green-950">
            {atletaSelecionado.nome}
          </p>
        </div>
      )}

      <h2 className="text-lg font-bold mb-4 mt-4">Registrar Treino Livre</h2>

      <label className="block text-sm mb-1">Descrição da atividade</label>
      <input
        className="border w-full p-2 rounded mb-3"
        placeholder='Ex.: "Corrida de 5km" ou "Chute a gol 30min"'
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      <label className="block text-sm mb-1">Data</label>
      <input
        type="datetime-local"
        className="border w-full p-2 rounded mb-3"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      <label className="block text-sm mb-1">Duração (min)</label>
      <input
        type="number"
        min={1}
        className="border w-full p-2 rounded mb-3"
        value={duracaoMin}
        onChange={(e) =>
          setDuracaoMin(parseInt(e.target.value || "0", 10) || 0)
        }
      />

      <label className="block text-sm mb-1">Tipo</label>
      <select
        className="border w-full p-2 rounded mb-3"
        value={tipoAtividade}
        onChange={(e) => setTipoAtividade(e.target.value)}
      >
        <option value="">—</option>
        <option value="Fisico">Físico</option>
        <option value="Tecnico">Técnico</option>
        <option value="Tatico">Tático</option>
        <option value="Outro">Outro</option>
      </select>

      <label className="block text-sm mb-1">Categoria (opcional)</label>
      <input
        className="border w-full p-2 rounded mb-3"
        placeholder='Ex.: "Base", "Avançado"'
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      />

      <label className="block text-sm mb-1">Foto / Vídeo (opcional)</label>
      <input
        type="file"
        accept="image/*,video/*"
        className="border w-full p-2 rounded mb-4 bg-white"
        onChange={(e) => setArquivoMidia(e.target.files?.[0] ?? null)}
      />
      {arquivoMidia && (
        <p className="text-xs text-gray-600 mb-3">
          Arquivo selecionado: <strong>{arquivoMidia.name}</strong>
        </p>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => navigate("/treinos")}
          className="px-4 py-2 rounded border bg-white"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          className="px-4 py-2 rounded bg-emerald-700 text-white"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}