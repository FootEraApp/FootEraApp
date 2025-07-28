import { useEffect, useState } from "react";
import { useParams } from "wouter";

export default function PerfilUnico() {
  const { id } = useParams<{ id: string }>();
  const [usuario, setUsuario] = useState<any>(null);

  useEffect(() => {
    if (!id) return; 

    fetch(`http://localhost:3001/api/perfil/${id}`)
      .then(res => res.json())
      .then(setUsuario)
      .catch(console.error);
  }, [id]);

  if (!usuario) return <p>Carregando perfil...</p>;

  return (
    <div className="p-4 min-h-screen bg-cream text-green-900">
      <div className="text-center">
        <img
          src={usuario.foto || "/placeholder.png"}
          className="w-32 h-32 rounded-full mx-auto object-cover"
          alt="Foto de perfil"
        />
        <h1 className="text-xl font-bold mt-2">{usuario.nome}</h1>
        <p className="text-sm text-gray-700">{usuario.tipo}</p>

        <div className="mt-4 flex gap-2 justify-center">
          <button className="px-4 py-2 bg-green-600 text-white rounded-full">Seguir</button>
          <button className="px-4 py-2 bg-green-100 text-green-800 rounded-full">Treinar Juntos</button>
        </div>
      </div>
    </div>
  );
}