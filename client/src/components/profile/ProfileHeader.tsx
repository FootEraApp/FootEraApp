import { Settings, Edit, Bell } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../ui/button";
import { formatarUrlFoto } from "@/utils/formatarFoto";

interface ProfileHeaderProps {
  name: string;
  age?: number;
  position?: string;
  team?: string;
  score?: number;
  avatar?: string | null;
  isOwnProfile?: boolean;
  foto?: string | null;
}

export default function ProfileHeader({
  name,
  age,
  position,
  team,
  score = 0,
  avatar,
  isOwnProfile = false,
  foto
}: ProfileHeaderProps) {

  const formatImagePath = (path: string) =>
  path.startsWith("/uploads/") ? path.replace("/uploads/", "") : path;

  const imageBaseUrl = "http://localhost:3001/uploads/";
  
  const resolveImageSrc = () => {
    if (!foto && !avatar) return "/attached_assets/Perfil.jpg";

    const caminho = foto || avatar;

    if (caminho?.startsWith("http") || caminho?.startsWith("/")) {
      return caminho;
    }

    return `http://localhost:3001/uploads/${caminho}`;
  };

 const imageSrc = resolveImageSrc();

  return (
    <div className="footera-bg-green p-6 flex flex-col items-center relative">
      {isOwnProfile && (
        <div className="absolute top-4 right-4 flex gap-2">
        <Link href="/notificacoes">
          <Button
            variant="ghost"
            size="icon"
            className="bg-white/10 hover:bg-white/20 text-white rounded-full"
          >
            <Bell size={18} />
          </Button>
        </Link>

          <Link href="/perfil/editar">
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/10 hover:bg-white/20 text-white rounded-full"
            >
              <Edit size={18} />
            </Button>
          </Link>
        </div>
      )}

      <div className="w-24 h-24 rounded-full mb-3 flex items-center justify-center bg-white border-2 border-white overflow-hidden">
        <img
          src={formatarUrlFoto(imageSrc)}
          alt={`${name} profile`}
          className="w-full h-full object-cover"
        />
      </div>

      <h1 className="footera-text-cream text-2xl font-bold">{name.toUpperCase()}</h1>

      {(age || position || team) && (
        <p className="footera-text-cream text-sm mb-1 text-center">
          {age && `${age} anos`}{(age && position) && " • "}
          {position}{(position && team) && " • "}
          {team}
        </p>
      )}

      <div className="w-full mt-4">
        <h2 className="footera-text-cream text-center mb-2">Pontuação FootEra</h2>
        <div className="footera-bg-green border border-footera-cream rounded-lg p-3 flex justify-center">
          <span className="footera-text-cream text-3xl font-bold">{score} pts</span>
        </div>
      </div>

      {isOwnProfile && (
        <div className="mt-4 w-full">
          <Link href="/perfil/configuracoes">
            <Button
              variant="outline"
              className="w-full bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              <Settings size={16} className="mr-2" />
              Configurações
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}