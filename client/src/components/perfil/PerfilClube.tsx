// client/src/components/perfil/PerfilClube.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";
import { Activity, ChevronRight } from "lucide-react";

type Props = { idDaUrl?: string };

type UsuarioMin = { id: string; nome: string; email: string; foto?: string | null };

type PayloadClube = {
  tipo: "Clube";
  usuario: UsuarioMin | null;
  clube: {
    id: string;
    usuarioId: string;
    nome: string;
    cnpj?: string | null;
    telefone1?: string | null;
    telefone2?: string | null;
    email?: string | null;
    siteOficial?: string | null;
    sede?: string | null;
    estadio?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    pais?: string | null;
    cep?: string | null;
    logo?: string | null;
    dataCriacao: string;
    categorias?: string[] | null;
    responsavel?: string | null;
  };
  metrics: { atletas: number; eventos?: number; conquistas?: number };
};

type AbaTopo = "perfil" | "eventos" | "atletas";
type SubAbaAtletas = "vinculados" | "observados" | "solicitacoes";

/** lista que os endpoints retornam */
type AtletaItem = {
  id: string;          // usuario.id do atleta
  atletaId: string;    // id da tabela Atleta
  nome: string;
  foto?: string | null;
  posicao?: string | null;
  idade?: number | null;
  altura?: number | null;
  peso?: number | null;
  observadoEm?: string; // opcional, se o backend enviar
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-green-900/70 py-8">
      <Activity className="mx-auto mb-2 opacity-70" />
      <p>{text}</p>
    </div>
  );
}

