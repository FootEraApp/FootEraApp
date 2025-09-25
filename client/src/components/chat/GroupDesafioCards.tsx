import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import { publicImgUrl } from "@/utils/publicUrl.js";

export type MsgGrupo = {
  id: string;
  grupoId: string;
  usuarioId: string;
  criadaEm: string;
  conteudo: string;
  tipo:
    | "NORMAL"
    | "DESAFIO"
    | "POST"
    | "USUARIO"
    | "CONQUISTA"
    | "GRUPO_DESAFIO"
    | "GRUPO_DESAFIO_BONUS";
  conteudoJson?: any;
  desafioEmGrupoId?: string | null;
  usuario?: { id: string; nome: string; foto?: string | null };
};

type Usuario = { id: string; nome: string; foto?: string | null };
type Postagem = { id: string; conteudo: string; imagemUrl?: string; videoUrl?: string; usuario: Usuario };

function formatarData(d?: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

function DesafioPreview({ desafioId }: { desafioId: string }) {
  const [, navigate] = useLocation();
  const [d, setD] = useState<any | null>(null);

  useEffect(() => {
    fetch(`${API.BASE_URL}/api/desafios/${desafioId}`, {
      headers: { Authorization: `Bearer ${Storage.token || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .catch(() => {});
  }, [desafioId]);

  if (!d) return <div className="p-2 rounded bg-gray-200">Carregando desafio...</div>;
  const imagem = publicImgUrl(d.imagemUrl);

  return (
    <div className="cursor-pointer" onClick={() => navigate(`/desafios/${d.id}`)}>
      {imagem && <img src={imagem} className="w-60 h-36 object-cover rounded mb-2" />}
      <div className="text-sm font-semibold">{d.titulo}</div>
      <div className="text-xs opacity-70">Pontos: {d.pontuacao ?? "-"}</div>
    </div>
  );
}

export function CardDesafioGrupo({ msg }: { msg: MsgGrupo }) {
  const [, navigate] = useLocation();
  const {
    titulo,
    prazo,
    pontos,
    pontuacao,
    enviados: enviadosJson = 0,
    total: totalJson = 0,
    linkSubmissao,
    desafioId: desafioIdJson,
  } = (msg.conteudoJson || {}) as {
    titulo: string; prazo?: string; pontos?: number; pontuacao?: number;
    enviados?: number; total?: number; linkSubmissao?: string; desafioId?: string;
  };

  const pts = typeof pontos === "number" ? pontos : pontuacao ?? 0;
  const [contagem, setContagem] = useState<{ enviados: number; total: number }>({
    enviados: enviadosJson ?? 0,
    total: totalJson ?? 0,
  });

  useEffect(() => {
    let alive = true;
    if (!msg.desafioEmGrupoId) return;

    fetch(`${API.BASE_URL}/api/desafios/em-grupo/${msg.desafioEmGrupoId}/progresso`, {
      headers: { Authorization: `Bearer ${Storage.token || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setContagem({ enviados: Number(data.enviados) || 0, total: Number(data.total) || 0 });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [msg.desafioEmGrupoId]);

  const desafioId =
    desafioIdJson ||
    (msg.conteudoJson &&
      (msg.conteudoJson.desafioOficialId || msg.conteudoJson.desafio_id));

  const handleEnviarAgora = () => {
    if (msg.grupoId && desafioId) {
      navigate(`/submissao/grupo/${msg.grupoId}/${desafioId}?deg=${msg.desafioEmGrupoId}`);
      return;
    }

    if (linkSubmissao) {
      navigate(linkSubmissao);
      return;
    }

    alert("Não foi possível abrir a página de submissão: faltam IDs.");
  };

  return (
    <div className="max-w-md rounded-lg border border-green-600 bg-transparent p-3 text-sm text-green-900">
      <div className="font-semibold">Desafio em Grupo</div>
      <div className="mt-1">🏁 <b>{titulo}</b></div>
      <div className="mt-1">🗓️ Prazo: {formatarData(prazo)}</div>
      <div className="mt-1">⭐ Pontos: {pts}</div>
      <div className="mt-1">📈 Progresso: {contagem.enviados}/{contagem.total}</div>
      <div className="mt-3 flex gap-2">
        <button className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-900" onClick={handleEnviarAgora}>
          Enviar agora
        </button>
      </div>
    </div>
  );
}

function PostPreview({ postId }: { postId: string }) {
  const [, navigate] = useLocation();
  const [post, setPost] = useState<Postagem | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API.BASE_URL}/api/post/visualizar/${postId}`, {
      headers: { Authorization: `Bearer ${Storage.token || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive) setPost(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [postId]);

  if (!post) return <div className="p-2 rounded max-w-sm bg-gray-200">Carregando post...</div>;

  const avatar  = publicImgUrl(post.usuario.foto) || "https://via.placeholder.com/40";
  const imgSrc  = publicImgUrl(post.imagemUrl);
  const videoSrc= publicImgUrl(post.videoUrl);

  return (
    <div onClick={() => navigate(`/post/${post.id}`)} className="p-4 rounded max-w-sm border shadow-sm cursor-pointer bg-white" title="Clique para abrir a postagem">
      <div className="flex items-center mb-3 gap-3">
        <img src={avatar} alt={`Foto de ${post.usuario.nome}`} className="w-10 h-10 rounded-full object-cover border" />
        <span className="font-semibold">{post.usuario.nome}</span>
      </div>
      {imgSrc && <img src={imgSrc} className="w-full max-h-48 object-cover rounded mb-2" />}
      {!imgSrc && videoSrc && (
        <video controls className="w-full max-h-48 rounded mb-2">
          <source src={videoSrc} />
          Seu navegador não suporta vídeo.
        </video>
      )}
      <p className="text-gray-800 text-sm line-clamp-2 whitespace-pre-wrap">{post.conteudo}</p>
    </div>
  );
}

function UsuarioPreview({ usuarioId }: { usuarioId: string }) {
  const [, navigate] = useLocation();
  const [u, setU] = useState<Usuario | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API.BASE_URL}/api/usuarios/${usuarioId}`, {
      headers: { Authorization: `Bearer ${Storage.token || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive) setU(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [usuarioId]);

  if (!u) {
    return <div className="p-2 rounded max-w-sm bg-gray-200">Carregando usuário...</div>;
  }

  const foto = publicImgUrl(u.foto) || "https://via.placeholder.com/40";

  return (
    <div
      onClick={() => navigate(`/perfil/${u.id}`)}
      className="p-4 rounded max-w-sm border shadow-sm cursor-pointer flex items-center gap-3 bg-white"
      title="Clique para ver o perfil"
    >
      <img src={foto} alt={`Foto de ${u.nome}`} className="w-12 h-12 rounded-full object-cover border" />
      <div>
        <p className="font-semibold">{u.nome}</p>
        <p className="text-sm text-gray-500">Ver perfil</p>
      </div>
    </div>
  );
}

export function BubbleMensagem({ msg, isMine }: { msg: MsgGrupo; isMine: boolean }) {
  const avatar = publicImgUrl(msg.usuario?.foto) || "https://via.placeholder.com/24";
  return (
    <div className={`p-2 rounded max-w-sm ${isMine ? "bg-blue-100 self-end ml-auto" : "bg-gray-200"}`} title={msg.usuario?.nome}>
      {msg.usuario && (
        <div className="text-xs text-gray-600 mb-1 flex items-center gap-2">
          <img src={avatar} alt={msg.usuario.nome} className="w-6 h-6 rounded-full object-cover border" />
          <span className="font-medium">{msg.usuario.nome}</span>
        </div>
      )}
      <div className="whitespace-pre-wrap">{msg.conteudo}</div>
      <div className="text-[10px] text-gray-500 mt-1">{new Date(msg.criadaEm).toLocaleString("pt-BR")}</div>
    </div>
  );
}

export function MensagemItemGrupo({ msg, meId }: { msg: MsgGrupo; meId?: string | null }) {
  if (msg.tipo === "GRUPO_DESAFIO" && msg.conteudoJson) return <CardDesafioGrupo msg={msg} />;
  if (msg.tipo === "GRUPO_DESAFIO_BONUS" && msg.conteudoJson) {
    return <BubbleMensagem msg={msg} isMine={msg.usuarioId === meId} />;
  }
  if (msg.tipo === "POST")     return <PostPreview postId={msg.conteudo} />;
  if (msg.tipo === "USUARIO")  return <UsuarioPreview usuarioId={msg.conteudo} />;
  if (msg.tipo === "DESAFIO")  return <DesafioPreview desafioId={msg.conteudo} />;
    return <BubbleMensagem msg={msg} isMine={msg.usuarioId === meId} />;
}