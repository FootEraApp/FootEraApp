import { Switch } from "../components/ui/switch";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Volleyball, User, CirclePlus, Search, House } from "lucide-react";

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
      setLocation("/admin/login");
    }
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <header className="bg-green-900 text-white text-center py-3 text-xl font-bold">FOOTERA</header>

      <button
        onClick={() => setLocation("/perfil")}
        className="text-green-900 text-lg font-semibold px-4 mt-4 mb-2 hover:underline"
      >
        ← Configurações
      </button>

      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Conta</h2>
        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🛡️ Privacidade</p>
            <p className="text-sm text-gray-600">Gerencie quem pode ver seu perfil</p>
          </div>
          <button className="text-green-800 font-semibold">Configurar</button>
        </div>

        <div className="flex justify-between py-2 items-start border-b">
          <div>
            <p className="font-semibold">🔔 Notificações</p>
            <p className="text-sm text-gray-600">Controle quais notificações receber</p>
          </div>
          <button className="text-green-800 font-semibold">Gerenciar</button>
        </div>

        <div className="flex justify-between py-2 items-start">
          <div>
            <p className="font-semibold">🔑 Segurança</p>
            <p className="text-sm text-gray-600">Alterar senha ou configurações de acesso</p>
          </div>
          <button className="text-green-800 font-semibold">Alterar</button>
        </div>
      </div>

      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-gray-800 font-bold mb-3">Dados e Privacidade</h2>

        <div className="flex justify-between items-center py-3 border-b">
          <span className="font-medium">Perfil Visível para Todos</span>
          <Switch checked={visivel} onCheckedChange={setVisivel} />
        </div>

        <div className="flex justify-between items-center py-3 border-b">
          <span className="font-medium">Permitir Mensagens Diretas</span>
          <Switch checked={mensagens} onCheckedChange={setMensagens} />
        </div>

        <div className="flex justify-between items-center py-3">
          <span className="font-medium">Mostrar E-mail no Perfil</span>
          <Switch checked={mostrarEmail} onCheckedChange={setMostrarEmail} />
        </div>
      </div>

      <div className="bg-white mx-4 p-4 rounded-xl shadow mb-4">
        <h2 className="text-red-600 font-semibold mb-3">Ações da Conta</h2>
        <button
          onClick={confirmarLogout}
          className="w-full flex items-center justify-center gap-2 border border-red-600 text-red-600 py-2 rounded-md hover:bg-red-50"
        >
          <span>↪️</span> Sair
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
              <Link href="/feed" className="hover:underline">
                <House /> 
              </Link>
              <Link href="/explorar" className="hover:underline">
                <Search /> 
              </Link>
              <Link href="/post" className="hover:underline">
                <CirclePlus /> 
              </Link>
              <Link href="/treinos" className="hover:underline">
                <Volleyball /> 
              </Link>
              <Link href="/perfil" className="hover:underline">
                <User /> 
              </Link>
            </nav>

    </div>
  );
}
