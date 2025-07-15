import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getPostById } from "@/services/feedService";

export default function PostagemIndividual() {
  const [post, setPost] = useState<any>(null);
  const [location] = useLocation();

  const postId = location.split("/").pop();

  useEffect(() => {
    async function fetchPost() {
      const data = await getPostById(postId as string);
      setPost(data);
    }

    fetchPost();
  }, [postId]);

  if (!post) return <p>Carregando...</p>;

  return (
    <div>
      <h1>{post.conteudo}</h1>
      {/* Renderize como no feed */}
    </div>
  );
}
