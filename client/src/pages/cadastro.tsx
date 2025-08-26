import { useState } from "react";
import { useLocation } from "wouter";
import logo from "/assets/usuarios/footera-logo.png"; 
import { API } from "../config.js";

export default function Cadastro() {
  const [tipoPerfil, setTipoPerfil] = useState("Atleta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeDeUsuario, setNomeDeUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [treinaEscolinha, setTreinaEscolinha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [_, navigate] = useLocation();

   const [idade, setIdade] = useState<number | "">("");
  const [categoria, setCategoria] = useState(""); 

  const [areaFormacao, setAreaFormacao] = useState("");

  const [cnpjClube, setCnpjClube] = useState("");
  const [cidadeClube, setCidadeClube] = useState("");

  const [cnpjEscolinha, setCnpjEscolinha] = useState("");
  const [cidadeEscolinha, setCidadeEscolinha] = useState("");

  const handleSubmit = async () => {
    setErro("");
    setSucesso("");

    if (!aceitaTermos) return setErro("Você deve aceitar os termos.");
    if (senha !== confirmarSenha) return setErro("As senhas não coincidem.");
    if (!nome || !email || !nomeDeUsuario || !senha) return setErro("Preencha todos os campos obrigatórios.");

    if (tipoPerfil === "Atleta" && !categoria) return setErro("Por favor, selecione a categoria.");

    try {
      const res = await fetch(`${API.BASE_URL}/api/cadastro/cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipoPerfil,
          nome,
          email,
          nomeDeUsuario,
          senha,
          treinaEscolinha,
          idade: tipoPerfil === "Atleta" ? idade : undefined,
          categoria: tipoPerfil === "Atleta" ? [categoria] : undefined,
          areaFormacao: tipoPerfil === "Professor" ? areaFormacao : undefined,
          
          cnpjEscolinha: tipoPerfil === "Escolinha" ? cnpjEscolinha : undefined,
          cidadeEscolinha: tipoPerfil === "Escolinha" ? cidadeEscolinha : undefined,
          cnpjClube: tipoPerfil === "Clube" ? cnpjClube : undefined,
          cidadeClube: tipoPerfil === "Clube" ? cidadeClube : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      setSucesso("Cadastro realizado com sucesso!");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setErro(err.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <div className="w-full lg:w-1/2 bg-green-800 text-white flex flex-col justify-center items-center p-10">
        <img src={logo} alt="Logo FootEra" className="w-20 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Bem-vindo à FootEra</h1>
        <p className="text-center max-w-md text-lg">
          Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar... aqui é o seu lugar.
FootEra. A metodologia dos profissionais, para quem vive futebol.

        </p>
        <ul className="text-left mt-6 text-base list-disc list-inside">
          <li>Treinamentos personalizados</li>
          <li>Desafios para testar suas habilidades</li>
          <li>Compartilhe seu progresso com a comunidade</li>
          <li>Conecte-se com escolinhas e clubes profissionais</li>
          <li>Acompanhe sua evolução com pontuações e rankings</li>
        </ul>
      </div>

      <div className="bg-cream flex justify-center items-center p-10">
        <div className="bg-white rounded shadow-md w-full max-w-md p-6">
          <h2 className="text-xl font-semibold mb-1 mt-11">Criar conta</h2>
          <p className="text-sm text-green-600 mb-4">Preencha os campos abaixo para criar sua conta</p>

          <label className="block mb-2 font-medium">Tipo de Perfil</label>
          {[
            { label: "Atleta", value: "Atleta" },
            { label: "Escolinha de Futebol", value: "Escolinha" },
            { label: "Clube Profissional", value: "Clube" },
            { label: "Profissional do Futebol", value: "Professor" },
            { label: "Admin", value: "Admin"}
          ].map((perfil) => (
            <label className="flex items-center text-sm mb-1" key={perfil.value}>
              <input
                type="radio"
                name="tipo"
                className="mr-2"
                value={perfil.value}
                checked={tipoPerfil === perfil.value}
                onChange={(e) => setTipoPerfil(e.target.value)}
              />
              {perfil.label}
            </label>
          ))}

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Nome Completo</label>
            <input className="w-full border rounded px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Nome de usuário</label>
            <input className="w-full border rounded px-3 py-2" value={nomeDeUsuario} onChange={(e) => setNomeDeUsuario(e.target.value)} />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input type="password" className="w-full border rounded px-3 py-2" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Confirmar Senha</label>
            <input type="password" className="w-full border rounded px-3 py-2" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
          </div>

         {tipoPerfil === "Atleta" && (
            <>
              <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Você treina em alguma escolinha cadastrada na FootEra?</label>
                  <label className="flex items-center text-sm mb-1">
                    <input type="radio" className="mr-2" name="escolinha" value="sim" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Sim, treino em uma escolinha
                  </label>
                  <label className="flex items-center text-sm mb-1">
                    <input type="radio" className="mr-2" name="escolinha" value="nao" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Não, sou um atleta independente
                  </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Idade</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={idade}
                  onChange={(e) => setIdade(e.target.value ? parseInt(e.target.value) : "")}
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">Selecione a categoria</option>
                  <option value="Sub9">Sub9</option>
                  <option value="Sub11">Sub11</option>
                  <option value="Sub13">Sub13</option>
                  <option value="Sub15">Sub15</option>
                  <option value="Sub17">Sub17</option>
                  <option value="Sub20">Sub20</option>
                  <option value="Livre">Livre</option>
                </select>
              </div>
            </>
          )}

          {tipoPerfil === "Professor" && (
            <>
              <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Você da aula em alguma escolinha cadastrada na FootEra?</label>
                  <label className="flex items-center text-sm mb-1">
                    <input type="radio" className="mr-2" name="escolinha" value="sim" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Sim, dou aula em uma escolinha
                  </label>
                  <label className="flex items-center text-sm mb-1">
                    <input type="radio" className="mr-2" name="escolinha" value="nao" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Não, sou um profissional independente
                  </label>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Área de Formação</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={areaFormacao}
                  onChange={(e) => setAreaFormacao(e.target.value)}
                />
              </div>
            </>
          )}

          {tipoPerfil === "Clube" && (
            <>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Você tem parceria com a plataforma FootEra?</label>
                <label className="flex items-center text-sm mb-1">
                  <input type="radio" className="mr-2" name="escolinha" value="sim" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Sim, faço parte da plataforma
                </label>
                <label className="flex items-center text-sm mb-1">
                  <input type="radio" className="mr-2" name="escolinha" value="nao" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Não, sou um clube independente
                </label>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">CNPJ</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={cnpjClube}
                  placeholder="Ex: 00.000.00/0000-00"
                  onChange={(e) => setCnpjClube(e.target.value)}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Cidade</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={cidadeClube}
                  placeholder="Ex: São Paulo - SP"
                  onChange={(e) => setCidadeClube(e.target.value)}
                />
              </div>
            </>
          )}

         {tipoPerfil === "Escolinha" && (
            <>
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Você é alguma escolinha cadastrada na FootEra?</label>
                <label className="flex items-center text-sm mb-1">
                  <input type="radio" className="mr-2" name="escolinha" value="sim" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Sim, sou uma escolinha cadastrada
                </label>
                <label className="flex items-center text-sm mb-1">
                  <input type="radio" className="mr-2" name="escolinha" value="nao" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Não, sou uma escolinha independente
                </label>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">CNPJ</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={cnpjEscolinha}
                  placeholder="Ex: 00.000.00/0000-00"
                  onChange={(e) => setCnpjEscolinha(e.target.value)}
                />
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Cidade</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={cidadeEscolinha}
                  placeholder="Ex: São Paulo - SP"
                  onChange={(e) => setCidadeEscolinha(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="mt-4 mb-3">
            <label className="flex items-center text-sm">
              <input type="checkbox" className="mr-2" checked={aceitaTermos} onChange={(e) => setAceitaTermos(e.target.checked)} />
              Li e aceito os   <a href="#" className="underline text-blue-700"> Termos de Uso </a> e <a href="#" className="underline text-blue-700">  Política de Privacidade </a>
            </label>
          </div>

          {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}

          <button onClick={handleSubmit} className="w-full bg-green-900 hover:bg-green-800 text-white py-2 rounded">
            Criar conta
          </button>

          <p className="text-center text-sm mt-3">
            Já tem uma conta? <a href="/login" className="text-green-700 underline">Faça login</a>
          </p>
        </div>
      </div>
    </div>
  );
}
