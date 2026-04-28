import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import ProfileHeader from "../profile/ProfileHeader.js";
import TrainingProgress from "../profile/TrainingProgress.js";
import ProfilePostsSection from "../perfil/ProfilePostsSection.js";
import { Link } from "wouter";
import { Trophy, Pencil } from "lucide-react";

interface Perfil {
  tipo: string;
  usuario: { id: string; nome: string; email: string; foto?: string | null };
  dadosEspecificos: {
    id?: string;
    nome?: string;
    idade?: number;
    posicao?: string;
    escola?: string | null;
    clube?: string | null;
    foto?: string | null;
    seloQualidade?: boolean;
  };
  atleta?: { id: string };
  tipoUsuarioId?: string;
  perfilVerificado?: boolean;
  isPro?: boolean;
}

type Props = {
  idDaUrl?: string;
};

type CertificadoResumo = {
  id: string;
  tituloMetodologia: string;
  emitidoEm: string;
  codigoValidacao: string;
  pdfUrl?: string | null;
};
export default function PerfilAtleta({ idDaUrl }: Props) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [professores, setProfessores] = useState<string[]>([]);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [clubeNome, setClubeNome] = useState<string | null>(null);
  const [scoreDelta, setScoreDelta] = useState(0);
  const [privacidade, setPrivacidade] = useState<{ mostrarEmail: boolean } | null>(null);
  const [conquistasCount, setConquistasCount] = useState<number>(0);
  const [earnedBadges, setEarnedBadges] = useState<any[]>([]);
  const [certificados, setCertificados] = useState<CertificadoResumo[] | null>(null);

  type AbaTopo = "perfil" | "conquistas" | "postagens";
  const [aba, setAba] = useState<AbaTopo>("perfil");

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const isOwnProfile = !idDaUrl || idDaUrl === Storage.usuarioId;
  const basePerfil = isOwnProfile ? "me" : (idDaUrl as string);
  const alvoUsuarioId = isOwnProfile ? (Storage.usuarioId as string) : (idDaUrl as string);

  useEffect(() => {
    if (!token || !usuarioId) return;

    let cancel = false;

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/${encodeURIComponent(usuarioId)}?onlyConcluidas=1`,
          { headers, withCredentials: true }
        );

        const earnedArr = Array.isArray(resp?.earned) ? resp.earned : [];
        if (!cancel) {
          setEarnedBadges(earnedArr);
          setConquistasCount(earnedArr.length);
        }
      } catch {
        if (!cancel) {
          setEarnedBadges([]);
          setConquistasCount(0);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, usuarioId]);

  useEffect(() => {
    if (!token || !usuarioId) return;

    let cancel = false;

    (async () => {
      try {
        const { data: resp } = await axios.get(
          `${API.BASE_URL}/api/conquistas/certificados/${encodeURIComponent(usuarioId)}`,
          { headers }
        );

        const items = Array.isArray(resp?.items) ? resp.items : [];
        if (!cancel) setCertificados(items);
      } catch {
        if (!cancel) setCertificados([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [token, usuarioId]);

  useEffect(() => {
    if (!token) return;

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: meOuOutro }] = await Promise.all([
          axios.get(`${API.BASE_URL}/api/perfil/${basePerfil}`, { headers }),
        ]);

        if (!alive) return;

        setPerfil(meOuOutro);
        const uid = (meOuOutro?.usuario?.id as string) || alvoUsuarioId || null;
        setUsuarioId(uid);

        try {
          const rPriv = await axios.get(`${API.BASE_URL}/api/configuracoes-perfil/privacidade`, { headers });
          const mostrarEmail = !!(rPriv.data?.mostrarEmail ?? rPriv.data?.email ?? rPriv.data?.mostrar_email);
          if (!alive) return;
          setPrivacidade({ mostrarEmail });
        } catch {
          if (!alive) return;
          setPrivacidade({ mostrarEmail: false });
        }

        let escola = meOuOutro?.dadosEspecificos?.escola ?? null;
        let clube  = meOuOutro?.dadosEspecificos?.clube  ?? null;
        let profs: string[] = [];
        const profLegacy = (meOuOutro as any)?.dadosEspecificos?.professor;
        if (typeof profLegacy === "string" && profLegacy.trim()) profs = [profLegacy.trim()];
        if (meOuOutro?.tipo === "Atleta") {
          const idParaConsulta =
            meOuOutro?.dadosEspecificos?.atletaId ??
            meOuOutro?.atleta?.id ??
            meOuOutro?.usuario?.id ??
            alvoUsuarioId;

          try {
            const { data: vinc } = await axios.get(
              `${API.BASE_URL}/api/atletas/${idParaConsulta}/vinculos-basic`,
              { headers }
            );
            if (!alive) return;

            escola = vinc?.escolinha?.nome ?? escola;
            clube  = vinc?.clube?.nome     ?? clube;

            const pList = Array.isArray((vinc as any)?.professores) ? (vinc as any).professores : null;

            if (pList) {
              const nomes = pList
                .map((p: any) => (typeof p === "string" ? p : p?.nome))
                .filter(Boolean)
                .map((s: any) => String(s).trim())
                .filter(Boolean);

              profs = nomes;
            } else {
              const pOne = (vinc as any)?.professor;
              const nomeOne =
                typeof pOne === "string" ? pOne :
                typeof pOne?.nome === "string" ? pOne.nome :
                null;

              if (nomeOne && String(nomeOne).trim()) profs = [String(nomeOne).trim()];
            }

          } catch (e) {
        }
        }
        setEscolaNome(escola);
        setClubeNome(clube);
        setProfessores(Array.from(new Set(profs)));

        if (uid) {
          const { data: p } = await axios.get(`${API.BASE_URL}/api/perfil/${uid}/pontuacao`, { headers });
          if (!alive) return;
          const performance = Number(p?.performance) || 0;
          const disciplina = Number(p?.disciplina) || 0;
          const responsabilidade = Number(p?.responsabilidade) || 0;
          const totalAtual = performance + disciplina + responsabilidade;
          const viewerId = String(Storage?.usuarioId ?? "");
          const key = `lastSeenScore:${viewerId}:${uid}`;
          const last = Number(localStorage.getItem(key) ?? 0);
          const d = Math.max(0, totalAtual - last);
          setScoreDelta(d);
          setTimeout(() => { try { localStorage.setItem(key, String(totalAtual)); } catch {} }, 2000);
        } else {
        }
      } catch (err) {
        console.error("Erro ao carregar dados do perfil do atleta:", err);
        setPerfil(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [idDaUrl, token]);

  if (loading) {
    return <div className="text-center p-10 text-green-800">Carregando perfil...</div>;
  }
  if (!perfil) {
    return <div className="text-center p-10 text-red-600">Erro ao carregar perfil.</div>;
  }
  
  const temVinculo = Boolean((professores?.length ?? 0) > 0 || escolaNome || clubeNome);
  const isIndependente = perfil.tipo === "Atleta" && !temVinculo;
  const total =
    Number((perfil as any)?.pontuacaoTotal) ||
    Number((perfil as any)?.pontos) ||
    Number((perfil as any)?.usuario?.pontuacao) ||
    0;

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <ProfileHeader
          nome={perfil.usuario.nome}
          idade={perfil.dadosEspecificos.idade}
          posicao={perfil.dadosEspecificos.posicao}
          pontuacao={total}
          scoreDelta={scoreDelta}
          isOwnProfile={isOwnProfile}
          foto={perfil.usuario.foto || perfil.dadosEspecificos.foto || undefined}
          perfilId={perfil.usuario.id}
          perfilTipoProp="atleta"
          perfilTipoIdProp={
            (perfil as any)?.dadosEspecificos?.atletaId ??
            perfil?.atleta?.id ??
            perfil?.tipoUsuarioId ??
            undefined
          }
          isVerified={perfil?.perfilVerificado}
          isPro={perfil?.isPro}
          conquistasCount={conquistasCount}
        />
          {isIndependente && (
            <div className="bg-yellow-100 border border-yellow-300 rounded p-4 my-4 text-sm text-yellow-900">
              <div className="font-semibold">Atleta Independente</div>
                Você pode usar todas as funcionalidades do FootEra, mas aparecerá apenas em
                rankings públicos e de engajamento.
              </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
           {[
            { key: "perfil", label: "Perfil" },
            { key: "conquistas", label: "Conquistas"},
            { key: "postagens", label: "Postagens" },
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

           {aba === "perfil" && (
            <>
             <div className="bg-transparent border rounded-xl shadow-sm p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-green-900 text-xl font-semibold">
                  Informações do Atleta
                </div>

                {isOwnProfile && (
                  <Link
                    href="/perfil/editar"
                    className="inline-flex items-center justify-center rounded-full border border-green-200 bg-white p-2 text-green-800 hover:bg-green-50"
                    title="Editar perfil"
                    aria-label="Editar perfil"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
              </div>
                <ul className="text-sm text-green-900/90 space-y-2">
                  <li>
                    <b>Nome:</b> {perfil.usuario?.nome}
                  </li>

                  {privacidade?.mostrarEmail && perfil.usuario?.email ? (
                   <li>
                     <b>Email:</b> {perfil.usuario.email}
                   </li>
                  ) : null}

                  {typeof perfil.dadosEspecificos?.idade === "number" && (
                   <li>
                      <b>Idade:</b> {perfil.dadosEspecificos.idade} ano
                      {perfil.dadosEspecificos.idade === 1 ? "" : "s"}
                   </li>
                   )}

                  {perfil.dadosEspecificos?.posicao && (
                    <li>
                      <b>Posição:</b> {perfil.dadosEspecificos.posicao}
                    </li>
                  )}

                  {escolaNome && (
                    <li>
                      <b>Escola:</b> {escolaNome}
                    </li>
                  )}

                  {clubeNome && (
                    <li>
                      <b>Clube:</b> {clubeNome}
                    </li>
                   )}

                  {(professores?.length ?? 0) > 0 && (
                   <li>
                      <b>Professores:</b> {professores.join(", ")}
                   </li>
                  )}
                </ul>
              </div>

              <TrainingProgress
                userId={perfil.usuario.id}
                tipoUsuarioId={    
                  perfil.tipoUsuarioId ?? perfil.dadosEspecificos?.id ?? perfil.atleta?.id ?? null
                }
              />
            </>
           )}

          {aba === "conquistas" && (
              <div className="mt-4 grid gap-4">
                <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-green-100">
                    <h3 className="font-semibold text-green-900">Certificados emitidos</h3>
                    <Link href="/perfil/conquistas" className="text-sm text-green-800">
                      Ver certificados
                    </Link>
                  </div>
                  <div className="p-4">
                    {certificados && certificados.length > 0 ? (
                      <div className="text-green-900 font-medium">
                        {certificados.length} certificado{certificados.length > 1 ? "s" : ""} emitido{certificados.length > 1 ? "s" : ""}
                      </div>
                    ) : (
                      <div className="text-center text-green-900/70 py-8">
                        Nenhum certificado emitido ainda.
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white/90 rounded-2xl shadow-sm border border-green-100">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-green-100">
                    <h3 className="font-semibold text-green-900">Conquistas e Troféus</h3>
                    <Link href="/perfil/conquistas" className="text-sm text-green-800">
                      Ver conquistas
                    </Link>
                  </div>
                  <div className="p-4">
                    {earnedBadges.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {earnedBadges.slice(0, 4).map((item: any) => (
                          <div
                            key={item.id}
                            className="rounded-xl p-4 border border-green-100 text-center"
                          >
                            <Trophy className="mx-auto mb-2 text-green-800" />
                            <div className="text-sm font-medium text-green-900">
                              {item?.conquista?.titulo ?? "Conquista"}
                            </div>
                            <div className="text-xs text-green-900/70">
                              {item?.conquista?.descricao ?? ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-green-900/70 py-8">
                        Nenhuma conquista registrada ainda.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

           {aba === "postagens" && (
             <section className="mt-4">
               <ProfilePostsSection usuarioId={perfil.usuario.id} />
             </section>
           )}
         </div>
       </div>
      );
    }