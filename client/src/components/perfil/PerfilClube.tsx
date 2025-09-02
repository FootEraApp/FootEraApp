// client/src/components/perfil/PerfilClube.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import { Link } from "wouter";

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
    categorias?: string[] | null; // opcional, se existir no backend
    responsavel?: string | null;  // opcional
  };
  // métricas do clube — eventos/conquistas opcionais para cair em 0 se não vierem
  metrics: {
    atletas: number;
    eventos?: number;
    conquistas?: number;
  };
};

type AbaTopo = "perfil" | "eventos" | "atletas";
type SubAbaAtletas = "vinculados" | "observados" | "solicitacoes";

export default function PerfilClube({ idDaUrl }: Props) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const isOwn = !idDaUrl || idDaUrl === Storage.usuarioId;
  const targetId = isOwn ? (Storage.tipoUsuarioId || "me") : (idDaUrl as string);

  const [data, setData] = useState<PayloadClube | null>(null);
  const [loading, setLoading] = useState(true);

  const [aba, setAba] = useState<AbaTopo>("perfil");
  const [subAba, setSubAba] = useState<SubAbaAtletas>("observados");

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

  // KPIs do header (Atletas | Eventos | Conquistas)
  const kpis = [
    { label: "Atletas",     value: data.metrics?.atletas ?? 0 },
    { label: "Eventos",     value: data.metrics?.eventos ?? 0 },
    { label: "Conquistas",  value: data.metrics?.conquistas ?? 0 },
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
            <div className="bg-white/70 rounded-xl p-6 text-center shadow-sm">
              <h3 className="font-semibold text-green-900 mb-1">Atletas Vinculados</h3>
              <p className="text-sm text-green-900/70">Atletas oficialmente vinculados ao seu clube</p>
              <div className="mt-4">
                <Link href="/atletas/vinculados">
                  <a className="text-sm px-4 py-2 rounded-lg bg-white border border-green-200 text-green-900">
                    Ver atletas
                  </a>
                </Link>
              </div>
            </div>
          )}

          {/* Observados */}
          {subAba === "observados" && (
            <div className="bg-white/70 rounded-xl p-6 text-center shadow-sm">
              <h3 className="font-semibold text-green-900 mb-1">Atletas Observados</h3>
              <p className="text-sm text-green-900/70">
                Atletas que você está observando, mas ainda não são vinculados
              </p>
              <div className="mt-4 flex gap-2 justify-center">
                <Link href="/atletas/observados">
                  <a className="text-sm px-4 py-2 rounded-lg bg-white border border-green-200 text-green-900">
                    Ver atletas observados
                  </a>
                </Link>
                <Link href="/explorar?tab=atletas">
                  <a className="text-sm px-4 py-2 rounded-lg bg-yellow-500 text-green-900 font-semibold">
                    + Descobrir novos atletas
                  </a>
                </Link>
              </div>
            </div>
          )}

          {/* Solicitações */}
          {subAba === "solicitacoes" && (
            <div className="bg-white/70 rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-green-900 mb-2">Solicitações de Atletas</h3>
              <div className="flex gap-2 text-sm mb-3">
                <button className="px-3 py-1 rounded-lg bg-green-100 text-green-900">Pendentes</button>
                <button className="px-3 py-1 rounded-lg bg-white/70 text-green-900">Aprovados</button>
                <button className="px-3 py-1 rounded-lg bg-white/70 text-green-900">Rejeitados</button>
              </div>
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
