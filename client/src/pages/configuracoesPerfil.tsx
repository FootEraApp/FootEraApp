import { Switch } from "../components/ui/switch";
import { useState } from "react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function ConfiguracoesPerfil() {
  const [, setLocation] = useLocation();
  const [visivel, setVisivel] = useState(true);
  const [mensagens, setMensagens] = useState(true);
  const [mostrarEmail, setMostrarEmail] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
      if (!token) {
        setLocation("/login");
      }
  }, []);

  function confirmarLogout() {
    if (confirm("Tem certeza que deseja sair?")) {
      localStorage.clear();
      setLocation("/login");
    }
  }

  return (
    <div className="min-h-screen bg-yellow-50 px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 text-center text-green-900">FOOTERA</h1>

      <section className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Conta</h2>
        <div className="flex justify-between py-2">
          <span>Privacidade</span>
          <button className="text-green-700 font-medium">Configurar</button>
        </div>
        <div className="flex justify-between py-2">
          <span>Notificações</span>
          <button className="text-green-700 font-medium">Gerenciar</button>
        </div>
        <div className="flex justify-between py-2">
          <span>Segurança</span>
          <button className="text-green-700 font-medium">Alterar</button>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Dados e Privacidade</h2>
        <div className="flex justify-between items-center py-2">
          <span>Perfil Visível para Todos</span>
          <Switch checked={visivel} onCheckedChange={setVisivel} />
        </div>
        <div className="flex justify-between items-center py-2">
          <span>Permitir Mensagens Diretas</span>
          <Switch checked={mensagens} onCheckedChange={setMensagens} />
        </div>
        <div className="flex justify-between items-center py-2">
          <span>Mostrar E-mail no Perfil</span>
          <Switch checked={mostrarEmail} onCheckedChange={setMostrarEmail} />
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-red-600 mb-2">Ações da Conta</h2>
        <button
          className="w-full text-red-600 border border-red-600 py-2 rounded hover:bg-red-50"
          onClick={confirmarLogout}
        >
          Sair
        </button>
      </section>
    </div>
  );
}
