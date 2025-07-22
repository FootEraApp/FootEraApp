"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function EditarProfessor() {
  const router = useRouter();
  const { id } = router.query;
  const [professor, setProfessor] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:3001/api/professores/${id}`)
        .then(res => res.json())
        .then(setProfessor);
    }
  }, [id]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const res = await fetch(`http://localhost:3001/api/professores/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(professor),
    });
    if (res.ok) {
      alert("Professor atualizado com sucesso!");
      router.push("/admin");
    } else {
      alert("Erro ao atualizar professor.");
    }
  };

  if (!professor) return <div>Carregando...</div>;

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Editar Professor</h2>
      <label className="block mb-2">
        CREF:
        <input
          value={professor.cref || ""}
          onChange={(e) => setProfessor({ ...professor, cref: e.target.value })}
          className="border rounded px-3 py-2 w-full"
        />
      </label>
      <label className="block mb-2">
        Área de Formação:
        <input
          value={professor.areaFormacao || ""}
          onChange={(e) => setProfessor({ ...professor, areaFormacao: e.target.value })}
          className="border rounded px-3 py-2 w-full"
        />
      </label>
      <label className="block mb-2">
        Qualificações:
        <input
          value={professor.qualificacoes || ""}
          onChange={(e) => setProfessor({ ...professor, qualificacoes: e.target.value })}
          className="border rounded px-3 py-2 w-full"
        />
      </label>
      <label className="block mb-4">
        Certificações:
        <input
          value={professor.certificacoes || ""}
          onChange={(e) => setProfessor({ ...professor, certificacoes: e.target.value })}
          className="border rounded px-3 py-2 w-full"
        />
      </label>
      <div className="flex gap-4">
        <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded">Salvar</button>
        <button type="button" className="bg-gray-300 px-4 py-2 rounded" onClick={() => window.location.href = "/admin"}>Cancelar</button>
      </div>
    </form>
  );
}
