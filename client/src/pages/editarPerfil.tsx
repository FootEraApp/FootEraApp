import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { formatarUrlFoto } from '@/utils/formatarFoto.js';
import Storage from "../../../server/utils/storage.js";
import { API } from '../config.js';

const EditarPerfil = () => {
  const usuarioId = Storage.usuarioId;
  const tipoUsuario = Storage.tipoSalvo;
  const token = Storage.token;

  const [dadosUsuario, setDadosUsuario] = useState<any>(null);
  const [dadosTipo, setDadosTipo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDados = async () => {
      try {
        const res = await axios.get(`${API.BASE_URL}/api/perfil/${usuarioId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setDadosUsuario(res.data.usuario);
        setDadosTipo(res.data.dadosEspecificos);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setLoading(false);
      }
    };

    if (usuarioId && token) {
      fetchDados();
    }
  }, [usuarioId, token]);

  if (loading) {
    return <div className="text-center text-gray-600 mt-10">Carregando perfil...</div>;
  }

  if (!dadosUsuario || !dadosTipo) {
    return <div className="text-center text-red-600 mt-10">Erro ao carregar o perfil.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('tipo_')) {
      setDadosTipo({ ...dadosTipo, [name.replace('tipo_', '')]: value });
    } else {
      setDadosUsuario({ ...dadosUsuario, [name]: value });
    }
  };

  const renderCamposEspecificos = () => {
    if (!dadosTipo) return null;

    const renderInput = (label: string, name: string, type = "text") => (
      <div className="mb-4" key={name}>
        <label className="block text-sm font-medium">{label}</label>
        <input
          type={type}
          name={`tipo_${name}`}
          value={dadosTipo[name] ?? ""}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>
    );

    switch (tipoUsuario) {
      case 'atleta':
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("Sobrenome", "sobrenome")}
            {renderInput("Idade", "idade", "number")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Nacionalidade", "nacionalidade")}
            {renderInput("Naturalidade", "naturalidade")}
            {renderInput("Posição", "posicao")}
            {renderInput("Altura (cm)", "altura", "number")}
            {renderInput("Peso (kg)", "peso", "number")}
            {renderInput("Selo de Qualidade", "seloQualidade")}
          </>
        );
      case 'professor':
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("CREF", "cref")}
            {renderInput("Área de Formação", "areaFormacao")}
            {renderInput("Escola", "escola")}
            {renderInput("Qualificações (separadas por vírgula)", "qualificacoes")}
            {renderInput("Certificações (separadas por vírgula)", "certificacoes")}
          </>
        );
      case 'escola':
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Email", "email")}
            {renderInput("Site Oficial", "siteOficial")}
            {renderInput("Sede", "sede")}
            {renderInput("Logradouro", "logradouro")}
            {renderInput("Número", "numero")}
            {renderInput("Complemento", "complemento")}
            {renderInput("Bairro", "bairro")}
            {renderInput("Cidade", "cidade")}
            {renderInput("Estado", "estado")}
            {renderInput("País", "pais")}
            {renderInput("CEP", "cep")}
          </>
        );
      case 'clube':
        return (
          <>
            {renderInput("Nome de Exibição", "nome")}
            {renderInput("Telefone 1", "telefone1")}
            {renderInput("Telefone 2", "telefone2")}
            {renderInput("Email", "email")}
            {renderInput("Site Oficial", "siteOficial")}
            {renderInput("Sede", "sede")}
            {renderInput("Estádio", "estadio")}
            {renderInput("Logradouro", "logradouro")}
            {renderInput("Número", "numero")}
            {renderInput("Complemento", "complemento")}
            {renderInput("Bairro", "bairro")}
            {renderInput("Cidade", "cidade")}
            {renderInput("Estado", "estado")}
            {renderInput("País", "pais")}
            {renderInput("CEP", "cep")}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Editar Perfil</h1>

      {dadosUsuario.foto && typeof dadosUsuario.foto === "string" && (
        <div className="mb-6">
          <label className="block text-sm font-medium">Foto Atual</label>
          <img
            src={
              formatarUrlFoto(dadosUsuario.foto)
            }
            alt="Foto de perfil"
            className="w-24 h-24 rounded-full object-cover mt-2"
          />
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium">Foto de Perfil</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setDadosUsuario((prev: any) => ({
                ...prev,
                foto: e.target.files![0]
              }));
            }
          }}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Nome</label>
        <input
          name="nome"
          value={dadosUsuario.nome || ''}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          value={dadosUsuario.email || ''}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {renderCamposEspecificos()}

      <button
        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-600"
        onClick={async () => {
          try {
            let fotoUrl = dadosUsuario.foto;

            if (dadosUsuario.foto instanceof File) {
              const formData = new FormData();
              formData.append("foto", dadosUsuario.foto);
              formData.append("usuarioId", usuarioId!);
              formData.append("tipo", tipoUsuario!);

              const uploadRes = await axios.post(
                `${API.BASE_URL}/api/upload/perfil`,
                formData
              );
              fotoUrl = uploadRes.data.caminho;
            }

          const tipo = { ...dadosTipo };
            if (tipoUsuario === "professor") {
              if (typeof tipo.qualificacoes === "string") {
                tipo.qualificacoes = tipo.qualificacoes.split(',').map((q: string) => q.trim());
              }
              if (typeof tipo.certificacoes === "string") {
                tipo.certificacoes = tipo.certificacoes.split(',').map((c: string) => c.trim());
              }
            }

            await axios.put(
              `${API.BASE_URL}/api/perfil/${usuarioId}`,
              {
                usuario: { ...dadosUsuario, foto: fotoUrl },
                tipo,
                tipoUsuario
              },
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );

            alert("Dados atualizados com sucesso!");
            window.location.href = "/perfil";
          } catch (err) {
            alert("Erro ao salvar os dados.");
          }
        }}
      >
        Salvar Alterações
      </button>
    </div>
  );
};

export default EditarPerfil;
