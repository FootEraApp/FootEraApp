import { useState } from "react";

export default function CreateExercicio() {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaAtual, setCategoriaAtual] = useState("");
  const [video, setVideo] = useState<File | null>(null);

  const handleAddCategoria = () => {
    if (categoriaAtual && !categorias.includes(categoriaAtual)) {
      setCategorias([...categorias, categoriaAtual]);
      setCategoriaAtual("");
    }
  };

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append("codigo", codigo);
    formData.append("nome", nome);
    formData.append("descricao", descricao);
    formData.append("nivel", nivel);
    formData.append("categorias", JSON.stringify(categorias));
    if (video) formData.append("video", video);

    await fetch("http://localhost:3001/api/exercicios", {
      method: "POST",
      body: formData,
    });
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Novo Exercício</h2>

      <label className="block mb-2">Código</label>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className="border p-2 w-full rounded mb-4"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Nível</label>
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className="border p-2 w-full rounded mb-4"
          >
            <option>Base</option>
            <option>Intermediário</option>
            <option>Avançado</option>
          </select>
        </div>
      </div>

      <label className="block mb-2">Nome</label>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="border p-2 w-full rounded mb-4"
      />

      <label className="block mb-2">Descrição</label>
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="border p-2 w-full rounded mb-4"
      />

      <label className="block mb-2">Categorias</label>
      <div className="flex gap-2 mb-2">
        <input
          value={categoriaAtual}
          onChange={(e) => setCategoriaAtual(e.target.value)}
          className="border p-2 rounded w-full"
          placeholder="Ex: sub13, técnico..."
        />
        <button
          type="button"
          className="bg-green-600 text-white px-3 py-1 rounded"
          onClick={handleAddCategoria}
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {categorias.map((cat, i) => (
          <span
            key={i}
            className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm"
          >
            {cat}
          </span>
        ))}
      </div>

      <label className="block mb-2">Vídeo do Exercício (opcional)</label>
      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={(e) => setVideo(e.target.files?.[0] || null)}
        className="mb-4"
      />
      <p className="text-sm text-gray-500 mb-4">
        Formatos aceitos: MP4, WebM, MOV (máx. 100MB)
      </p>

      <div className="flex justify-end gap-4">
        <button className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
        <button
          className="px-4 py-2 bg-green-700 text-white rounded"
          onClick={handleSubmit}
        >
          Criar
        </button>
      </div>
    </div>
  );
}
