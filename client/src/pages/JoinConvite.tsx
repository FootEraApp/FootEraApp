// client/src/pages/JoinConvite.tsx
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Link2,
  Loader2,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { API } from "../config.js";
import { salvarRetornoAuth } from "../utils/authSession.js";
import { toast } from "@/lib/toast";

type ConviteStatus = "ATIVO" | "EXPIRADO" | "CANCELADO" | "USADO";

type ConviteDetalhe = {
  convite: {
    id: string;
    token: string;
    tipo: "ORGANIZACAO" | "TURMA" | "PROFESSOR" | "ATLETA_VINCULO";
    status: ConviteStatus;
    papelDestino?: "Atleta" | "Professor" | null;
    expiresAt: string;
    usoUnico: boolean;
    ativo: boolean;
    totalUsos: number;
  };
  contexto: {
    organizacao?: {
      tipo: "CLUBE" | "ESCOLINHA";
      id: string;
      nome: string;
      logo?: string | null;
      usuarioId?: string | null;
      cidade?: string | null;
      estado?: string | null;
    } | null;
    turma?: {
      id: string;
      nome: string;
      descricao?: string | null;
      categoria?: string[];
    } | null;
    professor?: {
      id: string;
      nome: string;
      fotoUrl?: string | null;
      usuarioId?: string | null;
      usuario?: {
        nomeDeUsuario?: string | null;
      } | null;
    } | null;
    atleta?: {
      id: string;
      nome?: string | null;
      sobrenome?: string | null;
      foto?: string | null;
      usuarioId?: string | null;
    } | null;
    criadoPor?: {
      id: string;
      nome: string;
      nomeDeUsuario: string;
      foto?: string | null;
      tipo?: string | null;
    } | null;
  };
  viewer: {
    authenticated: boolean;
    jaUtilizadoPorMim: boolean;
  };
  podeAceitar: boolean;
};

function lerTokenAuth() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function formatarData(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function tituloTipo(tipo?: string | null) {
  switch (String(tipo ?? "").toUpperCase()) {
    case "PROFESSOR":
      return "Convite para professor";
    case "TURMA":
      return "Convite para turma";
    case "ATLETA_VINCULO":
      return "Convite de vínculo";
    case "ORGANIZACAO":
      return "Convite da organização";
    default:
      return "Convite FootEra";
  }
}

function textoStatus(status?: ConviteStatus) {
  switch (status) {
    case "EXPIRADO":
      return "Este convite expirou.";
    case "CANCELADO":
      return "Este convite foi cancelado.";
    case "USADO":
      return "Este convite de uso único já foi utilizado.";
    default:
      return null;
  }
}

export default function JoinConvite() {
  const [match, params] = useRoute("/join/:token");
  const [, navigate] = useLocation();

  const token = match ? String(params?.token ?? "").trim() : "";

  const [data, setData] = useState<ConviteDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) {
      setError("Token de convite inválido.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const authToken = lerTokenAuth();
      const response = await fetch(
        `${API.BASE_URL}/api/convites/${encodeURIComponent(token)}`,
        {
          headers: authToken
            ? { Authorization: `Bearer ${authToken}` }
            : undefined,
        }
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.message || "Não foi possível carregar o convite."
        );
      }

      setData(body);
    } catch (e: any) {
      setData(null);
      setError(e?.message || "Não foi possível carregar o convite.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const entrarParaAceitar = () => {
    const returnTo = `/join/${encodeURIComponent(token)}`;
    salvarRetornoAuth(returnTo);
    navigate("/login");
  };

  const aceitar = async () => {
    const authToken = lerTokenAuth();

    if (!authToken) {
      entrarParaAceitar();
      return;
    }

    try {
      setAccepting(true);

      const response = await fetch(
        `${API.BASE_URL}/api/convites/${encodeURIComponent(token)}/aceitar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body?.message || "Não foi possível aceitar o convite.");
      }

      toast.success(body?.message || "Convite aceito com sucesso!");
      navigate(String(body?.redirectTo || "/perfil"));
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aceitar o convite.");
      await carregar();
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FEFBE9] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-green-900 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-semibold">Carregando convite...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FEFBE9] px-4 py-8">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-3 text-xl font-bold text-zinc-900">
              Convite indisponível
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              {error || "Não foi possível localizar este convite."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const convite = data.convite;
  const contexto = data.contexto;
  const statusMsg = textoStatus(convite.status);
  const organizacao = contexto.organizacao;
  const turma = contexto.turma;
  const professor = contexto.professor;
  const criadoPor = contexto.criadoPor;
  const jaAceito = data.viewer.jaUtilizadoPorMim;
  const podeAceitar = data.podeAceitar || jaAceito;

  return (
    <div className="min-h-screen bg-[#FEFBE9] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() =>
            window.history.length > 1
              ? window.history.back()
              : navigate("/")
          }
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="bg-emerald-900 px-6 py-7 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
              <Link2 className="h-4 w-4" />
              FootEra
            </div>
            <h1 className="mt-3 text-2xl font-bold">{tituloTipo(convite.tipo)}</h1>
            <p className="mt-2 text-sm text-emerald-100">
              Confira os detalhes abaixo antes de aceitar.
            </p>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            {organizacao && (
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-800">
                  {organizacao.logo ? (
                    <img
                      src={organizacao.logo}
                      alt={organizacao.nome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {organizacao.tipo === "CLUBE" ? "Clube" : "Escolinha"}
                  </div>
                  <div className="truncate font-bold text-zinc-900">
                    {organizacao.nome}
                  </div>
                  {(organizacao.cidade || organizacao.estado) && (
                    <div className="text-xs text-zinc-500">
                      {[organizacao.cidade, organizacao.estado]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {turma && (
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <Users className="h-4 w-4" />
                  Turma
                </div>
                <div className="mt-2 font-bold text-zinc-900">{turma.nome}</div>
                {turma.descricao && (
                  <p className="mt-1 text-sm text-zinc-600">{turma.descricao}</p>
                )}
              </div>
            )}

            {professor && (
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <GraduationCap className="h-4 w-4" />
                  Professor
                </div>
                <div className="mt-2 font-bold text-zinc-900">{professor.nome}</div>
              </div>
            )}

            {criadoPor && (
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <UserRound className="h-4 w-4" />
                  Quem convidou
                </div>
                <div className="mt-2 font-semibold text-zinc-900">
                  {criadoPor.nome}
                </div>
                <div className="text-xs text-zinc-500">
                  @{criadoPor.nomeDeUsuario}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
              <Clock3 className="h-4 w-4 shrink-0" />
              <span>
                Válido até <strong>{formatarData(convite.expiresAt)}</strong>
              </span>
            </div>

            {jaAceito && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-bold">Convite já aceito</div>
                  <div className="text-sm">
                    Este vínculo já foi aplicado à sua conta.
                  </div>
                </div>
              </div>
            )}

            {statusMsg && !jaAceito && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                {statusMsg}
              </div>
            )}

            {podeAceitar && (
              data.viewer.authenticated ? (
                <button
                  type="button"
                  disabled={accepting}
                  onClick={() => void aceitar()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Aceitando...
                    </>
                  ) : jaAceito ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Continuar
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Aceitar convite
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={entrarParaAceitar}
                  className="w-full rounded-2xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800"
                >
                  Entrar para aceitar
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}