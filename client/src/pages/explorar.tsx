import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import { Volleyball, User, CirclePlus, Search, House, Filter, X } from "lucide-react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

type UsuarioBasic = { id: string; nome: string; foto?: string | null };

type AtletaItem = {
  id: string;
  usuario: UsuarioBasic;
  usuarioId?: string;
  foto?: string | null;
  tipoTreino?: string | null;
  posicao?: string | null;
  cidade?: string | null;
  estado?: string | null;
  independente?: boolean | null;
  pontuacao?: number | null;  
  categoriaBase?: string | null;  
  idade?: number | null;        
};

type ProfessorItem = { id: string; usuario: UsuarioBasic; foto?: string | null };
type ClubeItem = {
  id: string;
  usuarioId?: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
};
type EscolaItem = {
  id: string;
  usuarioId?: string;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  logo?: string | null;
  siteOficial?: string | null;
};
type OlheiroItem = { id: string; usuario: UsuarioBasic; foto?: string | null };

type DadosExplorar = {
  atletas: AtletaItem[];
  professores: ProfessorItem[];
  olheiros: OlheiroItem[];
  clubes: ClubeItem[];
  escolas: EscolaItem[];
};

type Filtros = {
  categoria?: string;         
  posicao?: string;
  estado?: string;
  cidade?: string;
  independente?: boolean | null; 
  pontuacaoMin?: number | null;
  pontuacaoMax?: number | null;
};

const CATEGORIAS = [
  "Sub-9","Sub-11","Sub-13","Sub-15","Sub-17","Sub-20","Sub-23","Profissional",
];

const mapIdadeParaCategoria = (idade?: number | null): string | null => {
  if (idade == null) return null;
  if (idade <= 9) return "Sub-9";
  if (idade <= 11) return "Sub-11";
  if (idade <= 13) return "Sub-13";
  if (idade <= 15) return "Sub-15";
  if (idade <= 17) return "Sub-17";
  if (idade <= 20) return "Sub-20";
  if (idade <= 23) return "Sub-23";
  return "Profissional";
};

