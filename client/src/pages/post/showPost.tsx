import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getFeedPosts } from "../../services/feedService";
import { formatDistanceToNow } from "date-fns";

export default function ShowPostPage() {
  const params = useParams();
  const id = ( params as { id?: string }).id;
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    async function carregarPost() {
      const dados = await getFeedPosts();
      const encontrado = dados.find((p: any) => p.id === id);
      setPost(encontrado);
    }
    carregarPost();
  }, [id]);

  if (!post) return <p className="text-center mt-10">Carregando postagem...</p>;

  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
        <div className="flex items-center gap-2">
          <img
            src={post.usuario.foto || "/default-user.png"}
            alt="avatar"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <p className="font-semibold">{post.usuario.nome}</p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(post.dataCriacao), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>

        <div>
          <p className="text-gray-800 font-medium">{post.conteudo}</p>
          {post.tipoMidia === "Imagem" && post.imagemUrl && (
            <img src={post.imagemUrl} alt="Post" className="mt-2 rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}