export default function PerfilClube({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadClube | null>(null);
  const [loading, setLoading] = useState(true);

  const [aba, setAba] = useState<AbaTopo>("perfil");
  const [subAba, setSubAba] = useState<SubAbaAtletas>("vinculados");

  // listas
  const [vinculados, setVinculados] = useState<AtletaItem[] | null>(null);
  const [observados, setObservados] = useState<AtletaItem[] | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await axios.get<PayloadClube>(
          `${API.BASE_URL}/api/perfil/clube/${targetId}`,
          { headers }
        );
        if (!cancel) setData(resp.data);
      } catch (e) {
        console.error("PerfilClube GET error:", e);
        if (!cancel) setData(null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [targetId, token]);

  // lazy-load das listas quando as sub-abas forem abertas
  useEffect(() => {
    if (!token) return;
    const cancel = { v: false };

    async function fetchVinculados() {
      const tipoId = (isOwn ? Storage.tipoUsuarioId : data?.clube?.id) ?? null;
      if (!tipoId) {
        if (!cancel.v) setVinculados([]);
        return;
      }
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/treinos/atletas-vinculados`,
          { headers, params: { tipoUsuarioId: tipoId } }
        );
        if (!cancel.v) setVinculados(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setVinculados([]);
      }
    }

    async function fetchObservados() {
      const tipoId = (isOwn ? Storage.tipoUsuarioId : data?.clube?.id) ?? null;
      if (!tipoId) {
        if (!cancel.v) setObservados([]);
        return;
      }
      try {
        const { data: lista } = await axios.get<AtletaItem[]>(
          `${API.BASE_URL}/api/observados`,
          { headers, params: { tipoUsuarioId: tipoId } }
        );
        if (!cancel.v) setObservados(Array.isArray(lista) ? lista : []);
      } catch {
        if (!cancel.v) setObservados([]);
      }
    }

    if (aba === "atletas") {
      if (subAba === "vinculados" && vinculados == null) fetchVinculados();
      if (subAba === "observados" && observados == null) fetchObservados();
    }

    return () => { cancel.v = true; };
  }, [aba, subAba, token, isOwn, data?.clube?.id, vinculados, observados]);

  if (loading) return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  if (!data || !data.clube) return <div className="text-center p-10 text-red-600">Clube não encontrado.</div>;

  const nome = data.clube.nome || data.usuario?.nome || "Clube";
  const headerFoto: string | undefined =
    (typeof data.clube.logo === "string" && data.clube.logo) ||
    (typeof data.usuario?.foto === "string" && data.usuario.foto) ||
    undefined;

  const time =
    data.clube.cidade
      ? `${data.clube.cidade}${data.clube.estado ? " - " + data.clube.estado : ""}${data.clube.pais ? " - " + data.clube.pais : ""}`
      : undefined;

  const kpis = [
    { label: "Atletas",    value: data.metrics?.atletas ?? 0 },
    { label: "Eventos",    value: data.metrics?.eventos ?? 0 },
    { label: "Conquistas", value: data.metrics?.conquistas ?? 0 },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <ProfileHeader
        nome={nome}
        time={time}
        isOwnProfile={isOwn}
        foto={headerFoto}
        perfilId={data.usuario?.id || data.clube.usuarioId || data.clube.id}
        kpis={kpis}
      />

      {/* Abas topo */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { key: "perfil",   label: "Perfil" },
          { key: "eventos",  label: "Eventos" },
          { key: "atletas",  label: "Atletas" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setAba(t.key as AbaTopo)}
            className={`py-2 rounded-lg text-sm font-medium ${
              aba === t.key
                ? "bg-green-100 text-green-900"
                : "bg-white/70 text-green-900 hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {aba === "perfil" && (
        <section className="mt-4 grid gap-4">
          {/* Informações do Clube */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Informações do Clube</h3>
            <ul className="text-sm text-green-900/90 space-y-1">
              <li><b>Nome:</b> {data.clube.nome}</li>
              {data.clube.sede && <li><b>Sede:</b> {data.clube.sede}</li>}
              {data.clube.estadio && <li><b>Estádio:</b> {data.clube.estadio}</li>}
              {(data.clube.cidade || data.clube.estado || data.clube.pais) && (
                <li>
                  <b>Localização:</b>{" "}
                  {[data.clube.cidade, data.clube.estado, data.clube.pais].filter(Boolean).join(", ")}
                </li>
              )}
              {(data.clube.logradouro || data.clube.bairro || data.clube.cep) && (
                <li>
                  <b>Endereço:</b>{" "}
                  {[data.clube.logradouro, data.clube.numero, data.clube.complemento, data.clube.bairro, data.clube.cep]
                    .filter(Boolean)
                    .join(", ")}
                </li>
              )}
              {data.clube.siteOficial && <li><b>Site:</b> {data.clube.siteOficial}</li>}
            </ul>
          </div>

          {/* FootEra Formadores */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-1">FootEra Formadores</h3>
            <p className="text-sm text-green-900/80">
              Gerencie vínculos de formação de atletas e documentos para mecanismo de solidariedade
            </p>
            <div className="mt-3">
              <Link href="/formadores">
                <a className="inline-block rounded-lg bg-green-600 text-white px-4 py-2 font-semibold">
                  Acessar Módulo Formadores
                </a>
              </Link>
            </div>
          </div>

          {/* Categorias */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Categorias</h3>
            {data.clube.categorias?.length ? (
              <div className="flex flex-wrap gap-2">
                {data.clube.categorias.map((c) => (
                  <span key={c} className="text-xs bg-green-100 text-green-900 px-2 py-1 rounded-full">
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-900/70">Nenhuma categoria cadastrada.</p>
            )}
          </div>

          {/* Contato */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Contato</h3>
            <ul className="text-sm text-green-900/90 space-y-1">
              {(data.clube.responsavel || data.usuario?.nome) && (
                <li><b>Responsável:</b> {data.clube.responsavel || data.usuario?.nome}</li>
              )}
              {data.clube.email && <li><b>Email:</b> {data.clube.email}</li>}
              {(data.clube.telefone1 || data.clube.telefone2) && (
                <li>
                  <b>Telefone:</b>{" "}
                  {[data.clube.telefone1, data.clube.telefone2].filter(Boolean).join(" / ")}
                </li>
              )}
            </ul>
          </div>

          {/* Documentação */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-green-900 mb-2">Documentação</h3>
            {data.clube.cnpj
              ? <p className="text-sm text-green-900/90"><b>CNPJ:</b> {data.clube.cnpj}</p>
              : <p className="text-sm text-green-900/70">Sem CNPJ informado.</p>}
          </div>
        </section>
      )}

      {aba === "eventos" && (
        <section className="mt-4 grid gap-4">
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-900">Eventos e Peneiras</h3>
              <Link href="/eventos">
                <a className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-900">Ver eventos</a>
              </Link>
            </div>
            <p className="text-sm text-green-900/80 mt-1">
              Crie e gerencie seus eventos, peneiras e amistosos.
            </p>
            <div className="mt-4">
              <Link href="/eventos/novo">
                <a className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 text-green-900 font-semibold px-4 py-2">
                  <span>+</span> Criar novo evento
                </a>
              </Link>
            </div>
          </div>
        </section>
      )}

      {aba === "atletas" && (
        <section className="mt-4 grid gap-4">
          {/* sub-abas */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "vinculados",   label: "Vinculados" },
              { key: "observados",   label: "Observados" },
              { key: "solicitacoes", label: "Solicitações" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setSubAba(t.key as SubAbaAtletas)}
                className={`py-2 rounded-lg text-sm font-medium ${
                  subAba === t.key
                    ? "bg-green-100 text-green-900"
                    : "bg-white/70 text-green-900 hover:bg-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

{/* Vinculados */}
{subAba === "vinculados" && (
  <div className="bg-white/70 rounded-xl p-4 shadow-sm">
    <h3 className="font-semibold text-green-900 mb-2">Atletas Vinculados</h3>
    {vinculados && vinculados.length > 0 ? (
      <ul className="grid grid-cols-1 gap-3">
        {vinculados.map((a) => (
          <li key={a.atletaId} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
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

            {/* Link para o perfil do atleta (usa a.id = usuarioId) */}
            <Link href={`/perfil/${a.id}`}>
              <a className="text-sm text-green-800 inline-flex items-center gap-1">
                Ver perfil <ChevronRight className="w-4 h-4" />
              </a>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState text="Nenhum atleta vinculado ainda" />
    )}
  </div>
)}


{/* Observados */}
{subAba === "observados" && (
  <div className="bg-white/70 rounded-xl p-4 shadow-sm">
    <h3 className="font-semibold text-green-900 mb-2">Atletas Observados</h3>
    {observados && observados.length > 0 ? (
      <ul className="grid grid-cols-1 gap-3">
        {observados.map((a) => (
          <li key={a.atletaId} className="flex items-center gap-3 rounded-xl border border-green-100 p-3">
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

            {/* Link para o perfil do atleta (usa a.id = usuarioId) */}
            <Link href={`/perfil/${a.id}`}>
              <a className="text-sm text-green-800 inline-flex items-center gap-1">
                Ver perfil <ChevronRight className="w-4 h-4" />
              </a>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState text="Você ainda não observa nenhum atleta" />
    )}
  </div>
)}


          {/* Solicitações */}
          {subAba === "solicitacoes" && (
            <div className="bg-white/70 rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-green-900 mb-2">Solicitações de Atletas</h3>
              <p className="text-sm text-green-900/70 text-center py-6">
                Nenhuma solicitação pendente de atletas.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