function Explorar() {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"atletas" | "escolas" | "clubes" | "profissionais">("atletas");
  const [dados, setDados] = useState<DadosExplorar>({ atletas: [], professores: [], olheiros: [], clubes: [], escolas: [] });

  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });
  const [draft, setDraft] = useState<Filtros>({ independente: null, pontuacaoMin: null, pontuacaoMax: null });

  const loggedUserId = useMemo(
    () => (Storage?.usuarioId ?? (typeof window !== "undefined" ? Storage.usuarioId : "") ?? "") as string,
    []
  );

  const filtrarEu = useMemo(
    () => <T extends { usuario?: { id?: string }; usuarioId?: string; id?: string }>(arr: T[]) =>
      arr.filter((x) => {
        const uid = (x.usuario?.id ?? x.usuarioId ?? x.id ?? "") as string;
        return uid !== loggedUserId;
      }),
    [loggedUserId]
  );

  useEffect(() => {
    const token = Storage?.token ?? (typeof window !== "undefined" ? Storage.token : "");
    const params: any = {
      q: busca,
      excludeUsuarioId: loggedUserId,
    };
    if (filtros.categoria) params.categoria = filtros.categoria;
    if (filtros.posicao) params.posicao = filtros.posicao;
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.cidade) params.cidade = filtros.cidade;
    if (filtros.independente !== null && filtros.independente !== undefined) {
      params.independente = String(!!filtros.independente);
    }
    if (typeof filtros.pontuacaoMin === "number") params.pMin = filtros.pontuacaoMin;
    if (typeof filtros.pontuacaoMax === "number") params.pMax = filtros.pontuacaoMax;

    axios
      .get(`${API.BASE_URL}/api/explorar`, {
        params,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      .then(({ data }) => {
        setDados({
          atletas: filtrarEu<AtletaItem>(data.atletas || []),
          professores: filtrarEu<ProfessorItem>(data.professores || []),
          olheiros: filtrarEu<OlheiroItem>(data.olheiros || []),
          clubes: filtrarEu<ClubeItem>(data.clubes || []),
          escolas: filtrarEu<EscolaItem>(data.escolas || []),
        });
      })
      .catch((e) => {
        console.error(e);
        setDados({ atletas: [], professores: [], olheiros: [], clubes: [], escolas: [] });
      });
  }, [busca, loggedUserId, filtrarEu, filtros]);

  const abas: Array<["atletas" | "escolas" | "clubes" |  "profissionais", string]> = [
    ["atletas", "Atletas"],
    ["escolas", "Escolas"],
    ["clubes", "Clubes"],
    ["profissionais", "Profissionais"],
  ];

  const profissionais = useMemo(
    () =>
      [
        ...(dados.professores || []).map((p) => ({
          id: p.id,
          usuario: p.usuario,
          foto: p.usuario?.foto ?? p.foto,
          role: "Professor" as const,
        })),
        ...(dados.olheiros || []).map((o) => ({
          id: o.id,
          usuario: o.usuario,
          foto: o.usuario?.foto ?? o.foto,
          role: "Olheiro" as const,
        })),
      ].filter((x) => x?.usuario?.id),
    [dados.professores, dados.olheiros]
  );

  const atletasFiltrados = useMemo(() => {
    const f = filtros;
    const norm = (s?: string | null) => (s || "").toLowerCase();

    return (dados.atletas || []).filter((a) => {
      if (f.categoria) {
        const cat = a.categoriaBase || mapIdadeParaCategoria(a.idade);
        if (!cat || norm(cat) !== norm(f.categoria)) return false;
      }
      if (f.posicao && !norm(a.posicao).includes(norm(f.posicao))) return false;
      if (f.estado && !norm(a.estado).includes(norm(f.estado))) return false;
      if (f.cidade && !norm(a.cidade).includes(norm(f.cidade))) return false;
      if (f.independente !== null && f.independente !== undefined) {
        if (a.independente == null || a.independente !== f.independente) return false;
      }
      if (typeof f.pontuacaoMin === "number") {
        if (typeof a.pontuacao !== "number" || a.pontuacao < f.pontuacaoMin) return false;
      }
      if (typeof f.pontuacaoMax === "number") {
        if (typeof a.pontuacao !== "number" || a.pontuacao > f.pontuacaoMax) return false;
      }
      return true;
    });
  }, [dados.atletas, filtros]);

  const abrirFiltros = () => { setDraft(filtros); setShowFilters(true); };
  const aplicarFiltros = () => { setFiltros(draft); setShowFilters(false); };
  const limparFiltros = () => {
    const base = { independente: null, pontuacaoMin: null, pontuacaoMax: null } as Filtros;
    setDraft(base); setFiltros(base); setShowFilters(false);
  };

  return (
    <div className="min-h-screen bg-cream text-green-900">
      <div className="bg-green-900 p-4 text-white text-center text-2xl font-bold">FOOTERA</div>

      <div className="p-4 flex gap-2 items-center">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar"
          className="w-full p-2 rounded border"
        />
        {aba === "atletas" && (
          <button
            onClick={abrirFiltros}
            className="px-3 py-2 rounded border bg-white flex items-center gap-1"
            title="Filtros"
          >
            <Filter size={16} /> Filtros
          </button>
        )}
      </div>

      {showFilters && (
        <div className="px-4">
          <div className="bg-white rounded-lg border shadow-sm p-3 grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filtrar atletas</h3>
              <button onClick={() => setShowFilters(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Faixa etária / Categoria</label>
                <select
                  className="w-full border rounded px-2 py-2 bg-white"
                  value={draft.categoria ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, categoria: e.target.value || undefined }))}
                >
                  <option value="">Todas</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Posição</label>
                <input
                  className="w-full border rounded px-2 py-2"
                  placeholder="ex.: Zagueiro, Lateral, Meia..."
                  value={draft.posicao ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, posicao: e.target.value || undefined }))}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Estado (UF)</label>
                <input
                  className="w-full border rounded px-2 py-2"
                  placeholder="ex.: SP"
                  value={draft.estado ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value || undefined }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Cidade</label>
                <input
                  className="w-full border rounded px-2 py-2"
                  placeholder="ex.: Santos"
                  value={draft.cidade ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, cidade: e.target.value || undefined }))}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Vínculo</label>
                <select
                  className="w-full border rounded px-2 py-2 bg-white"
                  value={
                    draft.independente === null || draft.independente === undefined
                      ? ""
                      : draft.independente ? "indep" : "vinc"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      independente: v === "" ? null : v === "indep"
                    }));
                  }}
                >
                  <option value="">Todos</option>
                  <option value="indep">Independente</option>
                  <option value="vinc">Vinculado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Pontuação mínima</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full border rounded px-2 py-2"
                    value={draft.pontuacaoMin ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        pontuacaoMin: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Pontuação máxima</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-full border rounded px-2 py-2"
                    value={draft.pontuacaoMax ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        pontuacaoMax: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={limparFiltros} className="px-3 py-2 rounded border">Limpar</button>
              <button onClick={aplicarFiltros} className="px-4 py-2 rounded bg-green-800 text-white">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-around mb-2 px-2 mt-2">
        {abas.map(([tab, label]) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-center rounded-t-lg text-sm ${aba === tab ? "bg-white font-bold border-b-2 border-green-900" : "bg-green-100"}`}
            onClick={() => setAba(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-24">
        {aba === "atletas" && (
          <>
            <h2 className="text-xl font-bold my-2">Atletas em Destaque</h2>
            <div className="grid grid-cols-2 gap-3">
              {atletasFiltrados.map((a) => {
                const foto = formatarUrlFoto(a.foto ?? a.usuario?.foto, "usuarios");
                const nome = a?.usuario?.nome ?? "profile";
                const uid  = a?.usuario?.id ?? a?.usuarioId ?? a.id;
                return (
                  <Link href={`/perfil/${uid}`} key={a.id}>
                    <div className="bg-white rounded shadow p-2 flex flex-col items-center">
                      <img
                        src={foto}
                        alt={`${nome} profile`}
                        className="w-24 h-24 rounded-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `${API.BASE_URL}/assets/default-user.png`;
                        }}
                      />
                      <p className="mt-2 font-medium">{nome}</p>
                      {a.tipoTreino && (
                        <span className="mt-1 text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-800">
                          {a.tipoTreino}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {aba === "escolas" && (
          <>
            <h2 className="text-xl font-bold my-4">Escolas de Futebol</h2>
            <div className="space-y-3">
              {dados.escolas.map((e) => {
                const logo = formatarUrlFoto(e.logo) || "/placeholder.png";
                const href = e.usuarioId ? `/perfil/${e.usuarioId}` : undefined;
                const Card = (
                  <div className="bg-white rounded shadow p-3 flex items-center gap-3 cursor-pointer">
                    <img src={logo} alt="Logo da escola" className="w-16 h-16 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold">{e.nome}</h3>
                      <p className="text-sm text-gray-600">
                        {e.cidade ?? "Cidade"}{e.estado ? `, ${e.estado}` : ""}
                      </p>
                      <p className="text-sm">{e.siteOficial || "Site indisponível"}</p>
                    </div>
                  </div>
                );
                return href ? (
                  <Link href={href} key={e.id}>{Card}</Link>
                ) : (
                  <div key={e.id}>{Card}</div>
                );
              })}
            </div>
          </>
        )}

        {aba === "clubes" && (
          <>
            <h2 className="text-xl font-bold my-4">Clubes</h2>
            <div className="space-y-3">
              {dados.clubes.map((c) => {
                const logo = formatarUrlFoto(c.logo) || "/placeholder.png";
                const href = c.usuarioId ? `/perfil/${c.usuarioId}` : undefined;
                const Card = (
                  <div className="bg-white rounded shadow p-3 flex items-center gap-3 cursor-pointer">
                    <img src={logo} alt="Logo do clube" className="w-16 h-16 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold">{c.nome}</h3>
                      <p className="text-sm text-gray-600">
                        {c.cidade ?? "Cidade"}{c.estado ? `, ${c.estado}` : ""}
                      </p>
                      <p className="text-sm">Clube Profissional</p>
                    </div>
                  </div>
                );
                return href ? (
                  <Link href={href} key={c.id}>{Card}</Link>
                ) : (
                  <div key={c.id}>{Card}</div>
                );
              })}
            </div>
          </>
        )}

        {aba === "profissionais" && (
          <>
            <h2 className="text-xl font-bold my-4">Profissionais</h2>
            {profissionais.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {profissionais.map((p) => {
                  const foto = formatarUrlFoto(p.foto, "usuarios");
                  const uid = p.usuario.id;
                  const href =
                    p.role === "Olheiro" ? `/perfil-olheiro/${uid}` : `/perfil/${uid}`;

                  return (
                    <Link href={href} key={`${p.role}-${p.id}`}>
                      <div className="bg-white rounded shadow p-2 flex flex-col items-center">
                        <img
                          src={foto}
                          alt="Foto do usuário"
                          className="w-24 h-24 rounded-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `${API.BASE_URL}/assets/default-user.png`;
                          }}
                        />
                        <p className="mt-2 font-medium text-center">{p.usuario.nome}</p>
                        <span className="mt-1 text-[11px] px-1.5 py-0.2 rounded bg-green-800 text-white">
                          {p.role}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-600">Nenhum profissional encontrado</p>
            )}
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline"><House /></Link>
        <Link href="/explorar" className="hover:underline"><Search /></Link>
        <Link href="/post" className="hover:underline"><CirclePlus /></Link>
        <Link href="/treinos" className="hover:underline"><Volleyball /></Link>
        <Link href="/perfil" className="hover:underline"><User /></Link>
      </nav>
    </div>
  );
}

export default Explorar;