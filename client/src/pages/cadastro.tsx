import { useState } from "react";
import { useLocation } from "wouter";

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
  const [_, navigate] = useLocation();

  const handleSubmit = () => {
    if (!aceitaTermos) return setErro("Você deve aceitar os termos.");
    if (senha !== confirmarSenha) return setErro("As senhas não coincidem.");
    // Fazer requisição aqui...
    console.log({ tipoPerfil, nome, email, nomeDeUsuario, senha, treinaEscolinha });
    navigate("/login");
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2 bg-green-900 text-white flex flex-col justify-center items-center p-10">
        <img src="/logo.png" className="w-20 mb-4" />
        <h1 className="text-3xl font-bold mb-4">Bem-vindo à FootEra</h1>
        <p className="text-center max-w-md text-lg">
          Se você sonha em conquistar uma oportunidade, joga por amor ou quer se superar... aqui é o seu lugar.
FootEra. A metodologia dos profissionais, para quem vive futebol.

        </p>
        <ul className="text-left mt-6 text-sm list-disc list-inside">
          <li>Treinamentos personalizados</li>
          <li>Desafios para testar suas habilidades</li>
          <li>Compartilhe seu progresso com a comunidade</li>
          <li>Conecte-se com escolinhas e clubes profissionais</li>
          <li>Acompanhe sua evolução com pontuações e rankings</li>
        </ul>
      </div>

      <div className="w-1/2 bg-cream flex justify-center items-center p-10">
        <div className="bg-white rounded shadow-md w-full max-w-md p-6">
          <h2 className="text-xl font-semibold mb-1">Criar conta</h2>
          <p className="text-sm text-green-600 mb-4">Preencha os campos abaixo para criar sua conta</p>

          <label className="block mb-2 font-medium">Tipo de Perfil</label>
          {["Atleta", "Escolinha de Futebol", "Clube Profissional", "Profissional do Futebol"].map((perfil) => (
            <label className="flex items-center text-sm mb-1" key={perfil}>
              <input
                type="radio"
                name="tipo"
                className="mr-2"
                value={perfil}
                checked={tipoPerfil === perfil}
                onChange={(e) => setTipoPerfil(e.target.value)}
              />
              {perfil}
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

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Você treina em alguma escolinha cadastrada na FootEra?</label>
            <label className="flex items-center text-sm mb-1">
              <input type="radio" className="mr-2" name="escolinha" value="sim" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Sim, treino em uma escolinha
            </label>
            <label className="flex items-center text-sm mb-1">
              <input type="radio" className="mr-2" name="escolinha" value="nao" onChange={(e) => setTreinaEscolinha(e.target.value)} /> Não, sou um atleta independente
            </label>
          </div>

          <div className="mt-4 mb-3">
            <label className="flex items-center text-sm">
              <input type="checkbox" className="mr-2" checked={aceitaTermos} onChange={(e) => setAceitaTermos(e.target.checked)} />
              Li e aceito os <a href="#" className="underline text-blue-700">Termos de Uso</a> e <a href="#" className="underline text-blue-700">Política de Privacidade</a>
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
